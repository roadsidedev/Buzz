-- Phase 5: Refresh Token Rotation Schema
-- Created: February 16, 2026
-- Purpose: Add columns for secure token rotation with family tracking and single-use enforcement

-- Add columns to refresh_token table for rotation support
ALTER TABLE refresh_token ADD COLUMN IF NOT EXISTS token_hash VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE refresh_token ADD COLUMN IF NOT EXISTS token_family UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE refresh_token ADD COLUMN IF NOT EXISTS generation INTEGER NOT NULL DEFAULT 0;
ALTER TABLE refresh_token ADD COLUMN IF NOT EXISTS parent_token_id UUID REFERENCES refresh_token(id) ON DELETE SET NULL;
ALTER TABLE refresh_token ADD COLUMN IF NOT EXISTS issued_at INTEGER NOT NULL DEFAULT EXTRACT(EPOCH FROM CURRENT_TIMESTAMP);

-- Backfill existing tokens with token_hash (hash of stored token column if present)
UPDATE refresh_token 
SET token_hash = 
  CASE WHEN token IS NOT NULL AND token != ''
    THEN encode(digest(token, 'sha256'), 'hex')
    ELSE ''
  END
WHERE token_hash = '';

-- Now make token_hash unique and remove the old token column
ALTER TABLE refresh_token DROP COLUMN IF EXISTS token CASCADE;
ALTER TABLE refresh_token ADD CONSTRAINT unique_token_hash UNIQUE (token_hash);

-- Add indexes for family tracking and rotation lookups
CREATE INDEX IF NOT EXISTS idx_refresh_token_family ON refresh_token(token_family);
CREATE INDEX IF NOT EXISTS idx_refresh_token_family_generation ON refresh_token(token_family, generation);
CREATE INDEX IF NOT EXISTS idx_refresh_token_parent ON refresh_token(parent_token_id);
CREATE INDEX IF NOT EXISTS idx_refresh_token_issued_at ON refresh_token(issued_at);
CREATE INDEX IF NOT EXISTS idx_refresh_token_hash_user ON refresh_token(token_hash, user_id);

-- Create audit table for token rotation history and security incidents
CREATE TABLE IF NOT EXISTS refresh_token_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
  token_family UUID NOT NULL,
  event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
    'token_issued',
    'token_rotated',
    'token_revoked',
    'family_revoked',
    'reuse_detected',
    'expired'
  )),
  generation INTEGER,
  parent_token_id UUID,
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_token_audit_user_id ON refresh_token_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_token_audit_family ON refresh_token_audit(token_family);
CREATE INDEX IF NOT EXISTS idx_token_audit_event_type ON refresh_token_audit(event_type);
CREATE INDEX IF NOT EXISTS idx_token_audit_created ON refresh_token_audit(created_at);

-- Create view for token family status (useful for monitoring and debugging)
CREATE OR REPLACE VIEW refresh_token_family_status AS
SELECT
  f.token_family,
  f.user_id,
  MAX(f.generation) as latest_generation,
  COUNT(*) as token_count,
  COUNT(CASE WHEN f.revoked_at IS NULL THEN 1 END) as active_tokens,
  COUNT(CASE WHEN f.revoked_at IS NOT NULL THEN 1 END) as revoked_tokens,
  f.created_at,
  MAX(CASE WHEN f.revoked_at IS NOT NULL THEN f.revoked_at END) as revoked_at
FROM refresh_token f
GROUP BY f.token_family, f.user_id, f.created_at;

-- Add helper function for token family revocation
CREATE OR REPLACE FUNCTION revoke_token_family(family_id UUID, reason_text TEXT DEFAULT NULL)
RETURNS void AS $$
BEGIN
  UPDATE refresh_token
  SET revoked_at = CURRENT_TIMESTAMP
  WHERE token_family = family_id AND revoked_at IS NULL;
  
  INSERT INTO refresh_token_audit (user_id, token_family, event_type, reason, created_at)
  SELECT DISTINCT user_id, family_id, 'family_revoked', reason_text, CURRENT_TIMESTAMP
  FROM refresh_token
  WHERE token_family = family_id
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Add helper function for cleanup
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM refresh_token
  WHERE expires_at < CURRENT_TIMESTAMP;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
