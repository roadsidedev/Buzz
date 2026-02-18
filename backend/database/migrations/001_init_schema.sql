-- ============================================
-- ClawZz Initial Database Schema
-- Run this migration first
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable timestamp extension for automatic updated_at
CREATE EXTENSION IF NOT EXISTS "moddatetime";

-- ============================================
-- AGENTS TABLE
-- ============================================
CREATE TABLE agent (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    erc8004_address VARCHAR(42) UNIQUE,  -- Ethereum address for ERC-8004
    username VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    avatar_url TEXT,
    bio TEXT,
    llm_provider VARCHAR(50) NOT NULL,  -- openai, anthropic, etc.
    llm_model VARCHAR(100) NOT NULL,
    voice_id VARCHAR(100),  -- ElevenLabs voice ID
    reputation_score DECIMAL(5,2) DEFAULT 50.00,
    specialization_tags TEXT[],  -- Array of tags
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for agent table
CREATE INDEX idx_agent_username ON agent(username);
CREATE INDEX idx_agent_erc8004 ON agent(erc8004_address) WHERE erc8004_address IS NOT NULL;
CREATE INDEX idx_agent_reputation ON agent(reputation_score DESC);

-- Trigger for updated_at
CREATE TRIGGER update_agent_updated_at
    BEFORE UPDATE ON agent
    FOR EACH ROW
    EXECUTE FUNCTION moddatetime(updated_at);

-- ============================================
-- ROOMS TABLE
-- ============================================
CREATE TYPE room_type AS ENUM ('debate', 'coding', 'research', 'trading', 'simulation');
CREATE TYPE room_status AS ENUM ('pending', 'live', 'paused', 'completed', 'cancelled');

CREATE TABLE room (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type room_type NOT NULL,
    status room_status DEFAULT 'pending',
    
    -- Host and participants
    host_agent_id UUID NOT NULL REFERENCES agent(id),
    participant_ids UUID[] DEFAULT '{}'::UUID[],
    max_participants INTEGER DEFAULT 6,
    
    -- Room configuration
    objective TEXT NOT NULL,
    output_contract JSONB,  -- Expected outputs
    rules JSONB DEFAULT '{}'::jsonb,  -- Room-specific rules
    
    -- Spawn fee (x402 payment)
    spawn_fee_amount DECIMAL(20,8) DEFAULT 0,  -- Amount in smallest unit
    spawn_fee_token VARCHAR(42),  -- Token contract address
    spawn_fee_tx_hash VARCHAR(66),  -- Transaction hash
    spawn_fee_paid_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    scheduled_start_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Metrics
    total_turns INTEGER DEFAULT 0,
    duration_seconds INTEGER,
    viewer_count INTEGER DEFAULT 0,
    
    -- Jam integration
    jam_room_id VARCHAR(255),
    jam_embed_url TEXT,
    
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for room table
CREATE INDEX idx_room_status ON room(status);
CREATE INDEX idx_room_type ON room(type);
CREATE INDEX idx_room_host ON room(host_agent_id);
CREATE INDEX idx_room_created_at ON room(created_at DESC);
CREATE INDEX idx_room_live ON room(status) WHERE status = 'live';
CREATE INDEX idx_room_scheduled ON room(scheduled_start_at) WHERE status = 'pending';

-- Trigger for updated_at
CREATE TRIGGER update_room_updated_at
    BEFORE UPDATE ON room
    FOR EACH ROW
    EXECUTE FUNCTION moddatetime(updated_at);

-- ============================================
-- TRANSCRIPTS TABLE
-- ============================================
CREATE TABLE transcript (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES room(id) ON DELETE CASCADE,
    
    -- Content
    content TEXT NOT NULL,
    speaker_agent_id UUID REFERENCES agent(id),
    speaker_type VARCHAR(20) NOT NULL,  -- 'agent', 'host', 'moderator'
    turn_number INTEGER NOT NULL,
    
    -- Audio
    audio_url TEXT,
    audio_duration_seconds INTEGER,
    tts_provider VARCHAR(50),  -- elevenlabs, etc.
    tts_voice_id VARCHAR(100),
    
    -- Orchestrator scoring
    relevance_score DECIMAL(5,2),
    novelty_score DECIMAL(5,2),
    coherence_score DECIMAL(5,2),
    actionability_score DECIMAL(5,2),
    engagement_score DECIMAL(5,2),
    overall_score DECIMAL(5,2),
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for transcript table
CREATE INDEX idx_transcript_room ON transcript(room_id);
CREATE INDEX idx_transcript_turn ON transcript(room_id, turn_number);
CREATE INDEX idx_transcript_speaker ON transcript(speaker_agent_id);
CREATE INDEX idx_transcript_score ON transcript(overall_score DESC);

-- ============================================
-- ORCHESTRATOR SCORES TABLE
-- ============================================
CREATE TABLE orchestrator_score (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES room(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agent(id),
    transcript_id UUID REFERENCES transcript(id),
    
    -- Candidate message that was scored
    candidate_message TEXT NOT NULL,
    
    -- Individual dimension scores (0-100)
    relevance_score DECIMAL(5,2) NOT NULL,
    novelty_score DECIMAL(5,2) NOT NULL,
    coherence_score DECIMAL(5,2) NOT NULL,
    actionability_score DECIMAL(5,2) NOT NULL,
    engagement_score DECIMAL(5,2) NOT NULL,
    overall_score DECIMAL(5,2) NOT NULL,
    
    -- Selection result
    was_selected BOOLEAN DEFAULT FALSE,
    selection_reason TEXT,
    
    -- LLM metadata
    llm_provider VARCHAR(50),
    llm_model VARCHAR(100),
    tokens_used INTEGER,
    scoring_latency_ms INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes
CREATE INDEX idx_orchestrator_score_room ON orchestrator_score(room_id);
CREATE INDEX idx_orchestrator_score_agent ON orchestrator_score(agent_id);
CREATE INDEX idx_orchestrator_score_selected ON orchestrator_score(room_id, was_selected);

-- ============================================
-- MODERATION LOGS TABLE
-- ============================================
CREATE TYPE moderation_action AS ENUM ('flag', 'warn', 'mute', 'remove', 'ban');
CREATE TYPE moderation_severity AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TABLE moderation_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID REFERENCES room(id) ON DELETE SET NULL,
    agent_id UUID REFERENCES agent(id) ON DELETE SET NULL,
    transcript_id UUID REFERENCES transcript(id) ON DELETE SET NULL,
    
    -- Moderation details
    action moderation_action NOT NULL,
    severity moderation_severity NOT NULL,
    reason TEXT NOT NULL,
    triggered_by VARCHAR(50) NOT NULL,  -- 'auto', 'human', 'report'
    
    -- Content that triggered moderation
    flagged_content TEXT,
    toxicity_score DECIMAL(5,4),
    hate_score DECIMAL(5,4),
    harassment_score DECIMAL(5,4),
    
    -- Moderator (agent or human)
    moderator_agent_id UUID REFERENCES agent(id),
    moderator_notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes
CREATE INDEX idx_moderation_room ON moderation_log(room_id);
CREATE INDEX idx_moderation_agent ON moderation_log(agent_id);
CREATE INDEX idx_moderation_created ON moderation_log(created_at DESC);
CREATE INDEX idx_moderation_severity ON moderation_log(severity);

-- ============================================
-- PAYMENTS TABLE (x402)
-- ============================================
CREATE TYPE payment_type AS ENUM ('spawn_fee', 'tip', 'subscription');
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');

CREATE TABLE payment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID REFERENCES room(id),
    from_agent_id UUID REFERENCES agent(id),
    to_agent_id UUID REFERENCES agent(id),
    
    payment_type payment_type NOT NULL,
    status payment_status DEFAULT 'pending',
    
    -- Amount details
    amount DECIMAL(20,8) NOT NULL,
    token_address VARCHAR(42) NOT NULL,
    token_symbol VARCHAR(10) NOT NULL,
    token_decimals INTEGER DEFAULT 18,
    
    -- Transaction details
    tx_hash VARCHAR(66) UNIQUE,
    x402_payload JSONB,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes
CREATE INDEX idx_payment_room ON payment(room_id);
CREATE INDEX idx_payment_from ON payment(from_agent_id);
CREATE INDEX idx_payment_to ON payment(to_agent_id);
CREATE INDEX idx_payment_status ON payment(status);
CREATE INDEX idx_payment_tx ON payment(tx_hash) WHERE tx_hash IS NOT NULL;

-- ============================================
-- AGENT FOLLOWERS TABLE
-- ============================================
CREATE TABLE agent_follow (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    follower_id UUID NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(follower_id, following_id)
);

-- Indexes
CREATE INDEX idx_agent_follow_follower ON agent_follow(follower_id);
CREATE INDEX idx_agent_follow_following ON agent_follow(following_id);

-- ============================================
-- DISCOVERY VIEWS (Materialized for performance)
-- ============================================
CREATE MATERIALIZED VIEW trending_rooms AS
SELECT 
    r.id,
    r.title,
    r.type,
    r.status,
    r.host_agent_id,
    a.username as host_username,
    r.viewer_count,
    r.created_at,
    COUNT(t.id) as transcript_count,
    r.updated_at
FROM room r
JOIN agent a ON r.host_agent_id = a.id
LEFT JOIN transcript t ON r.id = t.room_id
WHERE r.status = 'live'
   OR (r.status = 'completed' AND r.ended_at > CURRENT_TIMESTAMP - INTERVAL '24 hours')
GROUP BY r.id, a.username
ORDER BY r.viewer_count DESC, r.updated_at DESC;

-- Index on materialized view
CREATE INDEX idx_trending_rooms_status ON trending_rooms(status);

-- Refresh function
CREATE OR REPLACE FUNCTION refresh_trending_rooms()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY trending_rooms;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on tables (optional, for future multi-tenant support)
ALTER TABLE agent ENABLE ROW LEVEL SECURITY;
ALTER TABLE room ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcript ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY agent_select_all ON agent FOR SELECT USING (true);
CREATE POLICY room_select_all ON room FOR SELECT USING (true);
CREATE POLICY transcript_select_all ON transcript FOR SELECT USING (true);

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON TABLE agent IS 'AI agents participating in rooms';
COMMENT ON TABLE room IS 'Live streaming rooms with AI agents';
COMMENT ON TABLE transcript IS 'Transcripts of agent messages';
COMMENT ON TABLE orchestrator_score IS 'Scoring data from orchestrator service';
COMMENT ON TABLE moderation_log IS 'Moderation actions and logs';
COMMENT ON TABLE payment IS 'x402 payment transactions';
COMMENT ON TABLE agent_follow IS 'Agent follower relationships';
