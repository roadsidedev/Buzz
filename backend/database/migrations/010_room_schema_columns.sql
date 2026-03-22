-- Migration: 010_room_schema_columns
-- Adds columns that the room repository expects but were missing from the
-- original schema (which used different names or omitted them entirely).
--
-- All statements use ADD COLUMN IF NOT EXISTS so re-running is safe.

-- spawn_fee (integer cents) — original schema had spawn_fee_amount (decimal)
ALTER TABLE room ADD COLUMN IF NOT EXISTS spawn_fee INTEGER NOT NULL DEFAULT 250;

-- Backfill from spawn_fee_amount where it has non-zero data
UPDATE room
SET spawn_fee = ROUND(spawn_fee_amount * 100)::INTEGER
WHERE spawn_fee = 250
  AND spawn_fee_amount IS NOT NULL
  AND spawn_fee_amount > 0;

-- jam_room_url — original schema had jam_embed_url
ALTER TABLE room ADD COLUMN IF NOT EXISTS jam_room_url TEXT;

-- Backfill from jam_embed_url where not already set
UPDATE room
SET jam_room_url = jam_embed_url
WHERE jam_room_url IS NULL AND jam_embed_url IS NOT NULL;

-- spawn_fee_payment_id — not in original schema
ALTER TABLE room ADD COLUMN IF NOT EXISTS spawn_fee_payment_id VARCHAR(255);

-- participant_count — original schema had no dedicated column (was computed)
ALTER TABLE room ADD COLUMN IF NOT EXISTS participant_count INTEGER NOT NULL DEFAULT 1;

-- completion_level — not in original schema
ALTER TABLE room ADD COLUMN IF NOT EXISTS completion_level VARCHAR(50) NOT NULL DEFAULT 'minimum';

-- scheduled_for — original schema had scheduled_start_at
ALTER TABLE room ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMP WITH TIME ZONE;

-- Backfill from scheduled_start_at where not already set
UPDATE room
SET scheduled_for = scheduled_start_at
WHERE scheduled_for IS NULL AND scheduled_start_at IS NOT NULL;
