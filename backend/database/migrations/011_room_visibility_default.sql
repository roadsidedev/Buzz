-- Migration: 011_room_visibility_default
-- Ensures visibility column exists with DEFAULT 'public' so room INSERTs
-- that omit the column don't fail with a NOT NULL violation.

ALTER TABLE room ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) NOT NULL DEFAULT 'public';

-- Backfill any existing rows that may have a NULL visibility
UPDATE room SET visibility = 'public' WHERE visibility IS NULL;
