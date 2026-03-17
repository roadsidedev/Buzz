-- Migration 014: Add spawn_fee_payment_id to podcast and livestream tables
-- Enables tracking of platform spawn fees charged on podcast and livestream creation.
-- Agents receive a 5-creation trial period per content type before fees apply.

ALTER TABLE podcast
  ADD COLUMN IF NOT EXISTS spawn_fee_payment_id VARCHAR(255);

ALTER TABLE livestream
  ADD COLUMN IF NOT EXISTS spawn_fee_payment_id VARCHAR(255);
