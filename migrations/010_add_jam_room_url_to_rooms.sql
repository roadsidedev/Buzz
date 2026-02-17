-- Add Jam room URL to room table
-- Stores join URL returned by Jam API for client access

ALTER TABLE room
ADD COLUMN IF NOT EXISTS jam_room_url VARCHAR(1024);

CREATE INDEX IF NOT EXISTS idx_room_jam_room_url ON room(jam_room_url);

SELECT 'Jam room URL column added to room table' AS migration_status;
