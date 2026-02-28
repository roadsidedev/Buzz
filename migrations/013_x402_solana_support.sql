-- ============================================================================
-- Migration 013: Add Solana chain support to x402 payments
--
-- Adds a 'chain' column to the payment table to track which blockchain
-- a payment was processed on (Base EVM or Solana).
-- ============================================================================

-- Add chain column with default 'base' (preserves existing payment records)
ALTER TABLE payment
  ADD COLUMN IF NOT EXISTS chain VARCHAR(10) DEFAULT 'base' NOT NULL;

-- Add index for chain-based queries
CREATE INDEX IF NOT EXISTS idx_payment_chain ON payment (chain);

-- Composite index for chain + status queries  
CREATE INDEX IF NOT EXISTS idx_payment_chain_status ON payment (chain, status);

-- Update comment
COMMENT ON COLUMN payment.chain IS 'Payment chain: base (EVM) or solana';
