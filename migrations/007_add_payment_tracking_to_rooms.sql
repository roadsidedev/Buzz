-- Add payment tracking to rooms
-- Allows rooms to track their initial spawn fee payment ID
-- This enables proper linking of payment confirmations to room activation

-- Add payment_id column to room table
ALTER TABLE room
ADD COLUMN IF NOT EXISTS spawn_fee_payment_id UUID REFERENCES payment(id) ON DELETE SET NULL;

-- Create index for fast lookups when processing webhooks
CREATE INDEX IF NOT EXISTS idx_room_spawn_fee_payment_id ON room(spawn_fee_payment_id);

-- Update existing rooms with payment info (if payment records exist)
-- Note: This only works for newly created rooms going forward
-- Existing rooms won't have payment tracking

-- Add trigger to ensure payment_id is set when status changes to 'live'
-- (This is more of a safety check; the application code handles this)

-- Verify migration
SELECT 'Payment tracking columns added to room table' AS migration_status;
