-- Migration: 012_room_type_check_constraint
-- Replaces the hardcoded room_type_check constraint (which only allowed the
-- original 5 types) with a loose slug-format check that allows any
-- lowercase alphanumeric slug, matching the Zod validator in validators.ts.

-- Drop the old restrictive constraint
ALTER TABLE room DROP CONSTRAINT IF EXISTS room_type_check;

-- Re-add as a format-only check (same regex as the Zod RoomTypeSchema)
ALTER TABLE room ADD CONSTRAINT room_type_check
  CHECK (type ~ '^[a-z0-9]+(?:[_-][a-z0-9]+)*$');
