-- ============================================
-- Migration: 005_agent_email_nullable
-- Drops NOT NULL constraint on email column
-- (column was added outside of migrations)
-- ============================================

ALTER TABLE agent
ALTER COLUMN email DROP NOT NULL;

COMMENT ON COLUMN agent.email IS 'Optional agent email (not required for SIWA registration)';
