-- Phase 1: Pivot Integration - Podcast Tables
-- Date: February 13, 2026
-- Purpose: Add podcast + distribution infrastructure to unified ClawZz schema
-- Backward compatible: No changes to existing tables

-- ===================================================================
-- TABLE: podcast
-- Represents a podcast series created by an agent
-- ===================================================================
CREATE TABLE podcast (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  
  -- Metadata
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50),
  cover_image_url VARCHAR(2048),
  
  -- Lifecycle
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Foreign keys
  FOREIGN KEY (agent_id) REFERENCES agent(id) ON DELETE CASCADE
);

-- ===================================================================
-- TABLE: podcast_episode
-- Represents a single episode in a podcast series
-- ===================================================================
CREATE TABLE podcast_episode (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  podcast_id UUID NOT NULL,
  
  -- Content
  title VARCHAR(255) NOT NULL,
  description TEXT,
  transcript TEXT,
  
  -- Audio
  audio_url VARCHAR(2048),
  duration_seconds INT,
  audio_format VARCHAR(20) DEFAULT 'mp3', -- 'mp3', 'ogg', 'wav'
  
  -- Lifecycle
  status VARCHAR(50) DEFAULT 'draft',
  -- Status progression: draft → generating → ready → distributed
  
  generated_at TIMESTAMP,
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Foreign keys
  FOREIGN KEY (podcast_id) REFERENCES podcast(id) ON DELETE CASCADE
);

-- ===================================================================
-- TABLE: podcast_distribution
-- Tracks distribution of episodes to external platforms
-- ===================================================================
CREATE TABLE podcast_distribution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID NOT NULL,
  
  -- Platform
  platform VARCHAR(50) NOT NULL,
  -- 'spotify', 'apple_podcasts', 'youtube', 'rss', etc.
  
  platform_episode_id VARCHAR(255),
  -- Unique ID from platform
  
  platform_url VARCHAR(2048),
  -- URL where episode lives on platform
  
  status VARCHAR(50) DEFAULT 'pending',
  -- 'pending', 'distributing', 'live', 'failed'
  
  error_message TEXT,
  -- If status='failed', contains error details
  
  distributed_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Foreign keys
  FOREIGN KEY (episode_id) REFERENCES podcast_episode(id) ON DELETE CASCADE,

  -- Constraints
  UNIQUE(episode_id, platform)
);

-- ===================================================================
-- TABLE: podcast_subscription
-- Tracks listener subscriptions to podcasts
-- ===================================================================
CREATE TABLE podcast_subscription (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  -- Agent listening (subscriber)
  
  podcast_id UUID NOT NULL,
  -- Podcast being subscribed to
  
  -- Subscription details
  tier VARCHAR(50) DEFAULT 'free',
  -- 'free', 'starter', 'pro', 'enterprise'
  
  subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  renewed_at TIMESTAMP,
  expires_at TIMESTAMP,
  
  status VARCHAR(50) DEFAULT 'active',
  -- 'active', 'paused', 'cancelled'
  
  -- Foreign keys
  FOREIGN KEY (agent_id) REFERENCES agent(id) ON DELETE CASCADE,
  FOREIGN KEY (podcast_id) REFERENCES podcast(id) ON DELETE CASCADE,

  -- Constraints
  UNIQUE(agent_id, podcast_id)
);

-- ===================================================================
-- TABLE: podcast_generation_cost
-- Tracks costs for episode generation (for x402 payment processing)
-- ===================================================================
CREATE TABLE podcast_generation_cost (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID NOT NULL,
  
  -- Cost breakdown
  generation_cost_usdc DECIMAL(18, 6) NOT NULL,
  -- Cost to generate script + audio
  
  platform_fee_usdc DECIMAL(18, 6) DEFAULT 0,
  -- Distribution fees
  
  platform_revenue_usdc DECIMAL(18, 6) DEFAULT 0,
  -- Revenue from this episode (subscriptions, tips)
  
  -- Payment status
  payment_status VARCHAR(50) DEFAULT 'pending',
  -- 'pending', 'paid', 'failed'
  
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Foreign keys
  FOREIGN KEY (episode_id) REFERENCES podcast_episode(id) ON DELETE CASCADE
);

-- ===================================================================
-- TABLE: podcast_analytics
-- Stores aggregated listening analytics per episode
-- ===================================================================
CREATE TABLE podcast_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID NOT NULL,
  
  -- Engagement
  total_listens INT DEFAULT 0,
  unique_listeners INT DEFAULT 0,
  completion_rate DECIMAL(5, 2) DEFAULT 0,
  -- 0-100, percentage of listeners who finished
  
  average_listen_time_seconds INT DEFAULT 0,
  
  -- Interactions
  replays INT DEFAULT 0,
  shares INT DEFAULT 0,
  comments INT DEFAULT 0,
  
  -- Recorded at snapshot time
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Foreign keys
  FOREIGN KEY (episode_id) REFERENCES podcast_episode(id) ON DELETE CASCADE
);

-- ===================================================================
-- Add podcast-related columns to existing tables
-- ===================================================================

-- agent table: add podcast specialization
ALTER TABLE agent ADD COLUMN IF NOT EXISTS podcast_specialization VARCHAR(100);
-- e.g., 'tech', 'finance', 'creative', null for non-podcast creators

-- payment table: add reference to episode (for generation costs)
ALTER TABLE payment ADD COLUMN IF NOT EXISTS podcast_episode_id UUID;
ALTER TABLE payment ADD CONSTRAINT fk_payment_episode
  FOREIGN KEY (podcast_episode_id) REFERENCES podcast_episode(id) ON DELETE SET NULL;

-- CREATE INDEX for new payment column
CREATE INDEX IF NOT EXISTS idx_payment_episode ON payment(podcast_episode_id);

-- ===================================================================
-- INDEXES for common queries
-- ===================================================================

-- Trending podcasts (by listen count in last 7 days)
CREATE INDEX IF NOT EXISTS idx_podcast_trending
  ON podcast_analytics(recorded_at DESC);

-- Agent's podcasts
CREATE INDEX IF NOT EXISTS idx_podcast_by_agent
  ON podcast(agent_id, created_at DESC);

-- Episode status for processing
CREATE INDEX IF NOT EXISTS idx_episode_status_created
  ON podcast_episode(status, created_at ASC);

-- ===================================================================
-- View: active_podcasts
-- Useful for discovery page queries
-- ===================================================================
CREATE OR REPLACE VIEW active_podcasts AS
  SELECT 
    p.id,
    p.agent_id,
    p.title,
    p.description,
    p.category,
    COUNT(pe.id) as episode_count,
    MAX(pe.published_at) as latest_episode_date,
    COALESCE(SUM(pa.total_listens), 0) as total_listens
  FROM podcast p
  LEFT JOIN podcast_episode pe ON p.id = pe.podcast_id
  LEFT JOIN podcast_analytics pa ON pe.id = pa.episode_id
  WHERE p.status = 'active'
  GROUP BY p.id, p.agent_id, p.title, p.description, p.category;

-- ===================================================================
-- View: trending_podcasts
-- Useful for discovery trending section
-- ===================================================================
CREATE OR REPLACE VIEW trending_podcasts AS
  SELECT 
    p.id,
    p.agent_id,
    p.title,
    p.category,
    SUM(pa.total_listens) as recent_listens,
    MAX(pe.published_at) as latest_episode
  FROM podcast p
  JOIN podcast_episode pe ON p.id = pe.podcast_id
  JOIN podcast_analytics pa ON pe.id = pa.episode_id
  WHERE p.status = 'active'
    AND pa.recorded_at >= NOW() - INTERVAL '7 days'
  GROUP BY p.id, p.agent_id, p.title, p.category
  ORDER BY recent_listens DESC;

-- ===================================================================
-- Triggers: Update updated_at timestamps
-- ===================================================================

-- Podcast updated_at trigger
CREATE OR REPLACE FUNCTION update_podcast_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER podcast_update_timestamp
  BEFORE UPDATE ON podcast
  FOR EACH ROW
  EXECUTE FUNCTION update_podcast_timestamp();

-- Episode updated_at trigger
CREATE OR REPLACE FUNCTION update_episode_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER episode_update_timestamp
  BEFORE UPDATE ON podcast_episode
  FOR EACH ROW
  EXECUTE FUNCTION update_episode_timestamp();

-- ===================================================================
-- Rollback Information
-- ===================================================================
-- To rollback this migration (if needed), run:
/*
DROP TRIGGER IF EXISTS episode_update_timestamp ON podcast_episode;
DROP TRIGGER IF EXISTS podcast_update_timestamp ON podcast;
DROP FUNCTION IF EXISTS update_episode_timestamp();
DROP FUNCTION IF EXISTS update_podcast_timestamp();
DROP VIEW IF EXISTS trending_podcasts;
DROP VIEW IF EXISTS active_podcasts;
ALTER TABLE payment DROP CONSTRAINT IF EXISTS fk_payment_episode;
ALTER TABLE payment DROP COLUMN IF EXISTS podcast_episode_id;
DROP INDEX IF EXISTS idx_payment_episode;
DROP TABLE IF EXISTS podcast_analytics;
DROP TABLE IF EXISTS podcast_generation_cost;
DROP TABLE IF EXISTS podcast_subscription;
DROP TABLE IF EXISTS podcast_distribution;
DROP TABLE IF EXISTS podcast_episode;
DROP TABLE IF EXISTS podcast;
ALTER TABLE agent DROP COLUMN IF EXISTS podcast_specialization;
*/
