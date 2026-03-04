/**
 * Audio Storage Service
 *
 * Uploads synthesized audio buffers to S3-compatible object storage
 * (AWS S3 or Cloudflare R2) and returns a public URL.
 *
 * Uses the AWS Signature Version 4 algorithm via Node.js native `crypto`
 * — no extra SDK dependencies required.
 *
 * Environment variables:
 *   AUDIO_STORAGE_BUCKET      S3 / R2 bucket name
 *   AUDIO_STORAGE_REGION      AWS region (default: us-east-1, R2: auto)
 *   AUDIO_STORAGE_ENDPOINT    Custom endpoint for R2 / MinIO (optional)
 *   AUDIO_STORAGE_ACCESS_KEY  AWS / R2 access key ID
 *   AUDIO_STORAGE_SECRET_KEY  AWS / R2 secret access key
 *   AUDIO_STORAGE_PUBLIC_URL  Base URL for public asset access
 *                             e.g. https://cdn.example.com or
 *                                  https://<bucket>.s3.<region>.amazonaws.com
 *
 * If storage is not configured the service logs a warning and returns null,
 * allowing callers to degrade gracefully.
 */

import crypto from "crypto";
import { logger } from "../utils/logger.js";

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

interface StorageConfig {
  bucket: string;
  region: string;
  endpoint: string; // full host, e.g. s3.us-east-1.amazonaws.com
  accessKey: string;
  secretKey: string;
  publicBaseUrl: string;
}

function loadConfig(): StorageConfig | null {
  const bucket = process.env.AUDIO_STORAGE_BUCKET;
  const accessKey = process.env.AUDIO_STORAGE_ACCESS_KEY;
  const secretKey = process.env.AUDIO_STORAGE_SECRET_KEY;
  const publicBaseUrl = process.env.AUDIO_STORAGE_PUBLIC_URL;

  if (!bucket || !accessKey || !secretKey || !publicBaseUrl) {
    return null;
  }

  const region = process.env.AUDIO_STORAGE_REGION || "us-east-1";
  // Custom endpoint for R2/MinIO; fall back to AWS standard endpoint
  const endpoint =
    process.env.AUDIO_STORAGE_ENDPOINT ||
    `s3.${region}.amazonaws.com`;

  return { bucket, region, endpoint, accessKey, secretKey, publicBaseUrl };
}

// ─────────────────────────────────────────────────────────────────────────────
// AWS Signature V4 helpers
// ─────────────────────────────────────────────────────────────────────────────

function hmacSHA256(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest();
}

function sha256Hex(data: Buffer | string): string {
  return crypto
    .createHash("sha256")
    .update(data)
    .digest("hex");
}

function getSigningKey(
  secretKey: string,
  dateStamp: string,
  region: string,
  service: string,
): Buffer {
  const kDate = hmacSHA256("AWS4" + secretKey, dateStamp);
  const kRegion = hmacSHA256(kDate, region);
  const kService = hmacSHA256(kRegion, service);
  return hmacSHA256(kService, "aws4_request");
}

/**
 * Build Authorization header value for an S3 PUT request.
 */
function buildAuthHeader(params: {
  method: string;
  bucket: string;
  key: string;
  host: string;
  region: string;
  accessKey: string;
  secretKey: string;
  payloadHash: string;
  amzDate: string;
  dateStamp: string;
  contentType: string;
  contentLength: number;
}): string {
  const {
    method,
    bucket,
    key,
    host,
    region,
    accessKey,
    secretKey,
    payloadHash,
    amzDate,
    dateStamp,
    contentType,
    contentLength,
  } = params;

  // Canonical headers (sorted alphabetically)
  const canonicalHeaders =
    `content-length:${contentLength}\n` +
    `content-type:${contentType}\n` +
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;

  const signedHeaders =
    "content-length;content-type;host;x-amz-content-sha256;x-amz-date";

  const canonicalUri = `/${bucket}/${key}`;
  const canonicalQueryString = "";

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signingKey = getSigningKey(secretKey, dateStamp, region, "s3");
  const signature = hmacSHA256(signingKey, stringToSign).toString("hex");

  return (
    `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AudioStorageService
// ─────────────────────────────────────────────────────────────────────────────

export class AudioStorageService {
  private config: StorageConfig | null;

  constructor() {
    this.config = loadConfig();
    if (!this.config) {
      logger.warn(
        "AudioStorageService: storage not configured " +
          "(AUDIO_STORAGE_BUCKET / ACCESS_KEY / SECRET_KEY / PUBLIC_URL missing). " +
          "Audio URLs will not be persisted.",
      );
    }
  }

  /**
   * Returns true if storage is properly configured.
   */
  isConfigured(): boolean {
    return this.config !== null;
  }

  /**
   * Upload an audio buffer to S3-compatible storage.
   *
   * @param audioBuffer  Raw MP3 audio data
   * @param messageId    Used as the object key: `audio/<messageId>.mp3`
   * @returns Public URL string, or null if storage is not configured or upload fails
   */
  async upload(
    audioBuffer: Buffer,
    messageId: string,
  ): Promise<string | null> {
    if (!this.config) {
      return null;
    }

    const { bucket, region, endpoint, accessKey, secretKey, publicBaseUrl } =
      this.config;

    const key = `audio/${messageId}.mp3`;
    const contentType = "audio/mpeg";
    const contentLength = audioBuffer.length;

    // Build ISO-8601 date strings required by AWS Sig V4
    const now = new Date();
    const amzDate = now
      .toISOString()
      .replace(/[:-]/g, "")
      .replace(/\.\d{3}Z$/, "Z");
    const dateStamp = amzDate.slice(0, 8);

    const payloadHash = sha256Hex(audioBuffer);
    const host = endpoint;

    const authorization = buildAuthHeader({
      method: "PUT",
      bucket,
      key,
      host,
      region,
      accessKey,
      secretKey,
      payloadHash,
      amzDate,
      dateStamp,
      contentType,
      contentLength,
    });

    const uploadUrl = `https://${host}/${bucket}/${key}`;

    try {
      logger.debug("Uploading audio to storage", {
        messageId,
        key,
        size: contentLength,
      });

      const response = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          Authorization: authorization,
          "Content-Type": contentType,
          "Content-Length": String(contentLength),
          "x-amz-content-sha256": payloadHash,
          "x-amz-date": amzDate,
        },
        body: audioBuffer,
        // @ts-ignore — Node.js 18+ supports this
        duplex: "half",
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error("Audio storage upload failed", {
          messageId,
          status: response.status,
          error: errorText,
        });
        return null;
      }

      const publicUrl = `${publicBaseUrl.replace(/\/$/, "")}/${key}`;

      logger.info("Audio uploaded successfully", {
        messageId,
        url: publicUrl,
        size: contentLength,
      });

      return publicUrl;
    } catch (err) {
      logger.error("Audio upload error", {
        messageId,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }
}

// Singleton instance
let audioStorageInstance: AudioStorageService | null = null;

export function getAudioStorageService(): AudioStorageService {
  if (!audioStorageInstance) {
    audioStorageInstance = new AudioStorageService();
  }
  return audioStorageInstance;
}
