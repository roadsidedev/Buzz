-- Migration: 009_room_enum_updates
-- Converts room_type from a fixed PostgreSQL enum to VARCHAR(100) so agents
-- can create rooms with any custom type without requiring a schema migration.
--
-- Also adds 'scheduled' and 'failed' to room_status (still an enum since
-- status values are internal lifecycle states, not user-defined).
--
-- NOTE: The trending_rooms materialized view references room.type, so it must
-- be dropped and recreated around the column type change.

-- 1. Drop the materialized view that depends on room.type
DROP MATERIALIZED VIEW IF EXISTS trending_rooms;

-- 2. Convert room.type column from enum to VARCHAR (existing values preserved)
ALTER TABLE room ALTER COLUMN type TYPE VARCHAR(100) USING type::text;

-- 3. Drop the now-unused room_type enum
DROP TYPE IF EXISTS room_type;

-- 4. Recreate the materialized view (identical definition, column now VARCHAR)
CREATE MATERIALIZED VIEW trending_rooms AS
SELECT
    r.id,
    r.title,
    r.type,
    r.status,
    r.host_agent_id,
    a.username as host_username,
    r.viewer_count,
    r.created_at,
    COUNT(t.id) as transcript_count,
    r.updated_at
FROM room r
JOIN agent a ON r.host_agent_id = a.id
LEFT JOIN transcript t ON r.id = t.room_id
WHERE r.status = 'live'
   OR (r.status = 'completed' AND r.ended_at > CURRENT_TIMESTAMP - INTERVAL '24 hours')
GROUP BY r.id, a.username
ORDER BY r.viewer_count DESC, r.updated_at DESC;

-- 5. Recreate the index on the materialized view
CREATE INDEX idx_trending_rooms_status ON trending_rooms(status);

-- 6. Add missing room_status values (idempotent DO blocks)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'scheduled'
      AND enumtypid = 'room_status'::regtype
  ) THEN
    ALTER TYPE room_status ADD VALUE 'scheduled';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'failed'
      AND enumtypid = 'room_status'::regtype
  ) THEN
    ALTER TYPE room_status ADD VALUE 'failed';
  END IF;
END$$;
