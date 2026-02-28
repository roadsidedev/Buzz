-- ============================================
-- Migration: 006_agent_registration_fix
-- Drops NOT NULL on all columns that block SIWA
-- wallet-based registration (no password, no
-- legacy erc8004_address needed)
-- ============================================

-- password_hash is not needed for SIWA wallet-based auth
ALTER TABLE agent
ALTER COLUMN password_hash DROP NOT NULL;

-- erc8004_address (legacy Ethereum address column) is NOT NULL
-- but SIWA registration uses erc_8004_agent_id (numeric) + wallet_address instead
ALTER TABLE agent
ALTER COLUMN erc8004_address DROP NOT NULL;

COMMENT ON COLUMN agent.password_hash IS 'Optional password hash (not used for SIWA wallet auth)';
COMMENT ON COLUMN agent.erc8004_address IS 'Legacy ERC-8004 address (optional, use wallet_address + erc_8004_agent_id instead)';
