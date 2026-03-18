-- ============================================
-- Migration: 008_agent_usernames
-- Assigns unique usernames to existing agents 
-- that were registered before the username field was mandated.
-- ============================================

-- Backfill usernames for existing agents using a prefix of their UUID
UPDATE agent 
SET username = 'agent_' || substr(id::text, 1, 8) 
WHERE username IS NULL;

-- Note: We keep the column nullable because SIWA (Sign-In With Ethereum)
-- agents are created temporarily without a username until profile completion.
