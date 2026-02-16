-- Migration 008: Add message table and agent_statistics
-- Date: February 17, 2026
-- Purpose: Enable turn-by-turn message management and agent tracking

-- Create message table
CREATE TABLE IF NOT EXISTS message (
  id UUID PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES room(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'candidate',  -- candidate|queued|selected|playing|played|rejected
  score INT,                                -- 0-100 orchestrator score
  audio_url TEXT,                           -- S3 URL for synthesized audio
  selected_at TIMESTAMP,                    -- When selected as next turn
  played_at TIMESTAMP,                      -- When audio was broadcast
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_message_room_status ON message(room_id, status);
CREATE INDEX IF NOT EXISTS idx_message_agent_room ON message(agent_id, room_id);
CREATE INDEX IF NOT EXISTS idx_message_created_at ON message(created_at);
CREATE INDEX IF NOT EXISTS idx_message_status ON message(status);

-- Create agent_statistics table (per-room agent stats)
CREATE TABLE IF NOT EXISTS agent_statistics (
  id UUID PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES room(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
  messages_submitted INT DEFAULT 0,
  messages_selected INT DEFAULT 0,
  average_score DECIMAL(5,2),
  total_audio_time_seconds INT DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(room_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_statistics_room_agent ON agent_statistics(room_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_statistics_agent ON agent_statistics(agent_id);

-- Update room table with orchestration columns (if not already present)
ALTER TABLE room
ADD COLUMN IF NOT EXISTS turn_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS completion_percentage INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_turn_at TIMESTAMP;

-- Create index for turn-based queries
CREATE INDEX IF NOT EXISTS idx_room_turn_count ON room(turn_count);
CREATE INDEX IF NOT EXISTS idx_room_status_live ON room(status) WHERE status = 'live';
