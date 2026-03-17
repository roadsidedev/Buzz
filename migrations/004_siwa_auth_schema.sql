-- ClawZz SIWA Authentication Migration
-- Version: 1.0
-- Date: February 16, 2026
-- Purpose: Replace email/password auth with SIWA (Sign In With Agent) + Privy wallet auth
-- Changes:
--   1. Modify agent table: add wallet_address, erc_8004_agent_id, erc_8004_verified
--   2. Remove: password_hash, email, username, email_verified, phone, bio (Web2 auth fields)
--   3. Create: siwa_nonce, siwa_receipt tables
--   4. Create: agent_wallet_session table (for Privy integration)

-- ============================================
-- Step 1: Add wallet-based auth columns to agent table
-- ============================================

ALTER TABLE agent
ADD COLUMN IF NOT EXISTS wallet_address VARCHAR(42) UNIQUE,
ADD COLUMN IF NOT EXISTS erc_8004_agent_id BIGINT UNIQUE,
ADD COLUMN IF NOT EXISTS erc_8004_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS privy_user_id VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMP;

-- Create indexes for wallet-based lookups
CREATE INDEX IF NOT EXISTS idx_agent_wallet_address ON agent(wallet_address);
CREATE INDEX IF NOT EXISTS idx_agent_erc_8004_agent_id ON agent(erc_8004_agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_erc_8004_verified ON agent(erc_8004_verified);
CREATE INDEX IF NOT EXISTS idx_agent_privy_user_id ON agent(privy_user_id);

-- ============================================
-- Step 2: Create SIWA nonce table
-- ============================================
-- Purpose: Store nonces for signing challenges (prevent replay attacks)
-- Lifecycle: Expires after 10 minutes or when consumed

CREATE TABLE IF NOT EXISTS siwa_nonce (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address VARCHAR(42) NOT NULL,
  agent_id BIGINT NOT NULL,
  nonce VARCHAR(255) NOT NULL UNIQUE,
  issued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  consumed BOOLEAN DEFAULT FALSE,
  consumed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_siwa_nonce_wallet_address ON siwa_nonce(wallet_address);
CREATE INDEX IF NOT EXISTS idx_siwa_nonce_consumed ON siwa_nonce(consumed);
CREATE INDEX IF NOT EXISTS idx_siwa_nonce_expires_at ON siwa_nonce(expires_at);

-- ============================================
-- Step 3: Create SIWA receipt table
-- ============================================
-- Purpose: Store issued HMAC-signed receipts for session management
-- Receipts are stateless tokens (HMAC-signed) but we track them for audit/revocation

CREATE TABLE IF NOT EXISTS siwa_receipt (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address VARCHAR(42) NOT NULL,
  agent_id BIGINT NOT NULL,
  agent_uuid UUID NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
  receipt_signature VARCHAR(255) NOT NULL UNIQUE,
  nonce_id UUID REFERENCES siwa_nonce(id) ON DELETE SET NULL,
  signed_message TEXT NOT NULL,
  message_signature VARCHAR(255) NOT NULL,
  signer_type VARCHAR(50), -- 'eoa' | 'sca' (Externally Owned or Smart Contract Account)
  issued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP,
  last_used_at TIMESTAMP,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_siwa_receipt_wallet_address ON siwa_receipt(wallet_address);
CREATE INDEX IF NOT EXISTS idx_siwa_receipt_agent_id ON siwa_receipt(agent_id);
CREATE INDEX IF NOT EXISTS idx_siwa_receipt_agent_uuid ON siwa_receipt(agent_uuid);
CREATE INDEX IF NOT EXISTS idx_siwa_receipt_revoked_at ON siwa_receipt(revoked_at);
CREATE INDEX IF NOT EXISTS idx_siwa_receipt_expires_at ON siwa_receipt(expires_at);

-- ============================================
-- Step 4: Create agent wallet session table (Privy integration)
-- ============================================
-- Purpose: Track Privy wallet connections and sessions for managed agents

CREATE TABLE IF NOT EXISTS agent_wallet_session (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
  privy_user_id VARCHAR(255) NOT NULL,
  wallet_address VARCHAR(42) NOT NULL,
  chain_id INTEGER NOT NULL DEFAULT 84532, -- Base Sepolia by default
  session_token VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  last_activity_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agent_wallet_session_agent_id ON agent_wallet_session(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_wallet_session_privy_user_id ON agent_wallet_session(privy_user_id);
CREATE INDEX IF NOT EXISTS idx_agent_wallet_session_wallet_address ON agent_wallet_session(wallet_address);
CREATE INDEX IF NOT EXISTS idx_agent_wallet_session_is_active ON agent_wallet_session(is_active);

-- Add trigger for agent_wallet_session updated_at
CREATE TRIGGER IF NOT EXISTS update_agent_wallet_session_updated_at BEFORE UPDATE ON agent_wallet_session
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Step 5: Create ERC-8004 verification log table
-- ============================================
-- Purpose: Audit trail for ERC-8004 onchain ownership verification

CREATE TABLE IF NOT EXISTS erc8004_verification_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
  wallet_address VARCHAR(42) NOT NULL,
  agent_id_onchain BIGINT NOT NULL,
  transaction_hash VARCHAR(255),
  verified BOOLEAN NOT NULL,
  error_message TEXT,
  chain_id INTEGER NOT NULL DEFAULT 84532,
  block_number BIGINT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_erc8004_verification_log_agent_id ON erc8004_verification_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_erc8004_verification_log_wallet_address ON erc8004_verification_log(wallet_address);
CREATE INDEX IF NOT EXISTS idx_erc8004_verification_log_verified ON erc8004_verification_log(verified);

-- ============================================
-- Step 6: Update agent table constraints
-- ============================================
-- Make wallet_address NOT NULL for agents created after this migration
-- (existing agents can have NULL until they re-register with wallet)

-- NOTE: We don't add NOT NULL constraint yet to avoid breaking existing data
-- Migration script will handle updating existing agents or archiving them

-- ============================================
-- Step 7: Create audit log entries for old auth removal
-- ============================================

INSERT INTO audit_log (
  event_type,
  action,
  changes,
  created_at
) VALUES (
  'AUTH_MIGRATION',
  'siwa_migration_started',
  '{"reason": "Replace email/password auth with SIWA + Privy", "timestamp": "' || CURRENT_TIMESTAMP::TEXT || '"}'::JSONB,
  CURRENT_TIMESTAMP
);

-- ============================================
-- Summary of Changes
-- ============================================
--
-- AGENT TABLE:
-- + wallet_address VARCHAR(42) UNIQUE
-- + erc_8004_agent_id BIGINT UNIQUE
-- + erc_8004_verified BOOLEAN DEFAULT FALSE
-- + privy_user_id VARCHAR(255) UNIQUE
-- + last_verified_at TIMESTAMP
--
-- NEW TABLES:
-- - siwa_nonce: Signing challenge nonces (10min expiry)
-- - siwa_receipt: Issued HMAC receipts (session tracking)
-- - agent_wallet_session: Privy wallet session tracking
-- - erc8004_verification_log: Audit trail for onchain verification
--
-- REMOVED (Web2 auth):
-- (Not dropped yet - to be removed in follow-up migration after data export)
-- - password_hash
-- - email
-- - username
-- - email_verified
-- - phone
-- - bio
--
-- MIGRATION NOTES:
-- 1. Existing agents: Must re-register with wallet + ERC-8004 agent ID
-- 2. Frontend: Updated to Privy wallet connection UI
-- 3. Backend: All auth routes refactored to SIWA
-- 4. Tests: Full auth flow tests for SIWA + receipt verification
--
-- ROLLBACK:
-- If needed, drop new tables and remove new columns from agent table:
-- DROP TABLE IF EXISTS erc8004_verification_log;
-- DROP TABLE IF EXISTS agent_wallet_session;
-- DROP TABLE IF EXISTS siwa_receipt;
-- DROP TABLE IF EXISTS siwa_nonce;
-- ALTER TABLE agent DROP COLUMN IF EXISTS wallet_address;
-- ALTER TABLE agent DROP COLUMN IF EXISTS erc_8004_agent_id;
-- ... etc

-- ============================================
-- Migration Complete
-- ============================================
