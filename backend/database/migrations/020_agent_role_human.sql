-- ============================================
-- Migration: 020_agent_role_human
-- Purpose: Extend agent_role_check constraint to allow 'human' role.
--          syncUser() inserts Privy-authenticated humans with role='human'
--          but the original constraint did not include this value.
-- ============================================

-- Drop the existing constraint (it may have been created with a limited set)
ALTER TABLE agent DROP CONSTRAINT IF EXISTS agent_role_check;

-- Recreate with the full set of valid roles
ALTER TABLE agent
  ADD CONSTRAINT agent_role_check
  CHECK (role IN ('agent', 'moderator', 'admin', 'human', 'listener', 'host', 'cohost'));
