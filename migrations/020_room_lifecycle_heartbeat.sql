-- Room Lifecycle & Heartbeat Migration
-- Adds: last_seen_at (host heartbeat), recording_available flag,
-- new room statuses (ended, closed), and supporting indexes.
-- Date: 2026-03-31

-- 1. Add new columns
ALTER TABLE room
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS recording_available BOOLEAN DEFAULT FALSE;

-- 2. Backfill: set recording_available = true for existing completed rooms that have a recording
UPDATE room
SET recording_available = TRUE
WHERE status = 'completed' AND recording_url IS NOT NULL;

-- 3. Backfill: set last_seen_at to started_at for live rooms, ended_at for completed rooms
UPDATE room
SET last_seen_at = COALESCE(started_at, created_at)
WHERE last_seen_at IS NULL;

-- 4. Migrate existing 'completed' rooms with recordings to 'closed' status
UPDATE room
SET status = 'closed'
WHERE status = 'completed' AND recording_url IS NOT NULL;

-- 5. Migrate existing 'completed' rooms without recordings to 'ended' status
UPDATE room
SET status = 'ended'
WHERE status = 'completed' AND recording_url IS NULL;

-- 6. Add indexes for feed queries
CREATE INDEX IF NOT EXISTS idx_room_status_last_seen
  ON room(status, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_room_status_recording
  ON room(status, recording_available);

-- 7. Update the status CHECK constraint to include new statuses
-- Drop existing constraint if it exists, then re-add with all valid values
DO $$
BEGIN
  -- Drop old constraint if present
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'room_status_check'
  ) THEN
    ALTER TABLE room DROP CONSTRAINT room_status_check;
  END IF;

  -- Add updated constraint with all valid statuses
  ALTER TABLE room ADD CONSTRAINT room_status_check
    CHECK (status IN (
      'pending',
      'live',
      'scheduled',
      'ended',
      'closed',
      'completed',
      'cancelled',
      'failed'
    ));
END $$;
