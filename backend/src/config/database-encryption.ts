/**
 * Database Encryption at Rest
 *
 * Encrypts sensitive data columns in PostgreSQL:
 * - Agent API keys
 * - Payment information
 * - Personal user data
 * - Session tokens
 *
 * Approaches:
 * 1. Application-level encryption (implemented here)
 * 2. Transparent Data Encryption (TDE) via PostgreSQL pgcrypto extension
 * 3. Database-level encryption (provider-dependent, e.g., AWS RDS encryption)
 *
 * @see https://www.postgresql.org/docs/current/pgcrypto.html
 */

import crypto from "crypto";
import { logger } from "../utils/logger.js";

/**
 * Encryption key for sensitive data
 *
 * IMPORTANT: This should be rotated periodically
 * Phase 5: Implement key rotation strategy
 */
const ENCRYPTION_KEY = process.env.DATA_ENCRYPTION_KEY;
const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const AUTH_TAG_LENGTH = 16;
const IV_LENGTH = 16;

if (!ENCRYPTION_KEY) {
  throw new Error(
    "DATA_ENCRYPTION_KEY environment variable is required for database encryption"
  );
}

// Ensure key is 32 bytes (256 bits)
const keyBuffer = crypto
  .createHash("sha256")
  .update(ENCRYPTION_KEY)
  .digest();

/**
 * Encrypt sensitive data using AES-256-GCM
 *
 * @param plaintext - Data to encrypt
 * @returns Encrypted data as base64 string (format: iv:authTag:ciphertext)
 *
 * Example:
 * ```typescript
 * const encrypted = encryptSensitiveData(apiKey);
 * // Store encrypted value in database
 * ```
 */
export function encryptSensitiveData(plaintext: string): string {
  try {
    // Generate random initialization vector
    const iv = crypto.randomBytes(IV_LENGTH);

    // Create cipher
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, keyBuffer, iv);

    // Encrypt
    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");

    // Get authentication tag (prevents tampering)
    const authTag = cipher.getAuthTag();

    // Return as: base64(iv:authTag:ciphertext)
    const result = `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
    return Buffer.from(result).toString("base64");
  } catch (error) {
    logger.error("Encryption failed", error);
    throw new Error("Failed to encrypt sensitive data");
  }
}

/**
 * Decrypt sensitive data
 *
 * @param encrypted - Encrypted data from database (base64 format)
 * @returns Decrypted plaintext
 *
 * Example:
 * ```typescript
 * const apiKey = decryptSensitiveData(encryptedValue);
 * ```
 */
export function decryptSensitiveData(encrypted: string): string {
  try {
    // Decode from base64
    const decoded = Buffer.from(encrypted, "base64").toString();

    // Split components
    const [ivHex, authTagHex, ciphertext] = decoded.split(":");

    if (!ivHex || !authTagHex || !ciphertext) {
      throw new Error("Invalid encrypted data format");
    }

    // Convert back to buffers
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");

    // Create decipher
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, keyBuffer, iv);
    decipher.setAuthTag(authTag);

    // Decrypt
    let decrypted = decipher.update(ciphertext, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    logger.error("Decryption failed", error);
    throw new Error("Failed to decrypt sensitive data");
  }
}

/**
 * Encrypt API keys before storing in database
 *
 * @param apiKey - Plain API key
 * @returns Encrypted API key
 */
export function encryptApiKey(apiKey: string): string {
  return encryptSensitiveData(apiKey);
}

/**
 * Decrypt API key from database
 *
 * @param encryptedKey - Encrypted API key from database
 * @returns Plain API key
 */
export function decryptApiKey(encryptedKey: string): string {
  return decryptSensitiveData(encryptedKey);
}

/**
 * Encrypt payment information
 *
 * @param cardData - Credit card or payment data
 * @returns Encrypted payment data
 */
export function encryptPaymentData(cardData: string): string {
  return encryptSensitiveData(cardData);
}

/**
 * Decrypt payment information
 *
 * @param encryptedData - Encrypted payment data from database
 * @returns Plain payment data
 */
export function decryptPaymentData(encryptedData: string): string {
  return decryptSensitiveData(encryptedData);
}

/**
 * Encrypt personally identifiable information (PII)
 *
 * @param pii - PII to encrypt (email, phone, etc.)
 * @returns Encrypted PII
 */
export function encryptPII(pii: string): string {
  return encryptSensitiveData(pii);
}

/**
 * Decrypt PII
 *
 * @param encryptedPii - Encrypted PII from database
 * @returns Plain PII
 */
export function decryptPII(encryptedPii: string): string {
  return decryptSensitiveData(encryptedPii);
}

/**
 * PostgreSQL pgcrypto Extension Usage
 *
 * For database-level encryption (doesn't require app-level decryption):
 *
 * ```sql
 * -- Enable pgcrypto extension
 * CREATE EXTENSION pgcrypto;
 *
 * -- Create encrypted column
 * ALTER TABLE agent ADD COLUMN api_key_encrypted bytea;
 *
 * -- Encrypt data
 * UPDATE agent
 * SET api_key_encrypted = pgp_pub_encrypt(api_key, keys.pub)
 * FROM keys
 * WHERE agent.id = keys.agent_id;
 *
 * -- Decrypt in query
 * SELECT pgp_pub_decrypt(api_key_encrypted, keys.priv) as api_key
 * FROM agent
 * JOIN keys ON agent.id = keys.agent_id;
 * ```
 *
 * Benefits:
 * - Encryption happens in database, not in app
 * - Keys never leave database server
 * - Reduced app performance overhead
 *
 * Drawbacks:
 * - Can't efficiently search encrypted columns
 * - Slower than app-level encryption
 * - Requires key management in database
 */

/**
 * Transparent Data Encryption (TDE)
 *
 * Database providers offer automatic encryption:
 * - AWS RDS: Enable encryption at rest
 * - Azure Database: Transparent Data Encryption
 * - Google Cloud SQL: Cloud KMS integration
 *
 * These encrypt the entire database without app changes.
 */

/**
 * Phase 5: Key Rotation Strategy
 *
 * Implement periodic key rotation:
 * 1. Generate new encryption key
 * 2. Re-encrypt all data with new key
 * 3. Retire old key after verification
 * 4. Maintain key version for decryption
 *
 * ```typescript
 * interface EncryptedData {
 *   version: number; // Key version
 *   data: string; // Encrypted data
 * }
 *
 * export function encryptWithVersion(plaintext: string, version: number): EncryptedData {
 *   return {
 *     version,
 *     data: encryptSensitiveData(plaintext),
 *   };
 * }
 *
 * export function decryptWithVersion(encrypted: EncryptedData): string {
 *   // Load key based on version
 *   const key = getEncryptionKey(encrypted.version);
 *   return decrypt(encrypted.data, key);
 * }
 * ```
 */

/**
 * Phase 5: Hardware Security Module (HSM)
 *
 * For maximum security, store encryption keys in HSM:
 * - Keys never leave HSM
 * - Encryption happens in HSM
 * - Requires HSM-specific client library
 *
 * Providers:
 * - AWS CloudHSM
 * - Azure Dedicated HSM
 * - Thales Luna HSM
 */

/**
 * Tokenization Alternative
 *
 * Instead of encrypting sensitive data, use tokenization:
 * 1. Send sensitive data to tokenization service
 * 2. Receive opaque token in return
 * 3. Store token in database (original data never stored)
 * 4. To decrypt, call tokenization service
 *
 * Providers:
 * - PCI Compliance Tokenizers
 * - Stripe Tokenization
 * - Payment gateway tokenization
 *
 * Benefits:
 * - Original data never stored locally
 * - Reduced PCI compliance scope
 * - Easy to revoke tokens
 *
 * Drawbacks:
 * - Dependency on external service
 * - Network latency
 * - Service availability critical
 */

logger.info("✅ Database encryption initialized", {
  algorithm: ENCRYPTION_ALGORITHM,
  keyLength: 256,
  keyHash: crypto.createHash("sha256").update(ENCRYPTION_KEY).digest("hex").substring(0, 16),
});
