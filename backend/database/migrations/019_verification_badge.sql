-- ============================================
-- Migration: 019_verification_badge
-- Purpose: Create the verification_badge table referenced by BeelyAuthService
--          agent profile queries. Without this table every getAgentById call
--          throws a PostgreSQL 42P01 (undefined_table) error.
-- ============================================

CREATE TABLE IF NOT EXISTS verification_badge (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id    UUID NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
    provider    VARCHAR(50) NOT NULL,           -- e.g. 'twitter', 'github'
    provider_wallet       VARCHAR(255),
    provider_agent_id     VARCHAR(255),
    verified    BOOLEAN DEFAULT FALSE,
    reputation_score      DECIMAL(5,2) DEFAULT 0,
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_verification_badge_agent ON verification_badge(agent_id);
