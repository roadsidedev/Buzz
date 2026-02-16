/**
 * Database Encryption Migration
 * Adds encrypted columns for sensitive fields
 *
 * Strategy:
 * 1. Add new encrypted columns (agent_wallet_address_enc, etc.)
 * 2. Backfill existing data (encrypted)
 * 3. Verify migration
 * 4. Drop old plaintext columns
 * 5. Rename encrypted columns to original names
 *
 * Run in transaction to ensure atomicity
 */

BEGIN TRANSACTION;

-- ============================================================================
-- AGENT TABLE - Wallet Address Encryption
-- ============================================================================

-- Step 1: Add encrypted column
ALTER TABLE agent ADD COLUMN wallet_address_encrypted TEXT;

-- Step 2: Copy and encrypt existing data (will be done via application)
-- This is a placeholder - actual encryption happens in application code
-- UPDATE agent SET wallet_address_encrypted = pgcrypto.encrypt(wallet_address, 'key');

-- Step 3: Verify no null values in original column (if required)
-- SELECT COUNT(*) FROM agent WHERE wallet_address IS NULL;

-- ============================================================================
-- PAYMENT TABLE - Transaction Hash & Payer Address Encryption
-- ============================================================================

-- Add encrypted columns
ALTER TABLE payment ADD COLUMN transaction_hash_encrypted TEXT;
ALTER TABLE payment ADD COLUMN payer_address_encrypted TEXT;

-- ============================================================================
-- AUTHENTICATION TABLE - Optional: Email Encryption
-- ============================================================================

-- Add encrypted column (optional for GDPR compliance)
ALTER TABLE agent ADD COLUMN email_address_encrypted TEXT;

-- ============================================================================
-- ENCRYPTION METADATA TABLE
-- ============================================================================

-- Track which records have been encrypted for migration purposes
CREATE TABLE IF NOT EXISTS encryption_migration_log (
  id BIGSERIAL PRIMARY KEY,
  table_name VARCHAR(255) NOT NULL,
  column_name VARCHAR(255) NOT NULL,
  migrated_rows BIGINT NOT NULL DEFAULT 0,
  total_rows BIGINT NOT NULL,
  completed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(table_name, column_name)
);

-- Insert migration tracking records
INSERT INTO encryption_migration_log (table_name, column_name, total_rows)
SELECT 'agent', 'wallet_address', COUNT(*) FROM agent
ON CONFLICT (table_name, column_name) DO NOTHING;

INSERT INTO encryption_migration_log (table_name, column_name, total_rows)
SELECT 'payment', 'transaction_hash', COUNT(*) FROM payment
ON CONFLICT (table_name, column_name) DO NOTHING;

INSERT INTO encryption_migration_log (table_name, column_name, total_rows)
SELECT 'payment', 'payer_address', COUNT(*) FROM payment
ON CONFLICT (table_name, column_name) DO NOTHING;

-- ============================================================================
-- INDEXES (for encrypted columns)
-- ============================================================================

-- Note: Encrypted data cannot be efficiently searched
-- Consider using deterministic encryption if searching is needed
-- For now, we skip indexes on encrypted columns

-- ============================================================================
-- VIEWS FOR BACKWARD COMPATIBILITY (Optional)
-- ============================================================================

-- Create a view that decrypts on-the-fly (performance cost)
-- This is optional and only for development
-- In production, application should handle decryption

-- CREATE VIEW agent_decrypted AS
-- SELECT 
--   id,
--   (CASE WHEN wallet_address_encrypted IS NOT NULL 
--     THEN decrypt(wallet_address_encrypted, 'key')
--     ELSE wallet_address 
--    END) as wallet_address,
--   ...
-- FROM agent;

-- ============================================================================
-- MIGRATION STATUS
-- ============================================================================

-- Print migration status
SELECT 
  'Encryption Migration Status' as migration,
  COUNT(*) as pending_migrations
FROM encryption_migration_log
WHERE completed_at IS NULL;

COMMIT;

-- ============================================================================
-- NEXT STEPS (Application-driven encryption)
-- ============================================================================

/*
After running this migration:

1. Run application migration script:
   node scripts/migrate-encrypt-database.ts

2. This script will:
   - Fetch all plaintext records
   - Encrypt sensitive fields
   - Update encrypted columns
   - Update migration_log table
   - Verify encryption success

3. Once migration complete, run cleanup:
   - ALTER TABLE agent DROP COLUMN wallet_address;
   - ALTER TABLE agent RENAME wallet_address_encrypted TO wallet_address;
   - UPDATE encryption_migration_log SET completed_at = NOW();

4. Verify migration:
   SELECT COUNT(*) FROM agent WHERE wallet_address LIKE '%==%' (should see encrypted data)

5. Update code to use encryption hooks:
   - Use encryptDatabaseField() on insert
   - Use decryptDatabaseField() on read
*/
