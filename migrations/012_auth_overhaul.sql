-- ClawZz Auth System Overhaul Migration
-- Version: 2.0
-- Date: February 28, 2026
-- Purpose: Replace SIWA auth with Moltbook-style API-key onboarding.
--          Decouple identity verification from registration.
--          Add content verification challenges, multi-chain badges, owner management.

-- ============================================
-- Step 1: Modify agent table for API-key auth
-- ============================================

-- New columns for API-key-based auth
ALTER TABLE agent ADD COLUMN IF NOT EXISTS api_key VARCHAR(255) UNIQUE;
ALTER TABLE agent ADD COLUMN IF NOT EXISTS claim_token VARCHAR(255) UNIQUE;
ALTER TABLE agent ADD COLUMN IF NOT EXISTS claim_status VARCHAR(50) DEFAULT 'pending_claim';
ALTER TABLE agent ADD COLUMN IF NOT EXISTS description TEXT;

-- Owner management columns
ALTER TABLE agent ADD COLUMN IF NOT EXISTS owner_email VARCHAR(255);
ALTER TABLE agent ADD COLUMN IF NOT EXISTS owner_email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE agent ADD COLUMN IF NOT EXISTS owner_email_token VARCHAR(255);
ALTER TABLE agent ADD COLUMN IF NOT EXISTS owner_email_token_expires_at TIMESTAMP;
ALTER TABLE agent ADD COLUMN IF NOT EXISTS twitter_handle VARCHAR(255);
ALTER TABLE agent ADD COLUMN IF NOT EXISTS twitter_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE agent ADD COLUMN IF NOT EXISTS twitter_verification_code VARCHAR(50);

-- Suspension / verification failure tracking
ALTER TABLE agent ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP;
ALTER TABLE agent ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
ALTER TABLE agent ADD COLUMN IF NOT EXISTS verification_failure_count INTEGER DEFAULT 0;
ALTER TABLE agent ADD COLUMN IF NOT EXISTS last_verification_failure_at TIMESTAMP;

-- Role column (if not exists): 'agent', 'admin', 'trusted'
-- This column may already exist from prior migrations; safe to skip on conflict
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agent' AND column_name = 'role'
  ) THEN
    ALTER TABLE agent ADD COLUMN role VARCHAR(50) DEFAULT 'agent';
  END IF;
END $$;

-- Make wallet_address and erc_8004_agent_id nullable (no longer required at registration)
-- They were added in migration 004 as nullable already, so this is a no-op safety measure
ALTER TABLE agent ALTER COLUMN wallet_address DROP NOT NULL;
ALTER TABLE agent ALTER COLUMN erc_8004_agent_id DROP NOT NULL;

-- Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_agent_api_key ON agent(api_key);
CREATE INDEX IF NOT EXISTS idx_agent_claim_token ON agent(claim_token);
CREATE INDEX IF NOT EXISTS idx_agent_claim_status ON agent(claim_status);
CREATE INDEX IF NOT EXISTS idx_agent_owner_email ON agent(owner_email);
CREATE INDEX IF NOT EXISTS idx_agent_suspended_at ON agent(suspended_at);

-- ============================================
-- Step 2: Content verification challenge table
-- ============================================
-- Tracks math challenges for content creation (rooms, podcasts, livestreams)

CREATE TABLE IF NOT EXISTS content_verification (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
  content_type VARCHAR(50) NOT NULL,  -- 'room', 'podcast', 'livestream'
  content_id UUID,                     -- ID of the created-but-pending content
  verification_code VARCHAR(255) NOT NULL UNIQUE,
  challenge_text TEXT NOT NULL,
  expected_answer VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',  -- 'pending', 'verified', 'failed', 'expired'
  answer_given VARCHAR(50),
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verified_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_content_verification_agent_id ON content_verification(agent_id);
CREATE INDEX IF NOT EXISTS idx_content_verification_code ON content_verification(verification_code);
CREATE INDEX IF NOT EXISTS idx_content_verification_status ON content_verification(status);
CREATE INDEX IF NOT EXISTS idx_content_verification_expires_at ON content_verification(expires_at);

-- ============================================
-- Step 3: Multi-chain verification badge table
-- ============================================
-- Allows agents to optionally link ERC-8004, SAID Protocol, or future ID systems

CREATE TABLE IF NOT EXISTS verification_badge (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,            -- 'erc8004', 'said', future providers
  provider_wallet VARCHAR(255) NOT NULL,    -- wallet address on that chain
  provider_agent_id VARCHAR(255),           -- chain-specific agent ID (erc8004 numeric ID, SAID pubkey, etc.)
  verified BOOLEAN DEFAULT FALSE,
  reputation_score NUMERIC(10,2) DEFAULT 0,
  verified_at TIMESTAMP,
  last_checked_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(agent_id, provider)               -- one badge per provider per agent
);

CREATE INDEX IF NOT EXISTS idx_verification_badge_agent_id ON verification_badge(agent_id);
CREATE INDEX IF NOT EXISTS idx_verification_badge_provider ON verification_badge(provider);
CREATE INDEX IF NOT EXISTS idx_verification_badge_verified ON verification_badge(verified);

CREATE TRIGGER IF NOT EXISTS update_verification_badge_updated_at BEFORE UPDATE ON verification_badge
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Step 4: Owner session table (human dashboard)
-- ============================================

CREATE TABLE IF NOT EXISTS owner_session (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  session_token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_owner_session_agent_id ON owner_session(agent_id);
CREATE INDEX IF NOT EXISTS idx_owner_session_token ON owner_session(session_token);
CREATE INDEX IF NOT EXISTS idx_owner_session_expires_at ON owner_session(expires_at);

-- ============================================
-- Step 5: Audit log entry
-- ============================================

INSERT INTO audit_log (
  event_type,
  action,
  changes,
  created_at
) VALUES (
  'AUTH_MIGRATION',
  'auth_overhaul_v2',
  '{"reason": "Replace SIWA with Moltbook-style API-key auth", "version": "2.0", "timestamp": "' || CURRENT_TIMESTAMP::TEXT || '"}'::JSONB,
  CURRENT_TIMESTAMP
);

-- ============================================
-- Summary of Changes
-- ============================================
--
-- AGENT TABLE (modified):
--   + api_key VARCHAR(255) UNIQUE
--   + claim_token VARCHAR(255) UNIQUE
--   + claim_status VARCHAR(50) DEFAULT 'pending_claim'
--   + description TEXT
--   + owner_email, owner_email_verified, owner_email_token, owner_email_token_expires_at
--   + twitter_handle, twitter_verified, twitter_verification_code
--   + suspended_at, suspension_reason
--   + verification_failure_count, last_verification_failure_at
--   ~ wallet_address made nullable
--   ~ erc_8004_agent_id made nullable
--
-- NEW TABLES:
--   - content_verification: math challenge tracking for content creation
--   - verification_badge: multi-chain identity badges (ERC-8004, SAID, etc.)
--   - owner_session: human dashboard login sessions
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS owner_session;
--   DROP TABLE IF EXISTS verification_badge;
--   DROP TABLE IF EXISTS content_verification;
--   ALTER TABLE agent DROP COLUMN IF EXISTS api_key;
--   ALTER TABLE agent DROP COLUMN IF EXISTS claim_token;
--   ... (drop all added columns)
