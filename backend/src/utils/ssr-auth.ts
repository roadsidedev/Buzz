/**
 * SSR (Simple Signed Records) Authentication Utility
 *
 * Implements Ed25519-based authentication for Jam self-hosted integration.
 * This replaces the API-key based authentication with cryptographic signatures.
 *
 * Strategy:
 * - PRIMARY: Derive keypair from ERC-8004 on-chain identity (stateless)
 * - FALLBACK: Generate and store encrypted keypair in database
 */

import * as ed from "@noble/ed25519";
import {
  createHash,
  randomBytes,
  createCipheriv,
  createDecipheriv,
} from "crypto";
import logger from "./logger.js";

export interface AgentKeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
  publicKeyBase64: string;
  privateKeyBase64: string;
}

export interface SignedRecord {
  Certified: string;
  signatures: Array<{
    publicKey: string;
    signature: string;
  }>;
}

export interface SSRAuthConfig {
  encryptionSecret: string;
}

/**
 * Generate a new Ed25519 keypair
 */
export async function generateKeypair(): Promise<AgentKeyPair> {
  const privateKey = ed.utils.randomSecretKey();
  const publicKey = await ed.getPublicKeyAsync(privateKey);

  return {
    publicKey,
    privateKey,
    publicKeyBase64: Buffer.from(publicKey).toString("base64"),
    privateKeyBase64: Buffer.from(privateKey).toString("base64"),
  };
}

/**
 * Derive Ed25519 keypair from ERC-8004 identity
 *
 * Uses a deterministic derivation from the on-chain identity,
 * making it stateless (no need to store keys in database).
 *
 * @param erc8004Identity - The ERC-8004 token ID or contract address
 * @param agentId - The agent's unique identifier
 * @param salt - Optional salt for additional entropy
 */
export async function deriveKeypairFromERC8004(
  erc8004Identity: string,
  agentId: string,
  salt?: string,
): Promise<AgentKeyPair> {
  const seed = createHash("sha256")
    .update(`${erc8004Identity}:${agentId}:${salt || "clawzz-jam"}`)
    .digest();

  const privateKey = ed.utils.randomSecretKey();
  for (let i = 0; i < 32; i++) {
    privateKey[i] = seed[i];
  }

  const publicKey = await ed.getPublicKeyAsync(privateKey);

  logger.debug("Derived keypair from ERC-8004 identity", {
    agentId,
    publicKeyPrefix: Buffer.from(publicKey).toString("hex").slice(0, 16),
  });

  return {
    publicKey,
    privateKey,
    publicKeyBase64: Buffer.from(publicKey).toString("base64"),
    privateKeyBase64: Buffer.from(privateKey).toString("base64"),
  };
}

/**
 * Sign a payload with Ed25519 private key
 *
 * Creates a Simple Signed Record (SSR) compatible with Jam authentication.
 */
export async function signPayload(
  privateKey: Uint8Array,
  payload: object,
): Promise<SignedRecord> {
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const signature = await ed.signAsync(payloadBytes, privateKey);
  const publicKey = await ed.getPublicKeyAsync(privateKey);

  return {
    Certified: Buffer.from(JSON.stringify(payload)).toString("base64"),
    signatures: [
      {
        publicKey: Buffer.from(publicKey).toString("base64"),
        signature: Buffer.from(signature).toString("base64"),
      },
    ],
  };
}

/**
 * Verify a signed payload
 */
export async function verifySignature(
  signedRecord: SignedRecord,
): Promise<{ valid: boolean; payload?: object; error?: string }> {
  try {
    const { Certified, signatures } = signedRecord;

    if (!signatures || signatures.length === 0) {
      return { valid: false, error: "No signatures provided" };
    }

    const { publicKey, signature } = signatures[0];
    const publicKeyBytes = Buffer.from(publicKey, "base64");
    const signatureBytes = Buffer.from(signature, "base64");

    const payloadJson = Buffer.from(Certified, "base64").toString("utf8");
    const payloadBytes = new TextEncoder().encode(payloadJson);

    const isValid = await ed.verifyAsync(
      signatureBytes,
      payloadBytes,
      publicKeyBytes,
    );

    if (!isValid) {
      return { valid: false, error: "Signature verification failed" };
    }

    return {
      valid: true,
      payload: JSON.parse(payloadJson),
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Create auth header for HTTP requests
 */
export function createAuthHeader(signedRecord: SignedRecord): string {
  return JSON.stringify(signedRecord);
}

/**
 * Create auth token for WebSocket connections
 */
export async function createAuthToken(keyPair: AgentKeyPair): Promise<string> {
  const payload = {
    id: keyPair.publicKeyBase64,
    timestamp: Date.now(),
    nonce: randomBytes(16).toString("hex"),
  };

  const signedRecord = await signPayload(keyPair.privateKey, payload);
  return Buffer.from(JSON.stringify(signedRecord)).toString("base64");
}

/**
 * Encrypt private key for database storage (fallback method)
 */
export function encryptPrivateKey(
  privateKeyBase64: string,
  encryptionSecret: string,
): string {
  const key = createHash("sha256").update(encryptionSecret).digest();
  const iv = randomBytes(16);

  const cipher = createCipheriv("aes-256-gcm", key, iv);

  let encrypted = cipher.update(privateKeyBase64, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypt private key from database storage
 */
export async function decryptPrivateKey(
  encryptedData: string,
  encryptionSecret: string,
): Promise<string> {
  const [ivHex, authTagHex, encrypted] = encryptedData.split(":");

  const key = createHash("sha256").update(encryptionSecret).digest();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const crypto = await import("crypto");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Get or create agent keypair
 *
 * PRIMARY: Derive from ERC-8004 identity (stateless)
 * FALLBACK: Use stored encrypted keypair or generate new one
 */
export async function getAgentKeypair(options: {
  agentId: string;
  erc8004Identity?: string;
  storedPublicKey?: string;
  storedPrivateKeyEncrypted?: string;
  encryptionSecret: string;
}): Promise<AgentKeyPair> {
  const {
    agentId,
    erc8004Identity,
    storedPublicKey,
    storedPrivateKeyEncrypted,
    encryptionSecret,
  } = options;

  // PRIMARY: Derive from ERC-8004 identity
  if (erc8004Identity) {
    logger.debug("Deriving keypair from ERC-8004 identity", { agentId });
    return deriveKeypairFromERC8004(erc8004Identity, agentId);
  }

  // FALLBACK: Use stored encrypted keypair
  if (storedPublicKey && storedPrivateKeyEncrypted) {
    logger.debug("Using stored encrypted keypair", { agentId });
    const privateKeyBase64 = await decryptPrivateKey(
      storedPrivateKeyEncrypted,
      encryptionSecret,
    );
    const privateKey = Buffer.from(privateKeyBase64, "base64");
    const publicKey = Buffer.from(storedPublicKey, "base64");

    return {
      publicKey,
      privateKey,
      publicKeyBase64: storedPublicKey,
      privateKeyBase64,
    };
  }

  // GENERATE: Create new keypair (should be stored after)
  logger.info("Generating new keypair for agent", { agentId });
  return generateKeypair();
}

/**
 * Generate Jam identity ID from public key
 */
export function generateJamIdentityId(publicKeyBase64: string): string {
  return createHash("sha256")
    .update(publicKeyBase64)
    .digest("hex")
    .slice(0, 32);
}
