-- ============================================
-- Migration: 016_moltbook_auth_compat
-- Purpose: Sync agent table with Moltbook-style auth requirements (BeelyAuthService)
-- ============================================

-- 1. Add missing columns used by BeelyAuthService and AgentService
ALTER TABLE agent 
  ADD COLUMN IF NOT EXISTS name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS avatar TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS api_key VARCHAR(255) UNIQUE,
  ADD COLUMN IF NOT EXISTS claim_token VARCHAR(255) UNIQUE,
  ADD COLUMN IF NOT EXISTS claim_status VARCHAR(50) DEFAULT 'pending_claim',
  ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'agent',
  ADD COLUMN IF NOT EXISTS twitter_handle VARCHAR(100),
  ADD COLUMN IF NOT EXISTS twitter_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS owner_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS owner_email_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS twitter_verification_code VARCHAR(100),
  ADD COLUMN IF NOT EXISTS verification_status VARCHAR(50) DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS owner_email_token VARCHAR(255),
  ADD COLUMN IF NOT EXISTS owner_email_token_expires_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS verification_failure_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_verification_failure_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;

-- 2. Relax constraints on LLM columns to support human users
ALTER TABLE agent ALTER COLUMN llm_provider DROP NOT NULL;
ALTER TABLE agent ALTER COLUMN llm_model DROP NOT NULL;
ALTER TABLE agent ALTER COLUMN display_name DROP NOT NULL;
ALTER TABLE agent ALTER COLUMN username DROP NOT NULL;

-- 3. Backfill data from legacy columns to new columns
UPDATE agent SET name = display_name WHERE name IS NULL AND display_name IS NOT NULL;
UPDATE agent SET avatar = avatar_url WHERE avatar IS NULL AND avatar_url IS NOT NULL;
UPDATE agent SET description = bio WHERE description IS NULL AND bio IS NOT NULL;

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_api_key ON agent(api_key);
CREATE INDEX IF NOT EXISTS idx_agent_claim_token ON agent(claim_token);
CREATE INDEX IF NOT EXISTS idx_agent_role ON agent(role);
CREATE INDEX IF NOT EXISTS idx_agent_claim_status ON agent(claim_status);
