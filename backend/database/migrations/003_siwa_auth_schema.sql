-- ============================================
-- Migration: 003_siwa_auth_schema
-- Adds SIWA authentication columns to agent table
-- Creates siwa_nonce and siwa_receipt tables
-- ============================================

-- ============================================
-- 1. Add missing columns to agent table
-- The SIWA auth service expects these columns
-- ============================================

-- Agent name (used by SIWA service for registration)
ALTER TABLE agent 
ADD COLUMN IF NOT EXISTS name VARCHAR(255);

-- Wallet address for SIWA authentication
ALTER TABLE agent 
ADD COLUMN IF NOT EXISTS wallet_address VARCHAR(42) UNIQUE;

-- Avatar URL (SIWA service uses 'avatar' not 'avatar_url')
ALTER TABLE agent 
ADD COLUMN IF NOT EXISTS avatar TEXT;

-- ERC-8004 numeric agent ID (separate from erc8004_address)
ALTER TABLE agent 
ADD COLUMN IF NOT EXISTS erc_8004_agent_id INTEGER UNIQUE;

-- Verification status (pending, verified, failed)
ALTER TABLE agent 
ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT 'pending';

-- Whether ERC-8004 ownership is verified onchain
ALTER TABLE agent 
ADD COLUMN IF NOT EXISTS erc_8004_verified BOOLEAN DEFAULT FALSE;

-- Backfill: set name from display_name or username if not set
UPDATE agent 
SET name = COALESCE(display_name, username) 
WHERE name IS NULL;

-- Backfill: set wallet_address from erc8004_address if not set
UPDATE agent 
SET wallet_address = erc8004_address 
WHERE wallet_address IS NULL AND erc8004_address IS NOT NULL;

-- Index for wallet address lookups
CREATE INDEX IF NOT EXISTS idx_agent_wallet_address 
ON agent(wallet_address) WHERE wallet_address IS NOT NULL;

-- Index for ERC-8004 agent ID lookups
CREATE INDEX IF NOT EXISTS idx_agent_erc8004_agent_id 
ON agent(erc_8004_agent_id) WHERE erc_8004_agent_id IS NOT NULL;

-- ============================================
-- 2. SIWA Nonce Table
-- Stores nonces for SIWA signing challenges
-- ============================================
CREATE TABLE IF NOT EXISTS siwa_nonce (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address VARCHAR(42) NOT NULL,
    agent_id INTEGER NOT NULL,          -- ERC-8004 agent ID
    nonce VARCHAR(255) NOT NULL,
    issued_at TIMESTAMP WITH TIME ZONE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,   -- Set when nonce is consumed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for nonce lookups
CREATE INDEX IF NOT EXISTS idx_siwa_nonce_wallet 
ON siwa_nonce(wallet_address);

CREATE INDEX IF NOT EXISTS idx_siwa_nonce_nonce 
ON siwa_nonce(nonce);

CREATE INDEX IF NOT EXISTS idx_siwa_nonce_expires 
ON siwa_nonce(expires_at);

-- ============================================
-- 3. SIWA Receipt Table
-- Stores receipts for authenticated sessions
-- ============================================
CREATE TABLE IF NOT EXISTS siwa_receipt (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address VARCHAR(42) NOT NULL,
    agent_id INTEGER NOT NULL,           -- ERC-8004 agent ID
    agent_uuid UUID REFERENCES agent(id) ON DELETE CASCADE,
    receipt_signature TEXT NOT NULL,      -- The HMAC-signed receipt
    nonce_id UUID REFERENCES siwa_nonce(id),
    signed_message TEXT,                 -- The SIWA message that was signed
    message_signature TEXT,              -- The wallet signature
    issued_at TIMESTAMP WITH TIME ZONE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE, -- Set when receipt is revoked (logout)
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for receipt lookups
CREATE INDEX IF NOT EXISTS idx_siwa_receipt_wallet 
ON siwa_receipt(wallet_address);

CREATE INDEX IF NOT EXISTS idx_siwa_receipt_agent_uuid 
ON siwa_receipt(agent_uuid);

CREATE INDEX IF NOT EXISTS idx_siwa_receipt_signature 
ON siwa_receipt(receipt_signature);

CREATE INDEX IF NOT EXISTS idx_siwa_receipt_expires 
ON siwa_receipt(expires_at);

-- ============================================
-- 4. Comments
-- ============================================
COMMENT ON TABLE siwa_nonce IS 'SIWA signing challenge nonces';
COMMENT ON TABLE siwa_receipt IS 'SIWA authenticated session receipts';
COMMENT ON COLUMN agent.wallet_address IS 'Ethereum wallet address for SIWA authentication';
COMMENT ON COLUMN agent.erc_8004_agent_id IS 'Numeric ERC-8004 agent ID';
COMMENT ON COLUMN agent.verification_status IS 'ERC-8004 verification status: pending, verified, failed';
COMMENT ON COLUMN agent.erc_8004_verified IS 'Whether ERC-8004 ownership is verified onchain';
