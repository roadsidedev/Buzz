-- Migration 014: Replace SAID Protocol with ERC-8004 Solana Registry
-- Date: 2026-03-05
-- Purpose: Migrate verification_badge rows from provider='said' to provider='erc8004_solana'.
--          The underlying Solana registry is now the ERC-8004 standard (8004-solana program)
--          rather than the SAID Protocol API. Existing SAID badges are converted to the new
--          provider and marked unverified so agents can re-link via POST /verify/erc8004-solana.

-- ============================================
-- Step 1: Rename 'said' provider to 'erc8004_solana'
-- ============================================

UPDATE verification_badge
SET
  provider     = 'erc8004_solana',
  verified     = FALSE,
  verified_at  = NULL,
  updated_at   = CURRENT_TIMESTAMP
WHERE provider = 'said';

-- ============================================
-- Step 2: Audit log entry
-- ============================================

INSERT INTO audit_log (
  event_type,
  action,
  changes,
  created_at
) VALUES (
  'REGISTRY_MIGRATION',
  'migrate_said_to_erc8004_solana',
  '{"reason": "Replace SAID Protocol with ERC-8004 Solana agent registry", "from": "said", "to": "erc8004_solana", "timestamp": "' || CURRENT_TIMESTAMP::TEXT || '"}'::JSONB,
  CURRENT_TIMESTAMP
);

-- ============================================
-- Summary
-- ============================================
--
-- VERIFICATION_BADGE TABLE (modified rows):
--   provider: 'said'  →  'erc8004_solana'
--   verified: reset to FALSE (agents must re-link with their asset_pubkey)
--
-- ROLLBACK:
--   UPDATE verification_badge
--     SET provider = 'said', verified = FALSE, updated_at = CURRENT_TIMESTAMP
--   WHERE provider = 'erc8004_solana';
--
-- NOTE: provider_wallet column retains the old Solana wallet address as a reference.
--       Agents must re-link using their ERC-8004 Metaplex Core asset pubkey via
--       POST /api/v1/agents/me/verify/erc8004-solana  { "asset_pubkey": "..." }
