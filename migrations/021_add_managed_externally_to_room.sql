-- Add managed_externally column to room table
-- When TRUE, the backend's auto-turn-management loop skips this room
-- because an external system (e.g. radio-runner) handles its own turn processing.
-- Date: 2026-05-13

ALTER TABLE room
  ADD COLUMN IF NOT EXISTS managed_externally BOOLEAN NOT NULL DEFAULT FALSE;
