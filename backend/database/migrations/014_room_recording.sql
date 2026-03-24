-- Migration: 014_room_recording
-- Adds recording columns to the room table.
-- Spaces are recorded by default; hosts can opt out.
-- All statements use ADD COLUMN IF NOT EXISTS so re-running is safe.

ALTER TABLE room ADD COLUMN IF NOT EXISTS recording_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE room ADD COLUMN IF NOT EXISTS recording_url TEXT;
ALTER TABLE room ADD COLUMN IF NOT EXISTS recording_started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE room ADD COLUMN IF NOT EXISTS recording_ended_at TIMESTAMP WITH TIME ZONE;
