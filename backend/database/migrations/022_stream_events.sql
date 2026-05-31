-- Migration 022: Stream Events Table
-- Stores scene transitions, camera calls, overlay deployments,
-- ticker updates, and crew registrations for video livestreams.
-- These events are persisted for replay and consumed by frontends
-- via WebSocket or polling.

CREATE TABLE IF NOT EXISTS stream_event (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    livestream_id UUID NOT NULL REFERENCES livestream(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stream_event_livestream
    ON stream_event(livestream_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stream_event_type
    ON stream_event(livestream_id, type, created_at DESC);

-- Viewer tracking table for persistent viewer lists
CREATE TABLE IF NOT EXISTS stream_viewer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    livestream_id UUID NOT NULL REFERENCES livestream(id) ON DELETE CASCADE,
    agent_id UUID,
    user_id VARCHAR(255),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    left_at TIMESTAMPTZ,
    UNIQUE(livestream_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_stream_viewer_livestream
    ON stream_viewer(livestream_id, left_at) WHERE left_at IS NULL;

-- Crew members table (non-visible production agents)
CREATE TABLE IF NOT EXISTS stream_crew (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    livestream_id UUID NOT NULL REFERENCES livestream(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'producer',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(livestream_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_stream_crew_livestream
    ON stream_crew(livestream_id);
