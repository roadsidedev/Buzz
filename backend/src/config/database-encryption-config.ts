/**
 * Database Encryption Configuration
 * Defines which database fields should be encrypted
 * and provides encryption/decryption hooks
 */

import { encryptField, decryptField } from "../utils/encryption.js";
import { logger } from "../utils/logger.js";

/**
 * Encryption key from environment
 * Must be set in production via GCP Secret Manager
 */
function getEncryptionKey(): string {
  const key = process.env.DB_ENCRYPTION_KEY;
  if (!key && process.env.NODE_ENV === "production") {
    throw new Error(
      "DB_ENCRYPTION_KEY is required in production. " +
      "Set it in GCP Secret Manager or environment variables.",
    );
  }
  if (!key) {
    logger.warn(
      "DB_ENCRYPTION_KEY not set. " +
      "Database encryption disabled for development. " +
      "Set DB_ENCRYPTION_KEY to enable encryption.",
    );
    return "";
  }
  return key;
}

/**
 * Definition of which fields should be encrypted
 * Format: { table: { column: true } }
 */
export const ENCRYPTED_FIELDS = {
  agent: {
    wallet_address: true,
    email_address: false, // Optional: encrypt email if needed
  },
  room: {
    // Room fields to encrypt (if any)
  },
  payment: {
    transaction_hash: true,
    payer_address: true,
  },
  transcript: {
    // Transcript fields (optional)
  },
} as const;

/**
 * Check if a field should be encrypted
 * @param table - Table name
 * @param column - Column name
 * @returns true if field should be encrypted
 */
export function isEncryptedField(table: string, column: string): boolean {
  const tableConfig = ENCRYPTED_FIELDS[table as keyof typeof ENCRYPTED_FIELDS];
  if (!tableConfig) return false;

  const shouldEncrypt =
    tableConfig[column as keyof typeof tableConfig];
  return shouldEncrypt === true;
}

/**
 * Encrypt a field value
 * @param table - Table name
 * @param column - Column name
 * @param value - Value to encrypt
 * @returns Encrypted value if field is configured for encryption, otherwise original value
 */
export function encryptDatabaseField(
  table: string,
  column: string,
  value: string | null | undefined,
): string | null | undefined {
  if (!value) {
    return value; // Don't encrypt null/undefined/empty values
  }

  if (!isEncryptedField(table, column)) {
    return value; // Not configured for encryption
  }

  const key = getEncryptionKey();
  if (!key) {
    logger.warn(
      `Field ${table}.${column} should be encrypted but DB_ENCRYPTION_KEY is not set`,
    );
    return value;
  }

  try {
    return encryptField(value, key);
  } catch (error) {
    logger.error(`Failed to encrypt ${table}.${column}`, {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Decrypt a field value
 * @param table - Table name
 * @param column - Column name
 * @param value - Encrypted value to decrypt
 * @returns Decrypted value if field is configured for encryption, otherwise original value
 */
export function decryptDatabaseField(
  table: string,
  column: string,
  value: string | null | undefined,
): string | null | undefined {
  if (!value) {
    return value; // Can't decrypt null/undefined/empty values
  }

  if (!isEncryptedField(table, column)) {
    return value; // Not configured for encryption
  }

  const key = getEncryptionKey();
  if (!key) {
    logger.warn(
      `Field ${table}.${column} is encrypted but DB_ENCRYPTION_KEY is not set. ` +
      `Cannot decrypt.`,
    );
    return value;
  }

  try {
    return decryptField(value, key);
  } catch (error) {
    logger.error(`Failed to decrypt ${table}.${column}`, {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Encrypt an entire object based on configuration
 * Useful for batch operations
 *
 * @param table - Table name
 * @param record - Record with fields to encrypt
 * @returns Record with encrypted fields
 */
export function encryptDatabaseRecord(
  table: string,
  record: Record<string, any>,
): Record<string, any> {
  const encrypted = { ...record };

  const tableConfig = ENCRYPTED_FIELDS[table as keyof typeof ENCRYPTED_FIELDS];
  if (!tableConfig) {
    return encrypted;
  }

  for (const [column] of Object.entries(tableConfig)) {
    if (encrypted[column] && isEncryptedField(table, column)) {
      encrypted[column] = encryptDatabaseField(table, column, encrypted[column]);
    }
  }

  return encrypted;
}

/**
 * Decrypt an entire object based on configuration
 * Useful for batch operations
 *
 * @param table - Table name
 * @param record - Record with encrypted fields
 * @returns Record with decrypted fields
 */
export function decryptDatabaseRecord(
  table: string,
  record: Record<string, any>,
): Record<string, any> {
  const decrypted = { ...record };

  const tableConfig = ENCRYPTED_FIELDS[table as keyof typeof ENCRYPTED_FIELDS];
  if (!tableConfig) {
    return decrypted;
  }

  for (const [column] of Object.entries(tableConfig)) {
    if (decrypted[column] && isEncryptedField(table, column)) {
      decrypted[column] = decryptDatabaseField(table, column, decrypted[column]);
    }
  }

  return decrypted;
}

/**
 * Get encryption status for logging
 */
export function getEncryptionStatus(): {
  enabled: boolean;
  fields: number;
  tables: number;
} {
  let totalFields = 0;

  for (const tableConfig of Object.values(ENCRYPTED_FIELDS)) {
    totalFields += Object.values(tableConfig).filter((v) => v === true).length;
  }

  return {
    enabled: !!getEncryptionKey(),
    fields: totalFields,
    tables: Object.keys(ENCRYPTED_FIELDS).length,
  };
}
