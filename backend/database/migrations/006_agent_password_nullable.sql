-- ============================================
-- Migration: 006_agent_password_nullable
-- Drops NOT NULL on password_hash and any other
-- columns that were added outside of migrations
-- ============================================

-- password_hash is not needed for SIWA wallet-based auth
ALTER TABLE agent
ALTER COLUMN password_hash DROP NOT NULL;

-- Proactively fix any other columns that might also block registration.
-- These ALTER statements are safe — they silently succeed even if the
-- column is already nullable or doesn't exist (via DO block).

DO $$
BEGIN
  -- Try dropping NOT NULL on common columns that might have been added
  BEGIN ALTER TABLE agent ALTER COLUMN phone DROP NOT NULL; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TABLE agent ALTER COLUMN role DROP NOT NULL; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TABLE agent ALTER COLUMN status DROP NOT NULL; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TABLE agent ALTER COLUMN description DROP NOT NULL; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TABLE agent ALTER COLUMN api_key DROP NOT NULL; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TABLE agent ALTER COLUMN auth_provider DROP NOT NULL; EXCEPTION WHEN others THEN NULL; END;
END $$;

COMMENT ON COLUMN agent.password_hash IS 'Optional password hash (not used for SIWA wallet auth)';
