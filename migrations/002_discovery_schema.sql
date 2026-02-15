-- ============================================
-- Phase 5: Discovery & Trending Schema Migration
-- Date: March 1, 2026
-- ============================================

-- 1. CREATE CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS category (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  icon_url VARCHAR(500),
  color VARCHAR(10),
  order_index INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_category_slug ON category(slug);

-- 2. UPDATE ROOM TABLE - Add discovery fields
ALTER TABLE room 
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES category(id),
  ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'archived')),
  ADD COLUMN IF NOT EXISTS thumbnail_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS description VARCHAR(500),
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- 3. CREATE ROOM_VIEWERS TABLE (Real-time metrics)
CREATE TABLE IF NOT EXISTS room_viewers (
  room_id UUID PRIMARY KEY REFERENCES room(id) ON DELETE CASCADE,
  viewer_count INT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT now()
);

-- 4. CREATE ROOM_ENGAGEMENT TABLE (Trending metrics)
CREATE TABLE IF NOT EXISTS room_engagement (
  room_id UUID PRIMARY KEY REFERENCES room(id) ON DELETE CASCADE,
  total_messages INT DEFAULT 0,
  total_likes INT DEFAULT 0,
  engagement_rate DECIMAL(5,2) DEFAULT 0.0,
  growth_rate DECIMAL(5,2) DEFAULT 0.0,
  trending_score DECIMAL(5,2) DEFAULT 0.0,
  updated_at TIMESTAMP DEFAULT now()
);

-- 5. CREATE INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_room_status ON room(status);
CREATE INDEX IF NOT EXISTS idx_room_category_id ON room(category_id);
CREATE INDEX IF NOT EXISTS idx_room_created_at ON room(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_room_started_at ON room(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_room_visibility ON room(visibility);
CREATE INDEX IF NOT EXISTS idx_room_search ON room USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_room_viewers_count ON room_viewers(viewer_count DESC);
CREATE INDEX IF NOT EXISTS idx_room_engagement_score ON room_engagement(trending_score DESC);

-- 6. CREATE FULL-TEXT SEARCH TRIGGER
CREATE OR REPLACE FUNCTION update_room_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.objective, '') || ' ' || COALESCE(NEW.description, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS room_search_vector_trigger ON room;
CREATE TRIGGER room_search_vector_trigger
BEFORE INSERT OR UPDATE ON room
FOR EACH ROW
EXECUTE FUNCTION update_room_search_vector();

-- 7. SEED INITIAL CATEGORIES
INSERT INTO category (name, slug, description, color, order_index)
VALUES
  ('Debate', 'debate', 'Structured debates and discussions', '#FF6B6B', 1),
  ('Coding', 'coding', 'Live coding and pair programming', '#4ECDC4', 2),
  ('Trading', 'trading', 'Financial markets and strategies', '#45B7D1', 3),
  ('Research', 'research', 'Research presentations and analysis', '#96CEB4', 4),
  ('Education', 'education', 'Educational content and tutorials', '#FFEAA7', 5),
  ('Entertainment', 'entertainment', 'Entertainment and casual chat', '#DDA15E', 6),
  ('Music', 'music', 'Music performances and DJ sessions', '#BC6C25', 7),
  ('Gaming', 'gaming', 'Gaming streams and esports', '#6C5B7B', 8),
  ('Science', 'science', 'Science talks and discussions', '#355C7D', 9),
  ('Sports', 'sports', 'Sports commentary and analysis', '#F67280', 10)
ON CONFLICT (name) DO NOTHING;

COMMIT;
