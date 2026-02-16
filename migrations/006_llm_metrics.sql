-- Phase 5: LLM Safety Metrics Schema
-- Created: February 16, 2026
-- Purpose: Track LLM request metrics for monitoring, debugging, and optimization

-- Create table for tracking LLM request metrics
CREATE TABLE IF NOT EXISTS llm_request_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Context information
  room_id UUID NOT NULL REFERENCES room(id) ON DELETE CASCADE,
  message_id UUID NOT NULL,
  
  -- Request details
  prompt_length INTEGER NOT NULL,
  prompt_hash VARCHAR(255),  -- SHA-256 hash for deduplication
  response_length INTEGER,
  
  -- Performance metrics
  duration_ms INTEGER NOT NULL,  -- Wall clock time
  token_usage INTEGER,  -- Estimated tokens used
  
  -- Safety metrics
  fallback_triggered BOOLEAN DEFAULT FALSE,
  sanitization_violations TEXT[],  -- JSON array of violations
  retry_count INTEGER DEFAULT 0,
  
  -- Model information
  model VARCHAR(100) NOT NULL,
  temperature FLOAT,
  max_tokens INTEGER,
  
  -- Results
  overall_score FLOAT,
  relevance_score FLOAT,
  novelty_score FLOAT,
  coherence_score FLOAT,
  actionability_score FLOAT,
  engagement_score FLOAT,
  
  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_llm_metrics_room_id ON llm_request_metrics(room_id);
CREATE INDEX IF NOT EXISTS idx_llm_metrics_created_at ON llm_request_metrics(created_at);
CREATE INDEX IF NOT EXISTS idx_llm_metrics_model ON llm_request_metrics(model);
CREATE INDEX IF NOT EXISTS idx_llm_metrics_fallback ON llm_request_metrics(fallback_triggered);
CREATE INDEX IF NOT EXISTS idx_llm_metrics_prompt_hash ON llm_request_metrics(prompt_hash);

-- View for LLM performance analytics
CREATE OR REPLACE VIEW llm_request_analytics AS
SELECT
  DATE_TRUNC('hour', created_at) AS hour,
  model,
  COUNT(*) AS request_count,
  AVG(duration_ms) AS avg_duration_ms,
  MAX(duration_ms) AS max_duration_ms,
  MIN(duration_ms) AS min_duration_ms,
  SUM(CASE WHEN fallback_triggered THEN 1 ELSE 0 END) AS fallback_count,
  SUM(CASE WHEN fallback_triggered THEN 1 ELSE 0 END)::FLOAT / COUNT(*) AS fallback_rate,
  AVG(overall_score) AS avg_overall_score,
  AVG(token_usage) AS avg_token_usage,
  COUNT(DISTINCT room_id) AS unique_rooms
FROM llm_request_metrics
GROUP BY DATE_TRUNC('hour', created_at), model
ORDER BY hour DESC;

-- View for per-model statistics
CREATE OR REPLACE VIEW llm_model_statistics AS
SELECT
  model,
  COUNT(*) AS total_requests,
  AVG(duration_ms) AS avg_duration_ms,
  STDDEV(duration_ms) AS stddev_duration_ms,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms) AS median_duration_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_duration_ms,
  SUM(CASE WHEN fallback_triggered THEN 1 ELSE 0 END)::FLOAT / COUNT(*) AS fallback_rate,
  AVG(overall_score) AS avg_overall_score,
  MAX(created_at) AS last_request_at
FROM llm_request_metrics
GROUP BY model;

-- View for sanitization violations tracking
CREATE OR REPLACE VIEW sanitization_violations_summary AS
SELECT
  DATE_TRUNC('day', created_at) AS day,
  COUNT(*) AS violation_count,
  COUNT(DISTINCT room_id) AS affected_rooms,
  MAX(updated_at) AS last_violation
FROM llm_request_metrics
WHERE sanitization_violations IS NOT NULL AND array_length(sanitization_violations, 1) > 0
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY day DESC;

-- Helper function to log LLM request metric
CREATE OR REPLACE FUNCTION log_llm_request_metric(
  p_room_id UUID,
  p_message_id UUID,
  p_prompt_length INTEGER,
  p_response_length INTEGER,
  p_duration_ms INTEGER,
  p_token_usage INTEGER DEFAULT NULL,
  p_fallback_triggered BOOLEAN DEFAULT FALSE,
  p_model VARCHAR DEFAULT 'claude-opus',
  p_overall_score FLOAT DEFAULT NULL,
  p_relevance_score FLOAT DEFAULT NULL,
  p_novelty_score FLOAT DEFAULT NULL,
  p_coherence_score FLOAT DEFAULT NULL,
  p_actionability_score FLOAT DEFAULT NULL,
  p_engagement_score FLOAT DEFAULT NULL,
  p_retry_count INTEGER DEFAULT 0
)
RETURNS UUID AS $$
DECLARE
  metric_id UUID;
  prompt_hash_value VARCHAR(255);
BEGIN
  -- Calculate prompt hash for deduplication analysis
  prompt_hash_value := encode(digest(p_room_id::text || p_model, 'sha256'), 'hex');
  
  INSERT INTO llm_request_metrics (
    room_id,
    message_id,
    prompt_length,
    prompt_hash,
    response_length,
    duration_ms,
    token_usage,
    fallback_triggered,
    model,
    overall_score,
    relevance_score,
    novelty_score,
    coherence_score,
    actionability_score,
    engagement_score,
    retry_count,
    created_at
  ) VALUES (
    p_room_id,
    p_message_id,
    p_prompt_length,
    prompt_hash_value,
    p_response_length,
    p_duration_ms,
    p_token_usage,
    p_fallback_triggered,
    p_model,
    p_overall_score,
    p_relevance_score,
    p_novelty_score,
    p_coherence_score,
    p_actionability_score,
    p_engagement_score,
    p_retry_count,
    CURRENT_TIMESTAMP
  )
  RETURNING id INTO metric_id;
  
  RETURN metric_id;
END;
$$ LANGUAGE plpgsql;

-- Helper function to cleanup old metrics (>30 days)
CREATE OR REPLACE FUNCTION cleanup_old_llm_metrics(days INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM llm_request_metrics
  WHERE created_at < CURRENT_TIMESTAMP - (days || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
