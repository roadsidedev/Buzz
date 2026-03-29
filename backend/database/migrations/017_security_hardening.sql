-- ============================================================================
-- Migration 017: Security Hardening
--
-- Addresses audit findings:
--  H5  — Blind index column for encrypted address lookups (replaces O(n) scan)
--  H8  — ON DELETE constraints on orphan-creating foreign keys
--  M6  — Unique index on trending_rooms for CONCURRENT refresh
--  M14 — Missing performance indexes on frequently queried columns
-- ============================================================================

BEGIN;

-- ── H5: Blind index for agent address lookups ─────────────────────────────
-- GCM encryption is non-deterministic; a WHERE clause on erc8004_address
-- is impossible without scanning all rows and decrypting each one.
-- We store an HMAC-SHA256 blind index (computed in the application layer)
-- in a separate column that can be indexed for O(log n) lookup.

ALTER TABLE agent
  ADD COLUMN IF NOT EXISTS hashed_address TEXT;

-- Backfill: The application layer will populate this on next login/upsert.
-- Rows with hashed_address IS NULL are legacy rows awaiting backfill; the
-- repository falls back to the slow path for those rows only.

CREATE INDEX IF NOT EXISTS idx_agent_hashed_address
  ON agent (hashed_address)
  WHERE hashed_address IS NOT NULL;

-- ── H8: Foreign key ON DELETE behaviour ──────────────────────────────────
-- Previously missing delete actions caused orphaned rows when agents or
-- rooms were deleted, which could crash downstream services.
--
-- Strategy:
--   - room -> agent (host): RESTRICT — block agent deletion while they host
--     an active room; admins must close the room first.
--   - child tables -> room: CASCADE — deleting a room cleans up all related
--     transcripts, scores, payments, etc.

-- Room table: prevent agent deletion when they are the host of any room.
-- (Cannot ADD a new FK with ON DELETE; must drop the implicit FK and re-add.)
ALTER TABLE room
  DROP CONSTRAINT IF EXISTS room_host_agent_id_fkey;

ALTER TABLE room
  ADD CONSTRAINT room_host_agent_id_fkey
    FOREIGN KEY (host_agent_id)
    REFERENCES agent (id)
    ON DELETE RESTRICT;

-- Transcript: cascade on room deletion.
ALTER TABLE transcript
  DROP CONSTRAINT IF EXISTS transcript_room_id_fkey;

ALTER TABLE transcript
  ADD CONSTRAINT transcript_room_id_fkey
    FOREIGN KEY (room_id)
    REFERENCES room (id)
    ON DELETE CASCADE;

-- Orchestrator score: cascade on room deletion.
ALTER TABLE orchestrator_score
  DROP CONSTRAINT IF EXISTS orchestrator_score_room_id_fkey;

ALTER TABLE orchestrator_score
  ADD CONSTRAINT orchestrator_score_room_id_fkey
    FOREIGN KEY (room_id)
    REFERENCES room (id)
    ON DELETE CASCADE;

-- Moderation log: cascade on room deletion.
ALTER TABLE moderation_log
  DROP CONSTRAINT IF EXISTS moderation_log_room_id_fkey;

ALTER TABLE moderation_log
  ADD CONSTRAINT moderation_log_room_id_fkey
    FOREIGN KEY (room_id)
    REFERENCES room (id)
    ON DELETE CASCADE;

-- Payment: cascade on room deletion.
-- Note: Payments may need to be archived for accounting; consider soft-delete
-- in a future migration if compliance requires it.
ALTER TABLE payment
  DROP CONSTRAINT IF EXISTS payment_room_id_fkey;

ALTER TABLE payment
  ADD CONSTRAINT payment_room_id_fkey
    FOREIGN KEY (room_id)
    REFERENCES room (id)
    ON DELETE CASCADE;

-- Room participant: cascade on room deletion.
ALTER TABLE room_participant
  DROP CONSTRAINT IF EXISTS room_participant_room_id_fkey;

ALTER TABLE room_participant
  ADD CONSTRAINT room_participant_room_id_fkey
    FOREIGN KEY (room_id)
    REFERENCES room (id)
    ON DELETE CASCADE;

-- ── M6: Unique index on trending_rooms for CONCURRENT refresh ─────────────
-- REFRESH MATERIALIZED VIEW CONCURRENTLY requires a unique index.
-- Without it, the command will fail with:
--   "cannot refresh materialized view concurrently without any unique index"
CREATE UNIQUE INDEX IF NOT EXISTS idx_trending_rooms_id
  ON trending_rooms (id);

-- ── M14: Missing performance indexes ──────────────────────────────────────

-- agent.username — used in auth lookups and profile queries
CREATE INDEX IF NOT EXISTS idx_agent_username
  ON agent (username)
  WHERE username IS NOT NULL;

-- room.status — used in every live/pending room query
CREATE INDEX IF NOT EXISTS idx_room_status
  ON room (status);

-- room.created_at — used for pagination ordering
CREATE INDEX IF NOT EXISTS idx_room_created_at
  ON room (created_at DESC);

-- Composite: room by host ordered by date (profile page)
CREATE INDEX IF NOT EXISTS idx_room_host_created
  ON room (host_agent_id, created_at DESC);

-- orchestrator_score.agent_id — used in per-agent score history
CREATE INDEX IF NOT EXISTS idx_orchestrator_score_agent_id
  ON orchestrator_score (agent_id);

-- orchestrator_score.room_id + created_at — turn history queries
CREATE INDEX IF NOT EXISTS idx_orchestrator_score_room_created
  ON orchestrator_score (room_id, created_at DESC);

-- moderation_log.room_id — used in room moderation reports
CREATE INDEX IF NOT EXISTS idx_moderation_log_room_id
  ON moderation_log (room_id);

-- moderation_log.agent_id — used in per-agent moderation history
CREATE INDEX IF NOT EXISTS idx_moderation_log_agent_id
  ON moderation_log (agent_id);

-- transcript.speaker_agent_id — used in per-agent message history
CREATE INDEX IF NOT EXISTS idx_transcript_speaker_agent_id
  ON transcript (speaker_agent_id);

-- transcript.room_id + speaker_agent_id — speaker messages per room
CREATE INDEX IF NOT EXISTS idx_transcript_room_speaker
  ON transcript (room_id, speaker_agent_id);

-- payment.from_agent_id + created_at — agent payment history
CREATE INDEX IF NOT EXISTS idx_payment_from_agent_created
  ON payment (from_agent_id, created_at DESC);

COMMIT;
