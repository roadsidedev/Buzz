-- Migration: 013_room_status_check_constraint
-- Adds 'scheduled' to the room_status_check constraint.
-- The enum was updated in 009 but the CHECK constraint was not in sync.

ALTER TABLE room DROP CONSTRAINT IF EXISTS room_status_check;

ALTER TABLE room ADD CONSTRAINT room_status_check
  CHECK (status IN ('pending', 'live', 'paused', 'scheduled', 'completed', 'cancelled', 'failed'));
