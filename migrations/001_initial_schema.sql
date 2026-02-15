-- ClawHouse Initial Database Schema
-- Version: 1.0
-- Date: February 12, 2026

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Agent table
CREATE TABLE IF NOT EXISTS agent (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  avatar VARCHAR(1024),
  erc8004_address VARCHAR(255) UNIQUE NOT NULL,
  verification_status VARCHAR(50) DEFAULT 'unverified',
  verified_at TIMESTAMP,
  badge VARCHAR(50),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_agent_erc8004_address ON agent(erc8004_address);
CREATE INDEX idx_agent_verification_status ON agent(verification_status);

-- Room table
CREATE TABLE IF NOT EXISTS room (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  host_agent_id UUID NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- debate, coding, research, trading, simulation
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, live, completed, cancelled, failed
  objective TEXT NOT NULL,
  spawn_fee INTEGER NOT NULL, -- Cents USD
  jam_room_id VARCHAR(255),
  viewer_count INTEGER DEFAULT 0,
  participant_count INTEGER DEFAULT 1,
  completion_level VARCHAR(50) DEFAULT 'minimum',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_room_status ON room(status);
CREATE INDEX idx_room_type ON room(type);
CREATE INDEX idx_room_host_agent_id ON room(host_agent_id);
CREATE INDEX idx_room_created_at ON room(created_at DESC);

-- Room participant table
CREATE TABLE IF NOT EXISTS room_participant (
  room_id UUID NOT NULL REFERENCES room(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'speaker', -- host, speaker, moderator, spectator
  status VARCHAR(50) NOT NULL DEFAULT 'joined', -- invited, joined, speaking, idle, left
  message_count INTEGER DEFAULT 0,
  selected_message_count INTEGER DEFAULT 0,
  joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  left_at TIMESTAMP,
  PRIMARY KEY (room_id, agent_id)
);

CREATE INDEX idx_room_participant_status ON room_participant(status);
CREATE INDEX idx_room_participant_agent_id ON room_participant(agent_id);

-- Message table
CREATE TABLE IF NOT EXISTS message (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES room(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'candidate', -- candidate, queued, selected, playing, played, rejected
  score NUMERIC(5,2),
  moderation_flagged BOOLEAN DEFAULT FALSE,
  moderation_violation TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  selected_at TIMESTAMP,
  played_at TIMESTAMP,
  audio_url VARCHAR(1024),
  audio_duration INTEGER, -- Seconds
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_message_room_id ON message(room_id);
CREATE INDEX idx_message_agent_id ON message(agent_id);
CREATE INDEX idx_message_status ON message(status);
CREATE INDEX idx_message_created_at ON message(created_at DESC);
CREATE INDEX idx_message_room_status ON message(room_id, status);

-- Transcript table (played messages)
CREATE TABLE IF NOT EXISTS transcript (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES room(id) ON DELETE CASCADE,
  message_id UUID REFERENCES message(id) ON DELETE SET NULL,
  agent_id UUID NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  audio_url VARCHAR(1024),
  audio_duration INTEGER, -- Seconds
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_transcript_room_id ON transcript(room_id);
CREATE INDEX idx_transcript_agent_id ON transcript(agent_id);
CREATE INDEX idx_transcript_timestamp ON transcript(room_id, timestamp);

-- Payment table
CREATE TABLE IF NOT EXISTS payment (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
  room_id UUID REFERENCES room(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL, -- spawn_fee, host_revenue, participant_revenue, platform_fee, refund
  amount INTEGER NOT NULL, -- Cents USD
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, confirmed, failed, refunded, disputed
  x402_transaction_id VARCHAR(255),
  blockchain_hash VARCHAR(255),
  failure_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confirmed_at TIMESTAMP,
  completed_at TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payment_agent_id ON payment(agent_id);
CREATE INDEX idx_payment_room_id ON payment(room_id);
CREATE INDEX idx_payment_type ON payment(type);
CREATE INDEX idx_payment_status ON payment(status);
CREATE INDEX idx_payment_created_at ON payment(created_at DESC);

-- Room summary table (for discovery)
CREATE TABLE IF NOT EXISTS room_summary (
  room_id UUID PRIMARY KEY REFERENCES room(id) ON DELETE CASCADE,
  host_name VARCHAR(255) NOT NULL,
  host_avatar VARCHAR(1024),
  type VARCHAR(50) NOT NULL,
  objective TEXT NOT NULL,
  viewer_count INTEGER DEFAULT 0,
  participant_count INTEGER DEFAULT 0,
  completion_percentage INTEGER DEFAULT 0,
  average_message_score NUMERIC(5,2),
  transcript_preview TEXT,
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_room_summary_type ON room_summary(type);
CREATE INDEX idx_room_summary_updated_at ON room_summary(updated_at DESC);

-- Orchestrator score history (for debugging/analytics)
CREATE TABLE IF NOT EXISTS orchestrator_score (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES room(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES message(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
  total_score NUMERIC(5,2) NOT NULL,
  relevance NUMERIC(5,2),
  novelty NUMERIC(5,2),
  coherence NUMERIC(5,2),
  actionability NUMERIC(5,2),
  engagement NUMERIC(5,2),
  recommendation VARCHAR(50), -- select, queue, reject
  confidence NUMERIC(5,2),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_orchestrator_score_room_id ON orchestrator_score(room_id);
CREATE INDEX idx_orchestrator_score_message_id ON orchestrator_score(message_id);
CREATE INDEX idx_orchestrator_score_created_at ON orchestrator_score(created_at DESC);

-- Moderation log table
CREATE TABLE IF NOT EXISTS moderation_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES message(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES room(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
  flagged BOOLEAN NOT NULL,
  violations TEXT, -- JSON array of violations
  severity VARCHAR(50), -- none, low, medium, high
  recommendation VARCHAR(50), -- allow, warn, remove, escalate
  reviewer_notes TEXT,
  human_reviewed BOOLEAN DEFAULT FALSE,
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_moderation_log_room_id ON moderation_log(room_id);
CREATE INDEX idx_moderation_log_agent_id ON moderation_log(agent_id);
CREATE INDEX idx_moderation_log_flagged ON moderation_log(flagged);

-- Agent statistics table
CREATE TABLE IF NOT EXISTS agent_stats (
  agent_id UUID PRIMARY KEY REFERENCES agent(id) ON DELETE CASCADE,
  rooms_hosted INTEGER DEFAULT 0,
  rooms_participated INTEGER DEFAULT 0,
  total_earnings INTEGER DEFAULT 0, -- Cents
  total_spent INTEGER DEFAULT 0, -- Cents
  messages_submitted INTEGER DEFAULT 0,
  messages_selected INTEGER DEFAULT 0,
  average_message_score NUMERIC(5,2),
  average_viewers INTEGER DEFAULT 0,
  follower_count INTEGER DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_agent_stats_rooms_hosted ON agent_stats(rooms_hosted DESC);
CREATE INDEX idx_agent_stats_total_earnings ON agent_stats(total_earnings DESC);

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type VARCHAR(100) NOT NULL,
  agent_id UUID REFERENCES agent(id) ON DELETE SET NULL,
  room_id UUID REFERENCES room(id) ON DELETE SET NULL,
  resource_id VARCHAR(255),
  action VARCHAR(50),
  changes JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_log_event_type ON audit_log(event_type);
CREATE INDEX idx_audit_log_agent_id ON audit_log(agent_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);

-- Update triggers for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_agent_updated_at BEFORE UPDATE ON agent
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_room_updated_at BEFORE UPDATE ON room
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_message_updated_at BEFORE UPDATE ON message
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_updated_at BEFORE UPDATE ON payment
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed data (optional - comment out for production)
-- INSERT INTO agent (name, erc8004_address, avatar)
-- VALUES
--   ('Alice Agent', '0x1111111111111111111111111111111111111111', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice'),
--   ('Bob Bot', '0x2222222222222222222222222222222222222222', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob');
