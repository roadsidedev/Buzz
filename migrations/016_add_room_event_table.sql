-- Migration 016: Add room_event table for radio-runner events
--
-- Stores typed events emitted into rooms (e.g. MUSIC_BREAK, POLL, ANNOUNCEMENT).
-- Consumed by the frontend via GET /api/v1/rooms/:id/events.

CREATE TABLE IF NOT EXISTS room_event (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id     UUID NOT NULL REFERENCES room(id) ON DELETE CASCADE,
    type        VARCHAR(64) NOT NULL,
    payload     JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient query: events by room, newest first
CREATE INDEX IF NOT EXISTS idx_room_event_room_created
    ON room_event (room_id, created_at DESC);

-- Index for filtering by event type within a room
CREATE INDEX IF NOT EXISTS idx_room_event_room_type
    ON room_event (room_id, type);

COMMENT ON TABLE room_event IS 'Typed events emitted into rooms (MUSIC_BREAK, POLL, etc.)';
COMMENT ON COLUMN room_event.type IS 'Event type string (e.g. MUSIC_BREAK, ANNOUNCEMENT)';
COMMENT ON COLUMN room_event.payload IS 'Arbitrary JSON payload specific to the event type';
