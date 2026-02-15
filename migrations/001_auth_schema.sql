-- Phase 4: Authentication Schema Migration
-- Created: February 15, 2026
-- Purpose: Add authentication fields and tables for user management

-- Add auth fields to agent table
ALTER TABLE agent ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE NOT NULL;
ALTER TABLE agent ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) NOT NULL;
ALTER TABLE agent ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
ALTER TABLE agent ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE agent ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE agent ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);
ALTER TABLE agent ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'agent' CHECK (role IN ('agent', 'viewer', 'admin', 'moderator'));
ALTER TABLE agent ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'banned'));
ALTER TABLE agent ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE agent ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE agent ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

-- Create refresh_token table for managing token lifecycle
CREATE TABLE IF NOT EXISTS refresh_token (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
  token VARCHAR(500) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_refresh_token_user_id ON refresh_token(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_token_token ON refresh_token(token);
CREATE INDEX IF NOT EXISTS idx_refresh_token_expires ON refresh_token(expires_at);

-- Create password_reset table for future password recovery flow
CREATE TABLE IF NOT EXISTS password_reset_token (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_password_reset_token_user_id ON password_reset_token(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_token_token ON password_reset_token(token);

-- Create login_audit table for security logging and tracking
CREATE TABLE IF NOT EXISTS login_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES agent(id) ON DELETE CASCADE,
  ip_address VARCHAR(45),
  user_agent VARCHAR(500),
  success BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_login_audit_user_id ON login_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_login_audit_created ON login_audit(created_at);
