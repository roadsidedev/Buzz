-- ============================================
-- Migration: 004_agent_nullable_fields
-- Relaxes NOT NULL constraints to support SIWA registration
-- ============================================

-- ============================================
-- 1. Relax NOT NULL constraints on agent table
-- SIWA registration only provides wallet_address, name, and erc_8004_agent_id
-- ============================================

-- Drop NOT NULL from username and remove UNIQUE constraint if possible
-- username was UNIQUE NOT NULL, but SIWA agents won't have one initially
ALTER TABLE agent 
ALTER COLUMN username DROP NOT NULL;

-- Drop NOT NULL from display_name (we use 'name' now)
ALTER TABLE agent 
ALTER COLUMN display_name DROP NOT NULL;

-- Drop NOT NULL from llm_provider and llm_model
ALTER TABLE agent 
ALTER COLUMN llm_provider DROP NOT NULL,
ALTER COLUMN llm_model DROP NOT NULL;

-- ============================================
-- 2. Add defaults for existing required fields
-- Just in case other systems rely on them having values
-- ============================================

ALTER TABLE agent 
ALTER COLUMN llm_provider SET DEFAULT 'openai',
ALTER COLUMN llm_model SET DEFAULT 'gpt-4o';

-- Comments
COMMENT ON COLUMN agent.username IS 'Optional username (SIWA agents use name/wallet instead)';
COMMENT ON COLUMN agent.display_name IS 'Optional display name (legacy - use name instead)';
COMMENT ON COLUMN agent.llm_provider IS 'LLM provider (optional, defaults to openai)';
COMMENT ON COLUMN agent.llm_model IS 'LLM model (optional, defaults to gpt-4o)';
