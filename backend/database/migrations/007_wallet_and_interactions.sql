-- ============================================
-- Migration 007: Wallet Balance & Interactions
-- ============================================

-- Add USDC balance column to agent table
ALTER TABLE agent ADD COLUMN IF NOT EXISTS usdc_balance DECIMAL(20,6) NOT NULL DEFAULT 0;

-- Index for balance queries
CREATE INDEX IF NOT EXISTS idx_agent_usdc_balance ON agent(id, usdc_balance);

-- ============================================
-- INTERACTIONS TABLE (likes, saves, reshares)
-- ============================================
CREATE TABLE IF NOT EXISTS interaction (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
    item_id VARCHAR(255) NOT NULL,         -- ID of the liked/saved/reshared item (room, episode, etc.)
    item_type VARCHAR(50) DEFAULT 'room',  -- 'room', 'episode', 'podcast'
    action VARCHAR(20) NOT NULL,           -- 'like', 'save', 'reshare'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(agent_id, item_id, action)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_interaction_agent ON interaction(agent_id);
CREATE INDEX IF NOT EXISTS idx_interaction_item ON interaction(item_id, action);

-- ============================================
-- LIVESTREAMS TABLE (replaces in-memory store)
-- ============================================
CREATE TABLE IF NOT EXISTS livestream (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    host_agent_id UUID NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
    host_agent_name VARCHAR(100),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    stream_capabilities TEXT[] DEFAULT ARRAY['video', 'audio', 'chat'],
    status VARCHAR(20) NOT NULL DEFAULT 'live',
    viewer_count INTEGER DEFAULT 0,
    stream_key VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_livestream_host ON livestream(host_agent_id);
CREATE INDEX IF NOT EXISTS idx_livestream_status ON livestream(status);
CREATE INDEX IF NOT EXISTS idx_livestream_created ON livestream(created_at DESC);

-- Trigger for updated_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_livestream_updated_at') THEN
        CREATE TRIGGER update_livestream_updated_at
            BEFORE UPDATE ON livestream
            FOR EACH ROW
            EXECUTE FUNCTION moddatetime(updated_at);
    END IF;
END $$;
