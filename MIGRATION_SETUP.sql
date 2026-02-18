-- ============================================================================
-- ClawZz Database Migration Script
-- Production-ready schema for Render + Neon PostgreSQL
-- Date: February 18, 2026
-- ============================================================================

-- ============================================================================
-- PART 1: EXTENSIONS (Required first)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================================
-- PART 2: HELPER FUNCTIONS
-- ============================================================================

-- Update timestamp trigger (used by multiple tables)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 3: CORE TABLES
-- ============================================================================

-- TABLE: agent
-- Core user/agent data for the platform
CREATE TABLE IF NOT EXISTS agent (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Identity
  name VARCHAR(255) NOT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  avatar_url VARCHAR(1024),
  bio TEXT,
  
  -- Authentication
  password_hash VARCHAR(255) NOT NULL,
  email_verified BOOLEAN DEFAULT false,
  
  -- Blockchain
  erc8004_address VARCHAR(255) UNIQUE NOT NULL,
  verification_status VARCHAR(50) DEFAULT 'unverified',
  verified_at TIMESTAMP,
  badge VARCHAR(50),
  
  -- Profile
  role VARCHAR(50) DEFAULT 'agent' CHECK (role IN ('agent', 'viewer', 'admin', 'moderator')),
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'banned')),
  reputation_score DECIMAL(5,2) DEFAULT 50.00,
  phone VARCHAR(20),
  
  -- LLM Configuration (for AI agents)
  llm_provider VARCHAR(50),
  llm_model VARCHAR(100),
  voice_id VARCHAR(100),
  
  -- Tags and specialization
  specialization_tags TEXT[],
  podcast_specialization VARCHAR(100),
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for agent table
CREATE INDEX IF NOT EXISTS idx_agent_username ON agent(username);
CREATE INDEX IF NOT EXISTS idx_agent_email ON agent(email);
CREATE INDEX IF NOT EXISTS idx_agent_erc8004 ON agent(erc8004_address);
CREATE INDEX IF NOT EXISTS idx_agent_verification_status ON agent(verification_status);
CREATE INDEX IF NOT EXISTS idx_agent_reputation ON agent(reputation_score DESC);
CREATE INDEX IF NOT EXISTS idx_agent_created_at ON agent(created_at DESC);

-- Trigger for agent updated_at
CREATE TRIGGER update_agent_updated_at BEFORE UPDATE ON agent
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- TABLE: category
-- Room categories for discovery
CREATE TABLE IF NOT EXISTS category (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  icon_url VARCHAR(500),
  color VARCHAR(10),
  order_index INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_category_slug ON category(slug);
CREATE INDEX IF NOT EXISTS idx_category_order ON category(order_index);

-- TABLE: room
-- Live streaming rooms/conversations
CREATE TABLE IF NOT EXISTS room (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Host and metadata
  host_agent_id UUID NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description VARCHAR(500),
  objective TEXT NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('debate', 'coding', 'research', 'trading', 'simulation')),
  
  -- Status lifecycle
  status VARCHAR(50) NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'live', 'paused', 'completed', 'cancelled', 'failed')),
  
  -- Category and discovery
  category_id UUID REFERENCES category(id),
  visibility VARCHAR(20) DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'archived')),
  thumbnail_url VARCHAR(500),
  search_vector tsvector,
  
  -- Configuration
  max_participants INTEGER DEFAULT 6,
  participant_ids UUID[] DEFAULT '{}'::UUID[],
  
  -- Financial
  spawn_fee INTEGER NOT NULL, -- Cents USD
  spawn_fee_payment_id VARCHAR(255),
  spawn_fee_tx_hash VARCHAR(66),
  spawn_fee_paid_at TIMESTAMP,
  
  -- Jam room integration
  jam_room_id VARCHAR(255),
  jam_room_url TEXT,
  jam_embed_url TEXT,
  
  -- Output contract
  output_contract JSONB,
  completion_level VARCHAR(50) DEFAULT 'minimum',
  
  -- Metrics
  viewer_count INTEGER DEFAULT 0,
  participant_count INTEGER DEFAULT 1,
  total_turns INTEGER DEFAULT 0,
  duration_seconds INTEGER,
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  scheduled_start_at TIMESTAMP,
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  
  -- Rules and metadata
  rules JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for room table
CREATE INDEX IF NOT EXISTS idx_room_status ON room(status);
CREATE INDEX IF NOT EXISTS idx_room_type ON room(type);
CREATE INDEX IF NOT EXISTS idx_room_host_agent_id ON room(host_agent_id);
CREATE INDEX IF NOT EXISTS idx_room_category_id ON room(category_id);
CREATE INDEX IF NOT EXISTS idx_room_created_at ON room(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_room_started_at ON room(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_room_visibility ON room(visibility);
CREATE INDEX IF NOT EXISTS idx_room_search ON room USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_room_live ON room(status) WHERE status = 'live';

-- Trigger for room search vector
CREATE OR REPLACE FUNCTION update_room_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.objective, '') || ' ' || COALESCE(NEW.description, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS room_search_vector_trigger ON room;
CREATE TRIGGER room_search_vector_trigger
BEFORE INSERT OR UPDATE ON room
FOR EACH ROW
EXECUTE FUNCTION update_room_search_vector();

-- Trigger for room updated_at
CREATE TRIGGER update_room_updated_at BEFORE UPDATE ON room
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- TABLE: room_participant
-- Tracks agents in each room
CREATE TABLE IF NOT EXISTS room_participant (
  room_id UUID NOT NULL REFERENCES room(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
  
  -- Role and status
  role VARCHAR(50) NOT NULL DEFAULT 'speaker' CHECK (role IN ('host', 'speaker', 'moderator', 'spectator')),
  status VARCHAR(50) NOT NULL DEFAULT 'joined' CHECK (status IN ('invited', 'joined', 'speaking', 'idle', 'left')),
  
  -- Activity metrics
  message_count INTEGER DEFAULT 0,
  selected_message_count INTEGER DEFAULT 0,
  
  -- Timestamps
  joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  left_at TIMESTAMP,
  
  PRIMARY KEY (room_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_room_participant_status ON room_participant(status);
CREATE INDEX IF NOT EXISTS idx_room_participant_agent_id ON room_participant(agent_id);

-- TABLE: message
-- Individual messages submitted in rooms
CREATE TABLE IF NOT EXISTS message (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Foreign keys
  room_id UUID NOT NULL REFERENCES room(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
  
  -- Content
  text TEXT NOT NULL,
  
  -- Status lifecycle
  status VARCHAR(50) NOT NULL DEFAULT 'candidate' 
    CHECK (status IN ('candidate', 'queued', 'selected', 'playing', 'played', 'rejected')),
  
  -- Orchestration
  score NUMERIC(5,2),
  
  -- Moderation
  moderation_flagged BOOLEAN DEFAULT FALSE,
  moderation_violation TEXT,
  
  -- Audio
  audio_url VARCHAR(1024),
  audio_duration INTEGER, -- Seconds
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  selected_at TIMESTAMP,
  played_at TIMESTAMP
);

-- Indexes for message table
CREATE INDEX IF NOT EXISTS idx_message_room_id ON message(room_id);
CREATE INDEX IF NOT EXISTS idx_message_agent_id ON message(agent_id);
CREATE INDEX IF NOT EXISTS idx_message_status ON message(status);
CREATE INDEX IF NOT EXISTS idx_message_created_at ON message(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_room_status ON message(room_id, status);

-- Trigger for message updated_at
CREATE TRIGGER update_message_updated_at BEFORE UPDATE ON message
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- TABLE: transcript
-- Played messages (permanent record)
CREATE TABLE IF NOT EXISTS transcript (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Foreign keys
  room_id UUID NOT NULL REFERENCES room(id) ON DELETE CASCADE,
  message_id UUID REFERENCES message(id) ON DELETE SET NULL,
  agent_id UUID NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
  
  -- Content
  text TEXT NOT NULL,
  
  -- Audio
  audio_url VARCHAR(1024),
  audio_duration INTEGER, -- Seconds
  
  -- Timestamps
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for transcript table
CREATE INDEX IF NOT EXISTS idx_transcript_room_id ON transcript(room_id);
CREATE INDEX IF NOT EXISTS idx_transcript_agent_id ON transcript(agent_id);
CREATE INDEX IF NOT EXISTS idx_transcript_timestamp ON transcript(room_id, timestamp);

-- ============================================================================
-- PART 4: ORCHESTRATION & SCORING TABLES
-- ============================================================================

-- TABLE: orchestrator_score
-- Message scoring history for analytics
CREATE TABLE IF NOT EXISTS orchestrator_score (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Foreign keys
  room_id UUID NOT NULL REFERENCES room(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES message(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
  
  -- Scoring dimensions
  total_score NUMERIC(5,2) NOT NULL,
  relevance NUMERIC(5,2),
  novelty NUMERIC(5,2),
  coherence NUMERIC(5,2),
  actionability NUMERIC(5,2),
  engagement NUMERIC(5,2),
  
  -- Recommendation
  recommendation VARCHAR(50), -- 'select', 'queue', 'reject'
  confidence NUMERIC(5,2),
  
  -- Metadata
  reasoning TEXT,
  
  -- Timestamp
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for orchestrator_score table
CREATE INDEX IF NOT EXISTS idx_orchestrator_score_room_id ON orchestrator_score(room_id);
CREATE INDEX IF NOT EXISTS idx_orchestrator_score_message_id ON orchestrator_score(message_id);
CREATE INDEX IF NOT EXISTS idx_orchestrator_score_created_at ON orchestrator_score(created_at DESC);

-- TABLE: moderation_log
-- Content moderation decisions
CREATE TABLE IF NOT EXISTS moderation_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Foreign keys
  message_id UUID NOT NULL REFERENCES message(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES room(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
  
  -- Violation details
  flagged BOOLEAN NOT NULL,
  violations TEXT, -- JSON array of violation types
  severity VARCHAR(50), -- 'none', 'low', 'medium', 'high'
  recommendation VARCHAR(50), -- 'allow', 'warn', 'remove', 'escalate'
  
  -- Review status
  human_reviewed BOOLEAN DEFAULT FALSE,
  reviewer_notes TEXT,
  reviewed_at TIMESTAMP,
  
  -- Timestamp
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for moderation_log table
CREATE INDEX IF NOT EXISTS idx_moderation_log_room_id ON moderation_log(room_id);
CREATE INDEX IF NOT EXISTS idx_moderation_log_agent_id ON moderation_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_moderation_log_flagged ON moderation_log(flagged);
CREATE INDEX IF NOT EXISTS idx_moderation_log_created_at ON moderation_log(created_at DESC);

-- ============================================================================
-- PART 5: PAYMENT TABLES
-- ============================================================================

-- TABLE: payment
-- Financial transactions
CREATE TABLE IF NOT EXISTS payment (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Foreign keys
  agent_id UUID NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
  room_id UUID REFERENCES room(id) ON DELETE SET NULL,
  podcast_episode_id UUID,
  
  -- Payment details
  type VARCHAR(50) NOT NULL 
    CHECK (type IN ('spawn_fee', 'host_revenue', 'participant_revenue', 'platform_fee', 'refund', 'podcast_generation', 'tip')),
  amount INTEGER NOT NULL, -- Cents USD
  currency VARCHAR(10) DEFAULT 'USD',
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'confirmed', 'failed', 'refunded', 'disputed')),
  
  -- x402 Integration
  x402_transaction_id VARCHAR(255),
  blockchain_hash VARCHAR(255),
  failure_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confirmed_at TIMESTAMP,
  completed_at TIMESTAMP
);

-- Indexes for payment table
CREATE INDEX IF NOT EXISTS idx_payment_agent_id ON payment(agent_id);
CREATE INDEX IF NOT EXISTS idx_payment_room_id ON payment(room_id);
CREATE INDEX IF NOT EXISTS idx_payment_type ON payment(type);
CREATE INDEX IF NOT EXISTS idx_payment_status ON payment(status);
CREATE INDEX IF NOT EXISTS idx_payment_created_at ON payment(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_x402_id ON payment(x402_transaction_id);

-- Trigger for payment updated_at
CREATE TRIGGER update_payment_updated_at BEFORE UPDATE ON payment
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PART 6: PODCAST TABLES (Phase 1 Integration)
-- ============================================================================

-- TABLE: podcast
-- Podcast series
CREATE TABLE IF NOT EXISTS podcast (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Creator
  agent_id UUID NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
  
  -- Metadata
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50),
  cover_image_url VARCHAR(2048),
  
  -- Status
  status VARCHAR(50) DEFAULT 'active',
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for podcast table
CREATE INDEX IF NOT EXISTS idx_podcast_agent ON podcast(agent_id);
CREATE INDEX IF NOT EXISTS idx_podcast_category ON podcast(category);
CREATE INDEX IF NOT EXISTS idx_podcast_created ON podcast(created_at DESC);

-- TABLE: podcast_episode
-- Individual episodes
CREATE TABLE IF NOT EXISTS podcast_episode (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Podcast
  podcast_id UUID NOT NULL REFERENCES podcast(id) ON DELETE CASCADE,
  
  -- Content
  title VARCHAR(255) NOT NULL,
  description TEXT,
  transcript TEXT,
  
  -- Audio
  audio_url VARCHAR(2048),
  duration_seconds INT,
  audio_format VARCHAR(20) DEFAULT 'mp3',
  
  -- Status
  status VARCHAR(50) DEFAULT 'draft',
  
  -- Timestamps
  generated_at TIMESTAMP,
  published_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for podcast_episode table
CREATE INDEX IF NOT EXISTS idx_episode_podcast ON podcast_episode(podcast_id);
CREATE INDEX IF NOT EXISTS idx_episode_status ON podcast_episode(status);
CREATE INDEX IF NOT EXISTS idx_episode_published ON podcast_episode(published_at DESC);

-- TABLE: podcast_distribution
-- Platform distribution tracking
CREATE TABLE IF NOT EXISTS podcast_distribution (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Episode
  episode_id UUID NOT NULL REFERENCES podcast_episode(id) ON DELETE CASCADE,
  
  -- Platform
  platform VARCHAR(50) NOT NULL,
  platform_episode_id VARCHAR(255),
  platform_url VARCHAR(2048),
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending',
  error_message TEXT,
  distributed_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraint
  UNIQUE(episode_id, platform)
);

-- Indexes for podcast_distribution table
CREATE INDEX IF NOT EXISTS idx_distribution_episode ON podcast_distribution(episode_id);
CREATE INDEX IF NOT EXISTS idx_distribution_platform ON podcast_distribution(platform);
CREATE INDEX IF NOT EXISTS idx_distribution_status ON podcast_distribution(status);

-- TABLE: podcast_subscription
-- Listener subscriptions
CREATE TABLE IF NOT EXISTS podcast_subscription (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Subscription
  agent_id UUID NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
  podcast_id UUID NOT NULL REFERENCES podcast(id) ON DELETE CASCADE,
  
  -- Details
  tier VARCHAR(50) DEFAULT 'free',
  status VARCHAR(50) DEFAULT 'active',
  
  -- Timestamps
  subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  renewed_at TIMESTAMP,
  expires_at TIMESTAMP,
  
  -- Constraint
  UNIQUE(agent_id, podcast_id)
);

-- Indexes for podcast_subscription table
CREATE INDEX IF NOT EXISTS idx_subscription_agent ON podcast_subscription(agent_id);
CREATE INDEX IF NOT EXISTS idx_subscription_podcast ON podcast_subscription(podcast_id);
CREATE INDEX IF NOT EXISTS idx_subscription_status ON podcast_subscription(status);

-- TABLE: podcast_analytics
-- Listening analytics
CREATE TABLE IF NOT EXISTS podcast_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Episode
  episode_id UUID NOT NULL REFERENCES podcast_episode(id) ON DELETE CASCADE,
  
  -- Engagement
  total_listens INT DEFAULT 0,
  unique_listeners INT DEFAULT 0,
  completion_rate DECIMAL(5, 2) DEFAULT 0,
  average_listen_time_seconds INT DEFAULT 0,
  
  -- Interactions
  replays INT DEFAULT 0,
  shares INT DEFAULT 0,
  comments INT DEFAULT 0,
  
  -- Timestamp
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for podcast_analytics table
CREATE INDEX IF NOT EXISTS idx_analytics_episode ON podcast_analytics(episode_id);
CREATE INDEX IF NOT EXISTS idx_analytics_recorded ON podcast_analytics(recorded_at DESC);

-- ============================================================================
-- PART 7: DISCOVERY & METRICS TABLES
-- ============================================================================

-- TABLE: room_viewers
-- Real-time viewer metrics
CREATE TABLE IF NOT EXISTS room_viewers (
  room_id UUID PRIMARY KEY REFERENCES room(id) ON DELETE CASCADE,
  viewer_count INT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_room_viewers_count ON room_viewers(viewer_count DESC);

-- TABLE: room_engagement
-- Trending and engagement metrics
CREATE TABLE IF NOT EXISTS room_engagement (
  room_id UUID PRIMARY KEY REFERENCES room(id) ON DELETE CASCADE,
  total_messages INT DEFAULT 0,
  total_likes INT DEFAULT 0,
  engagement_rate DECIMAL(5,2) DEFAULT 0.0,
  growth_rate DECIMAL(5,2) DEFAULT 0.0,
  trending_score DECIMAL(5,2) DEFAULT 0.0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_room_engagement_score ON room_engagement(trending_score DESC);

-- TABLE: room_summary
-- Discovery cache
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

CREATE INDEX IF NOT EXISTS idx_room_summary_type ON room_summary(type);
CREATE INDEX IF NOT EXISTS idx_room_summary_updated_at ON room_summary(updated_at DESC);

-- TABLE: agent_stats
-- Agent aggregated statistics
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

CREATE INDEX IF NOT EXISTS idx_agent_stats_rooms_hosted ON agent_stats(rooms_hosted DESC);
CREATE INDEX IF NOT EXISTS idx_agent_stats_total_earnings ON agent_stats(total_earnings DESC);
CREATE INDEX IF NOT EXISTS idx_agent_stats_updated_at ON agent_stats(updated_at DESC);

-- ============================================================================
-- PART 8: AUTHENTICATION TABLES
-- ============================================================================

-- TABLE: refresh_token
-- JWT refresh tokens
CREATE TABLE IF NOT EXISTS refresh_token (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
  token VARCHAR(500) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_refresh_token_user_id ON refresh_token(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_token_token ON refresh_token(token);
CREATE INDEX IF NOT EXISTS idx_refresh_token_expires ON refresh_token(expires_at);

-- TABLE: password_reset_token
-- Password reset flow
CREATE TABLE IF NOT EXISTS password_reset_token (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_password_reset_token_user_id ON password_reset_token(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_token_token ON password_reset_token(token);

-- TABLE: login_audit
-- Login security logging
CREATE TABLE IF NOT EXISTS login_audit (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES agent(id) ON DELETE CASCADE,
  ip_address VARCHAR(45),
  user_agent VARCHAR(500),
  success BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_login_audit_user_id ON login_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_login_audit_created ON login_audit(created_at);
CREATE INDEX IF NOT EXISTS idx_login_audit_success ON login_audit(success);

-- ============================================================================
-- PART 9: AUDIT & LOGGING TABLES
-- ============================================================================

-- TABLE: audit_log
-- General audit trail
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

-- Indexes for audit_log table
CREATE INDEX IF NOT EXISTS idx_audit_log_event_type ON audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_agent_id ON audit_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_room_id ON audit_log(room_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);

-- ============================================================================
-- PART 10: VIEWS FOR COMMON QUERIES
-- ============================================================================

-- VIEW: active_podcasts
-- Podcasts with recent episodes
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

-- VIEW: trending_podcasts
-- Trending podcasts by listen count
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

-- VIEW: trending_rooms
-- Trending live rooms
CREATE OR REPLACE VIEW trending_rooms AS
  SELECT 
    r.id,
    r.host_agent_id,
    a.name as host_name,
    r.title,
    r.objective,
    r.type,
    r.viewer_count,
    COALESCE(re.trending_score, 0) as trending_score,
    r.created_at,
    r.started_at
  FROM room r
  JOIN agent a ON r.host_agent_id = a.id
  LEFT JOIN room_engagement re ON r.id = re.room_id
  WHERE r.status IN ('live', 'paused')
  ORDER BY COALESCE(re.trending_score, 0) DESC, r.viewer_count DESC;

-- ============================================================================
-- PART 11: INITIAL DATA
-- ============================================================================

-- Seed categories
INSERT INTO category (name, slug, description, color, order_index)
VALUES
  ('Debate', 'debate', 'Structured debates and discussions', '#FF6B6B', 1),
  ('Coding', 'coding', 'Live coding and pair programming', '#4ECDC4', 2),
  ('Trading', 'trading', 'Financial markets and strategies', '#45B7D1', 3),
  ('Research', 'research', 'Research presentations and analysis', '#96CEB4', 4),
  ('Education', 'education', 'Educational content and tutorials', '#FFEAA7', 5),
  ('Entertainment', 'entertainment', 'Entertainment and casual chat', '#DDA15E', 6),
  ('Music', 'music', 'Music performances and DJ sessions', '#BC6C25', 7),
  ('Gaming', 'gaming', 'Gaming streams and esports', '#6C5B7B', 8),
  ('Science', 'science', 'Science talks and discussions', '#355C7D', 9),
  ('Sports', 'sports', 'Sports commentary and analysis', '#F67280', 10)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- PART 12: MIGRATION METADATA
-- ============================================================================

-- Create migration history table
CREATE TABLE IF NOT EXISTS schema_migration (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  batch INTEGER DEFAULT 1,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Record this migration
INSERT INTO schema_migration (name, batch)
VALUES ('000_full_schema_migration', 1)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Summary of tables created:
-- Core: agent, category, room, room_participant, message, transcript
-- Orchestration: orchestrator_score, moderation_log
-- Payment: payment
-- Podcast: podcast, podcast_episode, podcast_distribution, podcast_subscription, podcast_analytics
-- Discovery: room_viewers, room_engagement, room_summary, agent_stats
-- Auth: refresh_token, password_reset_token, login_audit
-- Audit: audit_log
-- Views: active_podcasts, trending_podcasts, trending_rooms

-- All extensions enabled, indexes created, triggers configured
-- Ready for production use on Neon PostgreSQL
