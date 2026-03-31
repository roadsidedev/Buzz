-- ============================================================================
-- Migration 018: Missing Discovery & Room Lifecycle Columns
--
-- Fixes 500 errors on:
--   GET /api/v1/discover/live-now
--   GET /api/v1/discover/recently-ended
--   GET /api/v1/discover/episodes
--   POST /api/v1/agents/sync (indirect)
--
-- Root cause: discovery queries reference tables/columns never created by
-- any prior migration or startup script.
--
-- Also applied automatically by runStartupMigrations() in database.ts.
-- This file exists for manual execution and documentation.
-- ============================================================================

BEGIN;

-- 1. room_participant table
-- Referenced by discovery-service.ts getLiveNow() subqueries (speaker
-- lists, participant counts), room-repository.ts addParticipant(), and
-- migration 017 (which ALTERs it but never CREATEs).
CREATE TABLE IF NOT EXISTS room_participant (
  room_id    UUID NOT NULL REFERENCES room(id) ON DELETE CASCADE,
  agent_id   UUID NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
  role       VARCHAR(50) NOT NULL DEFAULT 'speaker',
  status     VARCHAR(50) NOT NULL DEFAULT 'joined',
  joined_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  left_at    TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (room_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_room_participant_room
  ON room_participant(room_id);

CREATE INDEX IF NOT EXISTS idx_room_participant_agent
  ON room_participant(agent_id);

-- 2. recording_available column
-- Referenced by /discover/recently-ended (WHERE recording_available = TRUE)
-- and room-repository.ts setRecordingAvailable().
-- Migration 014 adds recording_enabled but skips this column.
ALTER TABLE room
  ADD COLUMN IF NOT EXISTS recording_available BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. last_seen_at column
-- Heartbeat column used by discovery-service.ts getLiveNow() to filter
-- stale rooms and by room-repository.ts updateHeartbeat().
ALTER TABLE room
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_room_last_seen
  ON room(last_seen_at) WHERE status = 'live';

-- 4. search_vector column
-- tsvector column for full-text search on room objective and title.
-- Referenced by discovery-service.ts searchRooms().
ALTER TABLE room
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Backfill search_vector for existing rows
UPDATE room
SET search_vector = to_tsvector('english', COALESCE(objective, '') || ' ' || COALESCE(title, ''))
WHERE search_vector IS NULL;

-- Trigger function to auto-update search_vector on INSERT/UPDATE
CREATE OR REPLACE FUNCTION room_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.objective, '') || ' ' || COALESCE(NEW.title, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'room_search_vector_trigger'
  ) THEN
    CREATE TRIGGER room_search_vector_trigger
      BEFORE INSERT OR UPDATE OF objective, title ON room
      FOR EACH ROW EXECUTE FUNCTION room_search_vector_update();
  END IF;
END $$;

-- GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_room_search_vector
  ON room USING GIN(search_vector);

COMMIT;
