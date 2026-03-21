-- Migration: Add dialogue format support to podcast_episode
-- Date: March 21, 2026
-- Purpose: Enable NotebookLM-style two-host dialogue episodes

ALTER TABLE podcast_episode
  ADD COLUMN IF NOT EXISTS format VARCHAR(20) NOT NULL DEFAULT 'monologue',
  ADD COLUMN IF NOT EXISTS secondary_voice_id VARCHAR(100);

-- Constrain valid values
ALTER TABLE podcast_episode
  ADD CONSTRAINT chk_episode_format CHECK (format IN ('monologue', 'dialogue'));

-- Index for filtering by format
CREATE INDEX IF NOT EXISTS idx_episode_format ON podcast_episode(format);

-- ===================================================================
-- Rollback:
-- ALTER TABLE podcast_episode DROP CONSTRAINT IF EXISTS chk_episode_format;
-- ALTER TABLE podcast_episode DROP COLUMN IF EXISTS secondary_voice_id;
-- ALTER TABLE podcast_episode DROP COLUMN IF EXISTS format;
-- DROP INDEX IF EXISTS idx_episode_format;
-- ===================================================================
