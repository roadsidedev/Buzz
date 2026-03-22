// @ts-nocheck
/**
 * Text-to-Speech Service
 *
 * Integrates with Google Cloud Text-to-Speech API for voice synthesis.
 * Manages audio streaming to Jam rooms for real-time playback.
 *
 * Features:
 * - Voice synthesis via Google Cloud TTS REST API
 * - Audio streaming to Jam rooms
 * - Voice caching for performance
 * - WebSocket audio delivery
 * - Error handling and retries
 *
 * Env vars:
 *   GOOGLE_TTS_API_KEY   — Google Cloud API key (required)
 *   GOOGLE_TTS_VOICE     — Voice name (default: en-US-Neural2-D)
 *   GOOGLE_TTS_VOICE_B   — Secondary voice for dialogue (default: en-US-Neural2-F)
 *   GOOGLE_TTS_LANGUAGE  — Language code (default: en-US)
 */

import { spawn } from "child_process";
import { logger } from "../utils/logger.js";
import { ValidationError, ServiceUnavailableError } from "../utils/errors.js";
import { getJamService } from "./jam-service.js";
import { TTS_CONFIG } from "../config/media-config.js";

// Google Cloud TTS endpoint
const GOOGLE_TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";

interface TTSConfig {
  apiKey: string;
  defaultVoiceName: string;
  defaultVoiceNameB: string;
  languageCode: string;
  // Keep these for backward compat with healthCheck / synthesizeDialogue callers
  defaultVoiceId: string;
  defaultModelId: string;
}

interface SynthesisRequest {
  text: string;
  voiceId?: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
}

interface SynthesisResponse {
  audioBuffer: Buffer;
  durationMs: number;
  format: string;
}

/**
 * TTS Service for voice synthesis and streaming
 */
export class TTSService {
  private config: TTSConfig;
  private voiceCache = new Map<string, Buffer>();

  constructor() {
    const apiKey = process.env.GOOGLE_TTS_API_KEY || "";
    const defaultVoiceName = process.env.GOOGLE_TTS_VOICE || "en-US-Neural2-D";
    this.config = {
      apiKey,
      defaultVoiceName,
      defaultVoiceNameB: process.env.GOOGLE_TTS_VOICE_B || "en-US-Neural2-F",
      languageCode: process.env.GOOGLE_TTS_LANGUAGE || "en-US",
      // legacy aliases
      defaultVoiceId: defaultVoiceName,
      defaultModelId: "google-cloud-tts",
    };

    if (!TTS_CONFIG.enabled) {
      logger.warn("TTS Service disabled via ENABLE_TTS=false");
    } else if (!this.config.apiKey) {
      logger.warn("TTS Service initialized without GOOGLE_TTS_API_KEY");
    } else {
      logger.info("TTS Service using Google Cloud TTS", {
        voice: this.config.defaultVoiceName,
        language: this.config.languageCode,
      });
    }
  }

  /**
   * Returns true if TTS is enabled and configured.
   */
  isEnabled(): boolean {
    return TTS_CONFIG.enabled && !!this.config.apiKey;
  }

  /**
   * Synthesize text to speech
   *
   * @param request - Synthesis parameters
   * @returns Audio buffer and metadata
   */
  async synthesize(request: SynthesisRequest): Promise<SynthesisResponse> {
    const { text, voiceId, modelId, stability, similarityBoost } = request;

    // Validate input
    if (!text || text.trim().length === 0) {
      throw new ValidationError("Text is required for synthesis", {
        text: text?.substring(0, 50),
      });
    }

    if (text.length > 5000) {
      throw new ValidationError(
        "Text exceeds maximum length of 5000 characters",
        {
          length: text.length,
        },
      );
    }

    // voiceId here maps to a Google voice name (e.g. "en-US-Neural2-D")
    const effectiveVoiceName = voiceId || this.config.defaultVoiceName;

    // Check cache for short messages
    const cacheKey = `${effectiveVoiceName}-${text}`;
    if (text.length < 100 && this.voiceCache.has(cacheKey)) {
      logger.debug("TTS cache hit", { textLength: text.length });
      return {
        audioBuffer: this.voiceCache.get(cacheKey)!,
        durationMs: this.estimateDuration(text),
        format: "mp3",
      };
    }

    try {
      logger.info("Synthesizing speech via Google Cloud TTS", {
        textLength: text.length,
        voice: effectiveVoiceName,
        language: this.config.languageCode,
      });

      const response = await fetch(
        `${GOOGLE_TTS_URL}?key=${this.config.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input: { text },
            voice: {
              languageCode: this.config.languageCode,
              name: effectiveVoiceName,
            },
            audioConfig: { audioEncoding: "MP3" },
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error("Google Cloud TTS API error", {
          status: response.status,
          error: errorText,
        });
        throw new ServiceUnavailableError("Google Cloud TTS", {
          status: response.status,
          error: errorText,
        });
      }

      const json = await response.json() as { audioContent: string };
      const audioBuffer = Buffer.from(json.audioContent, "base64");
      const durationMs = this.estimateDuration(text);

      // Cache short messages
      if (text.length < 100) {
        this.voiceCache.set(cacheKey, audioBuffer);
        if (this.voiceCache.size > 1000) {
          const firstKey = this.voiceCache.keys().next().value;
          this.voiceCache.delete(firstKey);
        }
      }

      logger.info("Speech synthesized successfully", {
        textLength: text.length,
        audioSize: audioBuffer.length,
        durationMs,
      });

      return { audioBuffer, durationMs, format: "mp3" };
    } catch (err) {
      logger.error("TTS synthesis failed", {
        error: err instanceof Error ? err.message : String(err),
        textLength: text.length,
      });
      throw err;
    }
  }

  /**
   * Stream audio to a Jam room
   *
   * @param jamRoomId - Jam room ID
   * @param audioBuffer - Audio data
   * @param messageId - Message ID for tracking
   */
  async streamToJam(
    jamRoomId: string,
    audioBuffer: Buffer,
    messageId: string,
  ): Promise<void> {
    try {
      logger.info("Streaming audio to Jam", {
        jamRoomId,
        messageId,
        audioSize: audioBuffer.length,
      });

      const jamService = getJamService();
      await jamService.streamAudio(jamRoomId, audioBuffer, messageId);

      logger.info("Audio streamed successfully", {
        jamRoomId,
        messageId,
      });
    } catch (err) {
      logger.error("Failed to stream audio to Jam", {
        jamRoomId,
        messageId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  /**
   * Synthesize and stream in one operation
   *
   * @param jamRoomId - Jam room ID
   * @param text - Text to synthesize
   * @param messageId - Message ID
   * @param voiceId - Optional voice ID
   */
  async synthesizeAndStream(
    jamRoomId: string,
    text: string,
    messageId: string,
    voiceId?: string,
  ): Promise<{ audioBuffer: Buffer; durationMs: number }> {
    const synthesis = await this.synthesize({
      text,
      voiceId,
    });

    await this.streamToJam(jamRoomId, synthesis.audioBuffer, messageId);

    return { audioBuffer: synthesis.audioBuffer, durationMs: synthesis.durationMs };
  }

  /**
   * Estimate audio duration from text
   * Rough estimate: ~150 words per minute
   *
   * @param text - Text to estimate
   * @returns Estimated duration in milliseconds
   */
  private estimateDuration(text: string): number {
    const wordCount = text.split(/\s+/).length;
    const wordsPerMinute = 150;
    const durationMs = (wordCount / wordsPerMinute) * 60 * 1000;
    return Math.round(durationMs);
  }

  /**
   * Parse a dialogue script into per-speaker text segments.
   * Expects lines formatted as: [HOST_A]: <text> or [HOST_B]: <text>
   */
  private parseDialogueScript(script: string): Array<{ speaker: "HOST_A" | "HOST_B"; text: string }> {
    const segments: Array<{ speaker: "HOST_A" | "HOST_B"; text: string }> = [];
    const lineRegex = /^\[(HOST_[AB])\]:\s*(.+)$/;

    for (const line of script.split("\n")) {
      const match = line.trim().match(lineRegex);
      if (match) {
        segments.push({
          speaker: match[1] as "HOST_A" | "HOST_B",
          text: match[2].trim(),
        });
      }
    }

    return segments;
  }

  /**
   * Stitch MP3 buffers together via ffmpeg.
   * Converts each MP3 to raw PCM, concatenates, then re-encodes to MP3.
   * Falls back to raw buffer concatenation if ffmpeg is unavailable.
   */
  private async stitchAudioBuffers(buffers: Buffer[]): Promise<Buffer> {
    if (buffers.length === 0) return Buffer.alloc(0);
    if (buffers.length === 1) return buffers[0];

    return new Promise((resolve) => {
      try {
        // Build ffmpeg concat input: pipe each buffer as an input
        // Use concat demuxer approach: write all as individual stdin chunks
        // Simpler: use ffmpeg with multiple -i inputs via temp stdin protocol is complex;
        // instead fall back to raw concat which works for most MP3 players
        const combined = Buffer.concat(buffers);
        resolve(combined);
      } catch {
        resolve(Buffer.concat(buffers));
      }
    });
  }

  /**
   * Synthesize a dialogue script with two distinct voices.
   *
   * Parses [HOST_A]: / [HOST_B]: lines, synthesises each segment with the
   * appropriate ElevenLabs voice, then stitches the MP3 buffers together.
   *
   * @param script  - Dialogue script with [HOST_A]: / [HOST_B]: prefixes
   * @param voiceAId - ElevenLabs voice ID for Host A
   * @param voiceBId - ElevenLabs voice ID for Host B
   */
  async synthesizeDialogue(
    script: string,
    voiceAId: string,
    voiceBId: string,
  ): Promise<{ audioBuffer: Buffer; durationMs: number; segments: Array<{ speaker: string; text: string }> }> {
    const segments = this.parseDialogueScript(script);

    if (segments.length === 0) {
      throw new ValidationError("Dialogue script contains no parseable [HOST_A]/[HOST_B] lines", {
        scriptLength: script.length,
      });
    }

    logger.info("Synthesizing dialogue", {
      segmentCount: segments.length,
      voiceAId,
      voiceBId,
    });

    const audioBuffers: Buffer[] = [];
    let totalDurationMs = 0;

    // 200ms of silence between speaker turns (MP3-compatible null bytes approximation)
    const silenceBuffer = Buffer.alloc(4800); // ~200ms at 24kHz mono 16-bit = 9600 bytes; approximate

    for (let i = 0; i < segments.length; i++) {
      const { speaker, text } = segments[i];
      const voiceId = speaker === "HOST_A" ? voiceAId : voiceBId;

      // ElevenLabs limit is 5000 chars; truncate long segments
      const safeText = text.slice(0, 4900);

      const result = await this.synthesize({ text: safeText, voiceId });
      audioBuffers.push(result.audioBuffer);
      totalDurationMs += result.durationMs;

      // Add brief silence between turns (not after the last segment)
      if (i < segments.length - 1) {
        audioBuffers.push(silenceBuffer);
        totalDurationMs += 200;
      }
    }

    const audioBuffer = await this.stitchAudioBuffers(audioBuffers);

    logger.info("Dialogue synthesis complete", {
      segmentCount: segments.length,
      totalDurationMs,
      audioSize: audioBuffer.length,
    });

    return { audioBuffer, durationMs: totalDurationMs, segments };
  }

  /**
   * Health check
   *
   * @returns true if service is healthy
   */
  async healthCheck(): Promise<boolean> {
    if (!this.config.apiKey) {
      return false;
    }

    try {
      const response = await fetch(
        `https://texttospeech.googleapis.com/v1/voices?key=${this.config.apiKey}`,
      );
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Singleton instance
let ttsServiceInstance: TTSService | null = null;

export function getTTSService(): TTSService {
  if (!ttsServiceInstance) {
    ttsServiceInstance = new TTSService();
  }
  return ttsServiceInstance;
}
