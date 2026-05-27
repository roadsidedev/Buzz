-- ============================================
-- Migration 021: Livestream Ingest Health Tracking
-- ============================================
-- Purpose: Add columns to track real video ingest health for programmatic streams.
-- This allows the system to distinguish between "agent declared live" (heartbeat only)
-- and "actually broadcasting video" (successful RTMP publish + frames flowing).
--
-- Problem solved:
--   - Video Runner (and similar) can register a livestream and heartbeat successfully,
--     causing it to appear as "live" in discovery and TV UI.
--   - But if RTMP publish never succeeds (wrong RTMP_BASE_URL, auth-publish rejection,
--     network issues, FFmpeg crash), viewers see a static room with no video.
--   - This migration + corresponding route logic enforces: status='live' in discovery
--     requires recent evidence of actual ingest.
--
-- Columns added:
--   - last_seen_at: updated on every heartbeat (already referenced in code)
--   - ingest_active: true only after successful auth-publish (RTMP publish)
--   - last_ingest_at: timestamp of last confirmed ingest activity
--
-- Safe for production: uses IF NOT EXISTS patterns.

-- Ensure last_seen_at exists (code already depends on the 90s heartbeat window)
ALTER TABLE livestream
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- New columns for real ingest tracking (Phase 1 of video broadcast reliability fix)
ALTER TABLE livestream
  ADD COLUMN IF NOT EXISTS ingest_active BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE livestream
  ADD COLUMN IF NOT EXISTS last_ingest_at TIMESTAMPTZ;

-- Helpful indexes for discovery queries that will filter on ingest health
CREATE INDEX IF NOT EXISTS idx_livestream_ingest_active
  ON livestream(ingest_active, last_ingest_at DESC)
  WHERE status = 'live';

CREATE INDEX IF NOT EXISTS idx_livestream_last_seen
  ON livestream(last_seen_at DESC)
  WHERE status = 'live';

-- Optional: backfill strategy comment for existing rows
-- After deploying this migration, run a one-time backfill if desired:
--   UPDATE livestream
--   SET last_seen_at = COALESCE(last_seen_at, created_at),
--       ingest_active = (status = 'live')   -- conservative: treat existing 'live' as potentially ingesting
--   WHERE last_seen_at IS NULL;
--
-- In practice, for the video runner use-case, it is safer to start with ingest_active=FALSE
-- for historical rows and let fresh heartbeats + auth-publish calls set the correct state.
