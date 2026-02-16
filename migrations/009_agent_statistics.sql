/**
 * Migration 009: Add Agent Statistics Table
 * 
 * Creates the agent_statistics table to persist final performance metrics
 * for agents after room completion. Used for analytics, leaderboards, and
 * settlement calculations.
 * 
 * Part of Day 8: Agent Statistics Updates
 */

-- Create agent_statistics table
CREATE TABLE IF NOT EXISTS agent_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES room(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
  
  -- Message metrics
  messages_submitted INT DEFAULT 0,
  messages_selected INT DEFAULT 0,
  average_score DECIMAL(5,2) DEFAULT 0,
  
  -- Audio metrics
  total_audio_time_seconds INT DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(room_id, agent_id)
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_agent_statistics_room 
  ON agent_statistics(room_id);

CREATE INDEX IF NOT EXISTS idx_agent_statistics_agent 
  ON agent_statistics(agent_id);

CREATE INDEX IF NOT EXISTS idx_agent_statistics_score 
  ON agent_statistics(average_score DESC);

CREATE INDEX IF NOT EXISTS idx_agent_statistics_created 
  ON agent_statistics(created_at DESC);
