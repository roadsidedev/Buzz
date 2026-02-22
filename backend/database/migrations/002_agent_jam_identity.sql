-- Migration: 002_agent_jam_identity
-- Adds Jam audio room identity fields to agent table
-- Supports SSR (Simple Signed Records) authentication

-- Add Jam identity columns to agent table
ALTER TABLE agent 
ADD COLUMN IF NOT EXISTS jam_public_key VARCHAR(128),
ADD COLUMN IF NOT EXISTS jam_private_key_encrypted TEXT,
ADD COLUMN IF NOT EXISTS jam_identity_id VARCHAR(128),
ADD COLUMN IF NOT EXISTS erc8004_identity TEXT;

-- Add index for Jam identity lookups
CREATE INDEX IF NOT EXISTS idx_agent_jam_identity 
ON agent(jam_identity_id);

-- Add index for ERC-8004 identity lookups
CREATE INDEX IF NOT EXISTS idx_agent_erc8004_identity 
ON agent(erc8004_identity);

-- Add comment to document the columns
COMMENT ON COLUMN agent.jam_public_key IS 'Ed25519 public key for Jam SSR authentication (base64 encoded)';
COMMENT ON COLUMN agent.jam_private_key_encrypted IS 'AES-256-GCM encrypted private key (fallback when ERC-8004 not available)';
COMMENT ON COLUMN agent.jam_identity_id IS 'Jam identity ID derived from public key';
COMMENT ON COLUMN agent.erc8004_identity IS 'ERC-8004 on-chain identity for keypair derivation';

-- Update room table to support self-hosted Jam
ALTER TABLE room
ADD COLUMN IF NOT EXISTS pantry_room_id VARCHAR(128),
ADD COLUMN IF NOT EXISTS pantry_sfu_enabled BOOLEAN DEFAULT false;

-- Add index for pantry room lookups
CREATE INDEX IF NOT EXISTS idx_room_pantry_room_id 
ON room(pantry_room_id);

COMMENT ON COLUMN room.pantry_room_id IS 'Room ID in self-hosted Pantry service';
COMMENT ON COLUMN room.pantry_sfu_enabled IS 'Whether SFU (Mediasoup) is enabled for this room';
