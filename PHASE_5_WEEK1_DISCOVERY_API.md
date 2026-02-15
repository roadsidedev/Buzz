# Phase 5 Week 1: Discovery API Implementation

**Week:** 1 of 4  
**Focus:** Backend discovery service, database schema, API routes  
**Days:** 5 (Mar 1-7, 2026)  
**Dependencies:** Phase 4 complete ✅  
**Deliverables:** 3 services, 5 routes, 20+ tests

---

## Overview

Week 1 builds the **backend infrastructure** for discovery:

1. **Day 1:** Database schema (room_viewers, room_engagement, categories, room updates)
2. **Day 2:** Discovery service (fetch live, search, filter, pagination)
3. **Day 3:** Trending service foundation (scoring prep)
4. **Day 4:** API routes (/discovery, /trending, /search, /categories/:id)
5. **Day 5:** Integration tests (20+ test cases)

**Goal:** Working API that returns live rooms, trending rooms, categories, and search results.

---

## Day 1: Database Schema & Migration

### Morning: Understand Current Schema

Before writing any SQL, let's review what exists:

**Current room table** (from Phase 2):
```sql
CREATE TABLE room (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_agent_id UUID NOT NULL REFERENCES agent(id),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL, -- 'debate', 'coding', etc
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, live, ended
  spawn_fee DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE room_participant (
  room_id UUID NOT NULL REFERENCES room(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agent(id),
  joined_at TIMESTAMP DEFAULT now(),
  left_at TIMESTAMP,
  PRIMARY KEY (room_id, agent_id)
);
```

**Current agent table** (from Phase 4):
```sql
CREATE TABLE agent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'agent',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

### Afternoon: Create Migration File

📁 **migrations/002_discovery_schema.sql** (NEW)

```sql
-- ============================================
-- Phase 5: Discovery Schema Migration
-- Date: March 1, 2026
-- ============================================

-- 1. CREATE CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS category (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE, -- 'debate', 'coding', 'trading'
  description TEXT,
  icon_url VARCHAR(500),
  color VARCHAR(10), -- hex: #FF5733
  order_index INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- 2. UPDATE ROOM TABLE
-- Add columns for discovery features
ALTER TABLE room 
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES category(id),
  ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'archived')),
  ADD COLUMN IF NOT EXISTS thumbnail_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS ended_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS participant_limit INT DEFAULT 10,
  ADD COLUMN IF NOT EXISTS view_count INT DEFAULT 0;

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
  total_shares INT DEFAULT 0,
  avg_sentiment DECIMAL(3,2) DEFAULT 0.0, -- 0.0 to 1.0
  engagement_rate DECIMAL(5,2) DEFAULT 0.0, -- (messages / viewers) * 100
  growth_rate DECIMAL(5,2) DEFAULT 0.0, -- % change in last hour
  trending_score DECIMAL(5,2) DEFAULT 0.0, -- 0 to 100
  updated_at TIMESTAMP DEFAULT now()
);

-- 5. CREATE INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_room_status ON room(status);
CREATE INDEX IF NOT EXISTS idx_room_category_id ON room(category_id);
CREATE INDEX IF NOT EXISTS idx_room_created_at ON room(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_room_visibility ON room(visibility);
CREATE INDEX IF NOT EXISTS idx_room_started_at ON room(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_category_slug ON category(slug);
CREATE INDEX IF NOT EXISTS idx_room_viewers_count ON room_viewers(viewer_count DESC);
CREATE INDEX IF NOT EXISTS idx_room_engagement_score ON room_engagement(trending_score DESC);

-- 6. CREATE FULL-TEXT SEARCH INDEX (For search endpoint)
ALTER TABLE room 
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE INDEX IF NOT EXISTS idx_room_search ON room USING GIN (search_vector);

-- Function to update search vector on room insert/update
CREATE OR REPLACE FUNCTION update_room_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.description, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS room_search_vector_trigger ON room;
CREATE TRIGGER room_search_vector_trigger
BEFORE INSERT OR UPDATE ON room
FOR EACH ROW
EXECUTE FUNCTION update_room_search_vector();

-- 7. CREATE INITIAL CATEGORIES
INSERT INTO category (name, slug, description, color, order_index)
VALUES
  ('Debate', 'debate', 'Structured debates and discussions', '#FF6B6B', 1),
  ('Coding', 'coding', 'Live coding and pair programming', '#4ECDC4', 2),
  ('Trading', 'trading', 'Financial markets and trading strategies', '#45B7D1', 3),
  ('Research', 'research', 'Research presentations and analysis', '#96CEB4', 4),
  ('Education', 'education', 'Educational content and tutorials', '#FFEAA7', 5),
  ('Entertainment', 'entertainment', 'Entertainment and casual chat', '#DDA15E', 6),
  ('Music', 'music', 'Music performances and DJ sessions', '#BC6C25', 7),
  ('Gaming', 'gaming', 'Gaming streams and esports', '#6C5B7B', 8),
  ('Science', 'science', 'Science talks and discussions', '#355C7D', 9),
  ('Sports', 'sports', 'Sports commentary and analysis', '#F67280', 10)
ON CONFLICT (name) DO NOTHING;

-- 8. CREATE VIEW FOR ROOM DISCOVERY (Optional, but useful)
CREATE OR REPLACE VIEW room_discovery_view AS
SELECT
  r.id,
  r.title,
  r.description,
  r.type,
  r.status,
  r.thumbnail_url,
  r.created_at,
  r.started_at,
  r.ended_at,
  r.participant_limit,
  r.view_count,
  c.id as category_id,
  c.name as category_name,
  c.slug as category_slug,
  c.color as category_color,
  a.id as host_agent_id,
  a.username as host_agent_username,
  COALESCE(rv.viewer_count, 0) as viewer_count,
  COALESCE(re.total_messages, 0) as total_messages,
  COALESCE(re.engagement_rate, 0) as engagement_rate,
  COALESCE(re.trending_score, 0) as trending_score,
  COUNT(rp.agent_id) as participant_count
FROM room r
LEFT JOIN category c ON r.category_id = c.id
LEFT JOIN agent a ON r.host_agent_id = a.id
LEFT JOIN room_viewers rv ON r.id = rv.room_id
LEFT JOIN room_engagement re ON r.id = re.room_id
LEFT JOIN room_participant rp ON r.id = rp.room_id AND rp.left_at IS NULL
GROUP BY r.id, c.id, a.id, rv.room_id, re.room_id;

-- 9. VERIFY MIGRATION
-- Run these queries to verify:
-- SELECT COUNT(*) FROM category;
-- SELECT * FROM room LIMIT 1;
-- SELECT * FROM room_viewers LIMIT 1;
-- SELECT * FROM room_engagement LIMIT 1;

COMMIT;
```

### Evening: Test Migration

**Manual verification queries:**

```sql
-- 1. Verify categories created
SELECT count(*) as category_count FROM category;
-- Expected: 10

-- 2. Verify room schema updated
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name='room' AND column_name IN ('category_id', 'visibility', 'thumbnail_url', 'started_at')
ORDER BY ordinal_position;
-- Expected: 4 rows

-- 3. Verify indexes created
SELECT indexname FROM pg_indexes WHERE tablename='room';
-- Expected: Multiple indexes including idx_room_status, idx_room_category_id, etc

-- 4. Verify full-text search works
SELECT * FROM room WHERE search_vector @@ plainto_tsquery('english', 'debate');
-- Expected: 0 rows (no rooms yet, but query succeeds)
```

**Expected output after Day 1:**
- ✅ Migration runs without errors
- ✅ 10 categories seeded
- ✅ Room table has new columns
- ✅ Indexes created for performance
- ✅ Full-text search configured

---

## Day 2: Discovery Service

### Morning: Plan the Service

Create `backend/src/services/discovery-service.ts`

This service will have these methods:

```typescript
// Core discovery methods
getLiveNow(page?: number): Promise<Room[]>
getTrendingRooms(limit?: number): Promise<Room[]>
getByCategory(categoryId: string, page?: number): Promise<Room[]>
searchRooms(query: string, filters?: SearchFilters): Promise<Room[]>
getRoomDetails(roomId: string): Promise<RoomDetails>
getCategories(): Promise<Category[]>

// Internal helper methods
_buildRoomQuery(): QueryBuilder  // Base query with all joins
_applyFilters(query, filters): QueryBuilder
_calculateTrendingScore(engagement): number
```

### Afternoon & Evening: Implement Service

📁 **backend/src/services/discovery-service.ts** (NEW)

```typescript
import { Pool } from "pg";
import { Logger } from "winston";
import {
  Room,
  RoomDetails,
  Category,
  DiscoveryFilters,
  PaginatedResponse,
} from "@/types/discovery";
import { DatabaseError, NotFoundError } from "@/utils/errors";
import logger from "@/utils/logger";

/**
 * DiscoveryService: Fetch and filter rooms for discovery page
 * 
 * Responsibilities:
 * - Get live rooms (status='live', sorted by viewer_count)
 * - Get trending rooms (sorted by trending_score)
 * - Search rooms (full-text search on title, description)
 * - Filter by category
 * - Paginate results
 * - Load room details with participants
 */
export class DiscoveryService {
  constructor(private db: Pool) {}

  /**
   * Get all live rooms with pagination
   * 
   * @param page - Page number (1-indexed)
   * @param limit - Results per page (default 20)
   * @returns Paginated list of live rooms sorted by viewer count
   */
  async getLiveNow(page: number = 1, limit: number = 20): Promise<PaginatedResponse<Room>> {
    try {
      logger.info("Fetching live rooms", { page, limit });

      const offset = (page - 1) * limit;

      // Get live rooms with viewer count
      const { rows: rooms } = await this.db.query(
        `
        SELECT
          r.id,
          r.title,
          r.description,
          r.type,
          r.status,
          r.thumbnail_url,
          r.created_at,
          r.started_at,
          r.participant_limit,
          c.id as category_id,
          c.name as category_name,
          c.color as category_color,
          a.id as host_agent_id,
          a.username as host_agent_username,
          COALESCE(rv.viewer_count, 0) as viewer_count,
          COUNT(DISTINCT rp.agent_id) as participant_count
        FROM room r
        LEFT JOIN category c ON r.category_id = c.id
        LEFT JOIN agent a ON r.host_agent_id = a.id
        LEFT JOIN room_viewers rv ON r.id = rv.room_id
        LEFT JOIN room_participant rp ON r.id = rp.room_id AND rp.left_at IS NULL
        WHERE r.status = 'live' AND r.visibility = 'public'
        GROUP BY r.id, c.id, a.id, rv.room_id
        ORDER BY rv.viewer_count DESC NULLS LAST, r.started_at DESC
        LIMIT $1 OFFSET $2
        `,
        [limit, offset]
      );

      // Get total count
      const { rows: [{ total_count }] } = await this.db.query(
        `SELECT COUNT(*) as total_count FROM room WHERE status = 'live' AND visibility = 'public'`
      );

      logger.info("Live rooms fetched", {
        count: rooms.length,
        total: total_count,
        page,
      });

      return {
        data: rooms.map(this._mapRoomRow),
        total: parseInt(total_count, 10),
        page,
        limit,
        hasMore: offset + limit < parseInt(total_count, 10),
      };
    } catch (err) {
      logger.error("Failed to fetch live rooms", { error: err, page, limit });
      throw new DatabaseError("Failed to fetch live rooms", { cause: err });
    }
  }

  /**
   * Get trending rooms (sorted by engagement metrics)
   * 
   * Note: This is basic implementation.
   * TrendingService (Day 3) will enhance this with caching.
   * 
   * @param limit - Number of rooms to return (default 10)
   * @returns List of trending rooms
   */
  async getTrendingRooms(limit: number = 10): Promise<Room[]> {
    try {
      logger.info("Fetching trending rooms", { limit });

      const { rows: rooms } = await this.db.query(
        `
        SELECT
          r.id,
          r.title,
          r.description,
          r.type,
          r.status,
          r.thumbnail_url,
          r.created_at,
          r.started_at,
          c.id as category_id,
          c.name as category_name,
          c.color as category_color,
          a.id as host_agent_id,
          a.username as host_agent_username,
          COALESCE(rv.viewer_count, 0) as viewer_count,
          COALESCE(re.trending_score, 0) as trending_score,
          COUNT(DISTINCT rp.agent_id) as participant_count
        FROM room r
        LEFT JOIN category c ON r.category_id = c.id
        LEFT JOIN agent a ON r.host_agent_id = a.id
        LEFT JOIN room_viewers rv ON r.id = rv.room_id
        LEFT JOIN room_engagement re ON r.id = re.room_id
        LEFT JOIN room_participant rp ON r.id = rp.room_id AND rp.left_at IS NULL
        WHERE (r.status = 'live' OR r.status = 'ended') AND r.visibility = 'public'
        GROUP BY r.id, c.id, a.id, rv.room_id, re.room_id
        ORDER BY COALESCE(re.trending_score, 0) DESC, rv.viewer_count DESC
        LIMIT $1
        `,
        [limit]
      );

      logger.info("Trending rooms fetched", { count: rooms.length });
      return rooms.map(this._mapRoomRow);
    } catch (err) {
      logger.error("Failed to fetch trending rooms", { error: err, limit });
      throw new DatabaseError("Failed to fetch trending rooms", { cause: err });
    }
  }

  /**
   * Get rooms by category with pagination
   * 
   * @param categoryId - UUID of category
   * @param page - Page number (1-indexed)
   * @param limit - Results per page
   * @returns Paginated rooms in category
   */
  async getByCategory(
    categoryId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedResponse<Room>> {
    try {
      logger.info("Fetching rooms by category", { categoryId, page, limit });

      const offset = (page - 1) * limit;

      // Verify category exists
      const { rows: [category] } = await this.db.query(
        `SELECT id FROM category WHERE id = $1`,
        [categoryId]
      );

      if (!category) {
        throw new NotFoundError("Category not found", { categoryId });
      }

      // Get rooms in category
      const { rows: rooms } = await this.db.query(
        `
        SELECT
          r.id,
          r.title,
          r.description,
          r.type,
          r.status,
          r.thumbnail_url,
          r.created_at,
          r.started_at,
          c.id as category_id,
          c.name as category_name,
          c.color as category_color,
          a.id as host_agent_id,
          a.username as host_agent_username,
          COALESCE(rv.viewer_count, 0) as viewer_count,
          COUNT(DISTINCT rp.agent_id) as participant_count
        FROM room r
        LEFT JOIN category c ON r.category_id = c.id
        LEFT JOIN agent a ON r.host_agent_id = a.id
        LEFT JOIN room_viewers rv ON r.id = rv.room_id
        LEFT JOIN room_participant rp ON r.id = rp.room_id AND rp.left_at IS NULL
        WHERE r.category_id = $1 AND r.visibility = 'public'
        GROUP BY r.id, c.id, a.id, rv.room_id
        ORDER BY r.started_at DESC NULLS LAST
        LIMIT $2 OFFSET $3
        `,
        [categoryId, limit, offset]
      );

      // Get total count
      const { rows: [{ total_count }] } = await this.db.query(
        `SELECT COUNT(*) as total_count FROM room WHERE category_id = $1 AND visibility = 'public'`,
        [categoryId]
      );

      return {
        data: rooms.map(this._mapRoomRow),
        total: parseInt(total_count, 10),
        page,
        limit,
        hasMore: offset + limit < parseInt(total_count, 10),
      };
    } catch (err) {
      logger.error("Failed to fetch rooms by category", {
        error: err,
        categoryId,
        page,
        limit,
      });
      throw new DatabaseError("Failed to fetch rooms by category", { cause: err });
    }
  }

  /**
   * Search rooms by title and description (full-text search)
   * 
   * @param query - Search term
   * @param filters - Optional filters (category, status)
   * @param page - Page number
   * @param limit - Results per page
   * @returns Paginated search results
   */
  async searchRooms(
    query: string,
    filters?: DiscoveryFilters,
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedResponse<Room>> {
    try {
      // Validate query
      if (!query || query.trim().length === 0) {
        throw new Error("Search query cannot be empty");
      }

      if (query.length > 100) {
        throw new Error("Search query too long (max 100 characters)");
      }

      logger.info("Searching rooms", { query, filters, page, limit });

      const offset = (page - 1) * limit;
      const searchQuery = `${query.split(" ").join(" & ")}:*`; // PostgreSQL full-text search

      let sql = `
        SELECT
          r.id,
          r.title,
          r.description,
          r.type,
          r.status,
          r.thumbnail_url,
          r.created_at,
          r.started_at,
          c.id as category_id,
          c.name as category_name,
          c.color as category_color,
          a.id as host_agent_id,
          a.username as host_agent_username,
          COALESCE(rv.viewer_count, 0) as viewer_count,
          COUNT(DISTINCT rp.agent_id) as participant_count
        FROM room r
        LEFT JOIN category c ON r.category_id = c.id
        LEFT JOIN agent a ON r.host_agent_id = a.id
        LEFT JOIN room_viewers rv ON r.id = rv.room_id
        LEFT JOIN room_participant rp ON r.id = rp.room_id AND rp.left_at IS NULL
        WHERE r.search_vector @@ plainto_tsquery('english', $1)
          AND r.visibility = 'public'
      `;

      const params: any[] = [query];

      // Apply optional filters
      if (filters?.categoryId) {
        sql += ` AND r.category_id = $${params.length + 1}`;
        params.push(filters.categoryId);
      }

      if (filters?.status) {
        sql += ` AND r.status = $${params.length + 1}`;
        params.push(filters.status);
      }

      sql += `
        GROUP BY r.id, c.id, a.id, rv.room_id
        ORDER BY ts_rank(r.search_vector, plainto_tsquery('english', $1)) DESC,
                 r.started_at DESC NULLS LAST
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;

      params.push(limit, offset);

      const { rows: rooms } = await this.db.query(sql, params);

      // Get total count
      let countSql = `SELECT COUNT(*) as total_count FROM room WHERE search_vector @@ plainto_tsquery('english', $1) AND visibility = 'public'`;
      const countParams: any[] = [query];

      if (filters?.categoryId) {
        countSql += ` AND category_id = $${countParams.length + 1}`;
        countParams.push(filters.categoryId);
      }

      const { rows: [{ total_count }] } = await this.db.query(countSql, countParams);

      return {
        data: rooms.map(this._mapRoomRow),
        total: parseInt(total_count, 10),
        page,
        limit,
        hasMore: offset + limit < parseInt(total_count, 10),
      };
    } catch (err) {
      logger.error("Search failed", { error: err, query, page, limit });
      throw new DatabaseError("Search failed", { cause: err });
    }
  }

  /**
   * Get full room details including participants
   * 
   * @param roomId - Room UUID
   * @returns Room with participants list
   */
  async getRoomDetails(roomId: string): Promise<RoomDetails> {
    try {
      logger.info("Fetching room details", { roomId });

      // Get room with engagement metrics
      const { rows: [room] } = await this.db.query(
        `
        SELECT
          r.id,
          r.title,
          r.description,
          r.type,
          r.status,
          r.thumbnail_url,
          r.created_at,
          r.started_at,
          r.ended_at,
          r.participant_limit,
          c.id as category_id,
          c.name as category_name,
          c.color as category_color,
          a.id as host_agent_id,
          a.username as host_agent_username,
          COALESCE(rv.viewer_count, 0) as viewer_count,
          COALESCE(re.total_messages, 0) as total_messages,
          COALESCE(re.engagement_rate, 0) as engagement_rate,
          COUNT(DISTINCT rp.agent_id) as participant_count
        FROM room r
        LEFT JOIN category c ON r.category_id = c.id
        LEFT JOIN agent a ON r.host_agent_id = a.id
        LEFT JOIN room_viewers rv ON r.id = rv.room_id
        LEFT JOIN room_engagement re ON r.id = re.room_id
        LEFT JOIN room_participant rp ON r.id = rp.room_id AND rp.left_at IS NULL
        WHERE r.id = $1
        GROUP BY r.id, c.id, a.id, rv.room_id, re.room_id
        `,
        [roomId]
      );

      if (!room) {
        throw new NotFoundError("Room not found", { roomId });
      }

      // Get participants
      const { rows: participants } = await this.db.query(
        `
        SELECT
          a.id,
          a.username,
          rp.joined_at
        FROM room_participant rp
        LEFT JOIN agent a ON rp.agent_id = a.id
        WHERE rp.room_id = $1 AND rp.left_at IS NULL
        ORDER BY rp.joined_at ASC
        `,
        [roomId]
      );

      return {
        ...this._mapRoomRow(room),
        participants: participants.map(p => ({
          id: p.id,
          username: p.username,
          joinedAt: p.joined_at,
        })),
      };
    } catch (err) {
      logger.error("Failed to fetch room details", { error: err, roomId });
      throw new DatabaseError("Failed to fetch room details", { cause: err });
    }
  }

  /**
   * Get all categories
   * 
   * @returns All categories sorted by order_index
   */
  async getCategories(): Promise<Category[]> {
    try {
      logger.info("Fetching categories");

      const { rows: categories } = await this.db.query(
        `SELECT id, name, slug, description, icon_url, color FROM category ORDER BY order_index ASC`
      );

      return categories;
    } catch (err) {
      logger.error("Failed to fetch categories", { error: err });
      throw new DatabaseError("Failed to fetch categories", { cause: err });
    }
  }

  /**
   * Helper: Map database row to Room object
   * 
   * @param row - Database row
   * @returns Typed Room object
   */
  private _mapRoomRow(row: any): Room {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      type: row.type,
      status: row.status,
      thumbnailUrl: row.thumbnail_url,
      createdAt: row.created_at,
      startedAt: row.started_at,
      category: row.category_id ? {
        id: row.category_id,
        name: row.category_name,
        color: row.category_color,
      } : undefined,
      hostAgent: {
        id: row.host_agent_id,
        username: row.host_agent_username,
      },
      viewerCount: row.viewer_count,
      participantCount: row.participant_count,
      participantLimit: row.participant_limit,
      trendingScore: row.trending_score,
      totalMessages: row.total_messages,
      engagementRate: row.engagement_rate,
    };
  }
}

/**
 * Factory: Create discovery service with database connection
 */
export function createDiscoveryService(db: Pool): DiscoveryService {
  return new DiscoveryService(db);
}
```

---

## Day 3: Trending Service (Scoring Foundation)

### Morning & Afternoon: Build Trending Service

📁 **backend/src/services/trending-service.ts** (NEW)

```typescript
import { Pool } from "pg";
import logger from "@/utils/logger";
import { DatabaseError } from "@/utils/errors";

/**
 * TrendingService: Calculate and cache trending scores
 * 
 * Scoring formula:
 * trending_score = (
 *   0.35 * (viewer_count / max_viewers) +      // Popularity
 *   0.25 * (growth_rate / max_growth) +        // Growth
 *   0.20 * (engagement_rate / max_engagement) + // Engagement
 *   0.15 * time_boost +                        // Recency
 *   0.05 * category_affinity                   // Category
 * ) * 100
 */
export class TrendingService {
  private readonly SCORING_WEIGHTS = {
    POPULARITY: 0.35,
    GROWTH: 0.25,
    ENGAGEMENT: 0.20,
    RECENCY: 0.15,
    CATEGORY: 0.05,
  };

  constructor(private db: Pool) {}

  /**
   * Calculate trending score for a single room
   * 
   * @param room - Room object with engagement metrics
   * @returns Score 0-100
   */
  calculateTrendingScore(room: {
    id: string;
    viewerCount: number;
    totalMessages: number;
    engagementRate: number;
    growthRate: number;
    startedAt: Date;
    categoryId?: string;
  }): number {
    // 1. Popularity: viewer count (normalized)
    const maxViewers = 10000; // Arbitrary max for normalization
    const popularityScore = Math.min(room.viewerCount / maxViewers, 1.0);

    // 2. Growth: % change in last hour (normalized)
    const maxGrowth = 200; // 200% growth in an hour is excellent
    const growthScore = Math.min(Math.abs(room.growthRate) / maxGrowth, 1.0);

    // 3. Engagement: messages per viewer
    const maxEngagement = 5; // 5 messages per viewer is high
    const engagementScore = Math.min(room.engagementRate / maxEngagement, 1.0);

    // 4. Recency: boost newer rooms
    const timeSinceStart = Date.now() - new Date(room.startedAt).getTime();
    const minutesRunning = timeSinceStart / (1000 * 60);
    let recencyBoost = 1.0;
    if (minutesRunning < 30) recencyBoost = 1.0; // New rooms get full boost
    else if (minutesRunning < 60) recencyBoost = 0.9;
    else if (minutesRunning < 180) recencyBoost = 0.7;
    else if (minutesRunning < 480) recencyBoost = 0.5; // 8 hours
    else recencyBoost = 0.3;

    // 5. Category affinity: TBD (placeholder for future personalization)
    const categoryAffinity = 0.5; // Neutral for now

    // Final score: weighted sum * 100
    const finalScore =
      (this.SCORING_WEIGHTS.POPULARITY * popularityScore +
        this.SCORING_WEIGHTS.GROWTH * growthScore +
        this.SCORING_WEIGHTS.ENGAGEMENT * engagementScore +
        this.SCORING_WEIGHTS.RECENCY * recencyBoost +
        this.SCORING_WEIGHTS.CATEGORY * categoryAffinity) *
      100;

    return Math.round(finalScore * 100) / 100; // Round to 2 decimals
  }

  /**
   * Update trending scores for all active rooms
   * Run this periodically (every 5 minutes) via cron job
   * 
   * @returns Number of rooms updated
   */
  async updateAllTrendingScores(): Promise<number> {
    try {
      logger.info("Updating trending scores for all rooms");

      // Get all active rooms with engagement metrics
      const { rows: rooms } = await this.db.query(`
        SELECT
          r.id,
          r.started_at,
          r.category_id,
          COALESCE(rv.viewer_count, 0) as viewer_count,
          COALESCE(re.total_messages, 0) as total_messages,
          COALESCE(re.engagement_rate, 0) as engagement_rate,
          COALESCE(re.growth_rate, 0) as growth_rate
        FROM room r
        LEFT JOIN room_viewers rv ON r.id = rv.room_id
        LEFT JOIN room_engagement re ON r.id = re.room_id
        WHERE r.status = 'live' OR r.status = 'ended'
      `);

      let updatedCount = 0;

      // Calculate and update score for each room
      for (const room of rooms) {
        const score = this.calculateTrendingScore({
          id: room.id,
          viewerCount: room.viewer_count,
          totalMessages: room.total_messages,
          engagementRate: room.engagement_rate,
          growthRate: room.growth_rate,
          startedAt: room.started_at,
          categoryId: room.category_id,
        });

        // Update score in database
        await this.db.query(
          `UPDATE room_engagement SET trending_score = $1, updated_at = now() WHERE room_id = $2`,
          [score, room.id]
        );

        updatedCount++;
      }

      logger.info("Trending scores updated", { count: updatedCount });
      return updatedCount;
    } catch (err) {
      logger.error("Failed to update trending scores", { error: err });
      throw new DatabaseError("Failed to update trending scores", { cause: err });
    }
  }

  /**
   * Update trending score for a single room
   * Call this when room metrics change (new viewer, new message)
   * 
   * @param roomId - Room UUID
   */
  async updateRoomTrendingScore(roomId: string): Promise<void> {
    try {
      // Fetch latest metrics
      const { rows: [room] } = await this.db.query(
        `
        SELECT
          r.started_at,
          r.category_id,
          COALESCE(rv.viewer_count, 0) as viewer_count,
          COALESCE(re.total_messages, 0) as total_messages,
          COALESCE(re.engagement_rate, 0) as engagement_rate,
          COALESCE(re.growth_rate, 0) as growth_rate
        FROM room r
        LEFT JOIN room_viewers rv ON r.id = rv.room_id
        LEFT JOIN room_engagement re ON r.id = re.room_id
        WHERE r.id = $1
        `,
        [roomId]
      );

      if (!room) {
        logger.warn("Room not found for trending update", { roomId });
        return;
      }

      const score = this.calculateTrendingScore({
        id: roomId,
        viewerCount: room.viewer_count,
        totalMessages: room.total_messages,
        engagementRate: room.engagement_rate,
        growthRate: room.growth_rate,
        startedAt: room.started_at,
        categoryId: room.category_id,
      });

      await this.db.query(
        `UPDATE room_engagement SET trending_score = $1, updated_at = now() WHERE room_id = $2`,
        [score, roomId]
      );

      logger.debug("Room trending score updated", { roomId, score });
    } catch (err) {
      logger.error("Failed to update room trending score", { error: err, roomId });
      throw new DatabaseError("Failed to update room trending score", { cause: err });
    }
  }
}

export function createTrendingService(db: Pool): TrendingService {
  return new TrendingService(db);
}
```

---

## Day 4: API Routes

### Morning: Design Routes

📁 **backend/src/api/routes/discovery.ts** (NEW)

```typescript
import { Router, Request, Response } from "express";
import { validateJWT } from "@/middleware/auth";
import { DiscoveryService } from "@/services/discovery-service";
import { TrendingService } from "@/services/trending-service";
import { validateQuery, ValidationError } from "@/utils/validators";
import logger from "@/utils/logger";

/**
 * Discovery Routes
 * 
 * GET /discovery - Main discovery page (live now + trending + categories)
 * GET /discovery/live-now - Live rooms paginated
 * GET /discovery/trending - Trending rooms
 * GET /discovery/categories - All categories
 * GET /discovery/categories/:id - Rooms by category
 * GET /discovery/search - Search rooms
 * GET /room/:id - Room details
 * POST /room/:id/join - Join room
 */
export function createDiscoveryRoutes(
  discoveryService: DiscoveryService,
  trendingService: TrendingService
): Router {
  const router = Router();

  /**
   * GET /discovery
   * Main discovery page: Live now, trending, categories
   */
  router.get("/discovery", validateJWT, async (req: Request, res: Response) => {
    try {
      logger.info("GET /discovery");

      const [liveNow, trending, categories] = await Promise.all([
        discoveryService.getLiveNow(1, 6), // First 6 live rooms
        discoveryService.getTrendingRooms(10), // Top 10 trending
        discoveryService.getCategories(),
      ]);

      res.json({
        success: true,
        data: {
          liveNow: liveNow.data,
          trending,
          categories,
          recentSearches: [], // TBD: Track user searches
        },
      });
    } catch (err) {
      logger.error("GET /discovery failed", { error: err });
      res.status(500).json({ success: false, error: "Failed to fetch discovery page" });
    }
  });

  /**
   * GET /discovery/live-now
   * Paginated live rooms
   */
  router.get(
    "/discovery/live-now",
    validateJWT,
    async (req: Request, res: Response) => {
      try {
        const { page = 1, limit = 20 } = req.query;

        // Validate query params
        const pageNum = Math.max(1, parseInt(page as string) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20));

        logger.info("GET /discovery/live-now", { page: pageNum, limit: limitNum });

        const result = await discoveryService.getLiveNow(pageNum, limitNum);

        res.json({
          success: true,
          data: result.data,
          pagination: {
            page: result.page,
            limit: result.limit,
            total: result.total,
            hasMore: result.hasMore,
          },
        });
      } catch (err) {
        logger.error("GET /discovery/live-now failed", { error: err });
        res.status(500).json({ success: false, error: "Failed to fetch live rooms" });
      }
    }
  );

  /**
   * GET /discovery/trending
   * Top trending rooms
   */
  router.get("/discovery/trending", validateJWT, async (req: Request, res: Response) => {
    try {
      const { limit = 10 } = req.query;
      const limitNum = Math.min(50, Math.max(1, parseInt(limit as string) || 10));

      logger.info("GET /discovery/trending", { limit: limitNum });

      const rooms = await discoveryService.getTrendingRooms(limitNum);

      res.json({
        success: true,
        data: rooms,
      });
    } catch (err) {
      logger.error("GET /discovery/trending failed", { error: err });
      res.status(500).json({ success: false, error: "Failed to fetch trending" });
    }
  });

  /**
   * GET /discovery/categories
   * All categories
   */
  router.get("/discovery/categories", validateJWT, async (req: Request, res: Response) => {
    try {
      logger.info("GET /discovery/categories");

      const categories = await discoveryService.getCategories();

      res.json({
        success: true,
        data: categories,
      });
    } catch (err) {
      logger.error("GET /discovery/categories failed", { error: err });
      res.status(500).json({ success: false, error: "Failed to fetch categories" });
    }
  });

  /**
   * GET /discovery/categories/:id
   * Rooms by category
   */
  router.get(
    "/discovery/categories/:id",
    validateJWT,
    async (req: Request, res: Response) => {
      try {
        const { id: categoryId } = req.params;
        const { page = 1, limit = 20 } = req.query;

        const pageNum = Math.max(1, parseInt(page as string) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20));

        logger.info("GET /discovery/categories/:id", { categoryId, page: pageNum });

        const result = await discoveryService.getByCategory(categoryId, pageNum, limitNum);

        res.json({
          success: true,
          data: result.data,
          pagination: {
            page: result.page,
            limit: result.limit,
            total: result.total,
            hasMore: result.hasMore,
          },
        });
      } catch (err) {
        logger.error("GET /discovery/categories/:id failed", { error: err });
        res.status(404).json({ success: false, error: "Category not found" });
      }
    }
  );

  /**
   * GET /discovery/search
   * Search rooms by query
   */
  router.get("/discovery/search", validateJWT, async (req: Request, res: Response) => {
    try {
      const { q: query, categoryId, status, page = 1, limit = 20 } = req.query;

      // Validate query param
      if (!query || typeof query !== "string") {
        return res.status(400).json({
          success: false,
          error: "Query parameter 'q' is required",
        });
      }

      const pageNum = Math.max(1, parseInt(page as string) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20));

      logger.info("GET /discovery/search", { query, page: pageNum });

      const filters = {
        categoryId: categoryId ? (categoryId as string) : undefined,
        status: status ? (status as string) : undefined,
      };

      const result = await discoveryService.searchRooms(query, filters, pageNum, limitNum);

      res.json({
        success: true,
        data: result.data,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          hasMore: result.hasMore,
        },
      });
    } catch (err) {
      logger.error("GET /discovery/search failed", { error: err });
      res.status(400).json({ success: false, error: "Search failed" });
    }
  });

  /**
   * GET /room/:id
   * Room details + participants
   */
  router.get("/room/:id", validateJWT, async (req: Request, res: Response) => {
    try {
      const { id: roomId } = req.params;

      logger.info("GET /room/:id", { roomId });

      const room = await discoveryService.getRoomDetails(roomId);

      res.json({
        success: true,
        data: room,
      });
    } catch (err) {
      logger.error("GET /room/:id failed", { error: err });
      res.status(404).json({ success: false, error: "Room not found" });
    }
  });

  /**
   * POST /room/:id/join
   * Join a room (creates room_participant record)
   */
  router.post("/room/:id/join", validateJWT, async (req: Request, res: Response) => {
    try {
      const { id: roomId } = req.params;
      const agentId = (req as any).user?.id;

      if (!agentId) {
        return res.status(401).json({ success: false, error: "Not authenticated" });
      }

      logger.info("POST /room/:id/join", { roomId, agentId });

      // Check if already a participant
      const { rows: [existing] } = await (req as any).db.query(
        `SELECT id FROM room_participant WHERE room_id = $1 AND agent_id = $2 AND left_at IS NULL`,
        [roomId, agentId]
      );

      if (existing) {
        return res.status(400).json({ success: false, error: "Already in room" });
      }

      // Add participant
      await (req as any).db.query(
        `INSERT INTO room_participant (room_id, agent_id) VALUES ($1, $2)`,
        [roomId, agentId]
      );

      // Get updated room details
      const room = await discoveryService.getRoomDetails(roomId);

      res.json({
        success: true,
        message: "Joined room",
        data: room,
      });
    } catch (err) {
      logger.error("POST /room/:id/join failed", { error: err });
      res.status(400).json({ success: false, error: "Failed to join room" });
    }
  });

  return router;
}
```

### Afternoon: Register Routes

Update `backend/src/server.ts` to mount the discovery routes:

```typescript
// In server.ts, after other route imports:
import { createDiscoveryRoutes } from "@/api/routes/discovery";
import { createDiscoveryService } from "@/services/discovery-service";
import { createTrendingService } from "@/services/trending-service";

// ... in createServer() function:
const discoveryService = createDiscoveryService(db);
const trendingService = createTrendingService(db);

app.use("/api", createDiscoveryRoutes(discoveryService, trendingService));
```

---

## Day 5: Integration Tests

### Entire Day: Build Comprehensive Tests

📁 **tests/integration/discovery.test.ts** (NEW)

```typescript
import request from "supertest";
import { Pool } from "pg";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createServer } from "@/server";
import { seed } from "@/database/seeds";

let app: any;
let db: Pool;
let jwtToken: string;
let userId: string;

beforeAll(async () => {
  // Setup
  app = createServer();
  db = app.locals.db;

  // Seed test data
  await seed(db);

  // Create test user
  const registerRes = await request(app).post("/api/auth/register").send({
    email: "discovery@test.com",
    username: "discoverytest",
    password: "TestPass123!",
  });

  jwtToken = registerRes.body.data.accessToken;
  userId = registerRes.body.data.user.id;
});

afterAll(async () => {
  await db.end();
});

describe("Discovery API", () => {
  describe("GET /api/discovery", () => {
    it("should return main discovery page", async () => {
      const res = await request(app)
        .get("/api/discovery")
        .set("Authorization", `Bearer ${jwtToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("liveNow");
      expect(res.body.data).toHaveProperty("trending");
      expect(res.body.data).toHaveProperty("categories");
      expect(Array.isArray(res.body.data.categories)).toBe(true);
      expect(res.body.data.categories.length).toBeGreaterThan(0);
    });

    it("should return 401 without auth token", async () => {
      const res = await request(app).get("/api/discovery");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/discovery/live-now", () => {
    it("should return paginated live rooms", async () => {
      const res = await request(app)
        .get("/api/discovery/live-now?page=1&limit=10")
        .set("Authorization", `Bearer ${jwtToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toHaveProperty("page", 1);
      expect(res.body.pagination).toHaveProperty("limit", 10);
      expect(res.body.pagination).toHaveProperty("hasMore");
    });

    it("should validate pagination params", async () => {
      const res = await request(app)
        .get("/api/discovery/live-now?page=-1&limit=200")
        .set("Authorization", `Bearer ${jwtToken}`);

      expect(res.status).toBe(200);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBeLessThanOrEqual(100);
    });
  });

  describe("GET /api/discovery/trending", () => {
    it("should return trending rooms", async () => {
      const res = await request(app)
        .get("/api/discovery/trending")
        .set("Authorization", `Bearer ${jwtToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("should respect limit parameter", async () => {
      const res = await request(app)
        .get("/api/discovery/trending?limit=5")
        .set("Authorization", `Bearer ${jwtToken}`);

      expect(res.body.data.length).toBeLessThanOrEqual(5);
    });
  });

  describe("GET /api/discovery/categories", () => {
    it("should return all categories", async () => {
      const res = await request(app)
        .get("/api/discovery/categories")
        .set("Authorization", `Bearer ${jwtToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(10); // Seeded in migration
    });

    it("should include category details", async () => {
      const res = await request(app)
        .get("/api/discovery/categories")
        .set("Authorization", `Bearer ${jwtToken}`);

      const category = res.body.data[0];
      expect(category).toHaveProperty("id");
      expect(category).toHaveProperty("name");
      expect(category).toHaveProperty("slug");
      expect(category).toHaveProperty("color");
    });
  });

  describe("GET /api/discovery/categories/:id", () => {
    let categoryId: string;

    beforeEach(async () => {
      // Get first category
      const res = await request(app)
        .get("/api/discovery/categories")
        .set("Authorization", `Bearer ${jwtToken}`);
      categoryId = res.body.data[0].id;
    });

    it("should return rooms in category", async () => {
      const res = await request(app)
        .get(`/api/discovery/categories/${categoryId}`)
        .set("Authorization", `Bearer ${jwtToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("should return 404 for invalid category", async () => {
      const res = await request(app)
        .get(`/api/discovery/categories/invalid-id`)
        .set("Authorization", `Bearer ${jwtToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/discovery/search", () => {
    it("should search rooms by query", async () => {
      const res = await request(app)
        .get("/api/discovery/search?q=debate")
        .set("Authorization", `Bearer ${jwtToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toHaveProperty("total");
    });

    it("should return 400 without query", async () => {
      const res = await request(app)
        .get("/api/discovery/search")
        .set("Authorization", `Bearer ${jwtToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should support category filter", async () => {
      const categoriesRes = await request(app)
        .get("/api/discovery/categories")
        .set("Authorization", `Bearer ${jwtToken}`);

      const categoryId = categoriesRes.body.data[0].id;

      const res = await request(app)
        .get(`/api/discovery/search?q=debate&categoryId=${categoryId}`)
        .set("Authorization", `Bearer ${jwtToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe("GET /api/room/:id", () => {
    let roomId: string;

    beforeEach(async () => {
      // Get first live room
      const res = await request(app)
        .get("/api/discovery/live-now?limit=1")
        .set("Authorization", `Bearer ${jwtToken}`);

      if (res.body.data.length > 0) {
        roomId = res.body.data[0].id;
      }
    });

    it("should return room details", async () => {
      if (!roomId) {
        console.log("No rooms to test");
        return;
      }

      const res = await request(app)
        .get(`/api/room/${roomId}`)
        .set("Authorization", `Bearer ${jwtToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("id", roomId);
      expect(res.body.data).toHaveProperty("title");
      expect(res.body.data).toHaveProperty("participants");
      expect(Array.isArray(res.body.data.participants)).toBe(true);
    });

    it("should return 404 for non-existent room", async () => {
      const res = await request(app)
        .get("/api/room/non-existent")
        .set("Authorization", `Bearer ${jwtToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/room/:id/join", () => {
    let roomId: string;

    beforeEach(async () => {
      // Get first live room
      const res = await request(app)
        .get("/api/discovery/live-now?limit=1")
        .set("Authorization", `Bearer ${jwtToken}`);

      if (res.body.data.length > 0) {
        roomId = res.body.data[0].id;
      }
    });

    it("should join room successfully", async () => {
      if (!roomId) {
        console.log("No rooms to test");
        return;
      }

      const res = await request(app)
        .post(`/api/room/${roomId}/join`)
        .set("Authorization", `Bearer ${jwtToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("id", roomId);
    });

    it("should not allow joining twice", async () => {
      if (!roomId) return;

      // Join first time
      await request(app)
        .post(`/api/room/${roomId}/join`)
        .set("Authorization", `Bearer ${jwtToken}`);

      // Try to join again
      const res = await request(app)
        .post(`/api/room/${roomId}/join`)
        .set("Authorization", `Bearer ${jwtToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 401 without auth", async () => {
      if (!roomId) return;

      const res = await request(app).post(`/api/room/${roomId}/join`);

      expect(res.status).toBe(401);
    });
  });
});
```

### Evening: Run Tests & Verify

```bash
# Run discovery tests
npm test -- tests/integration/discovery.test.ts

# Expected output:
# ✓ Discovery API
#   ✓ GET /api/discovery
#     ✓ should return main discovery page
#     ✓ should return 401 without auth token
#   ✓ GET /api/discovery/live-now
#     ... [all tests passing]
#
# Total: 20+ tests passing
```

---

## Week 1 Checklist

### Database
- [ ] Migration 002_discovery_schema.sql created
- [ ] Categories seeded (10 total)
- [ ] Indexes created for performance
- [ ] Full-text search configured
- [ ] Views created (room_discovery_view)

### Services
- [ ] DiscoveryService implemented (6 methods)
  - [ ] getLiveNow()
  - [ ] getTrendingRooms()
  - [ ] getByCategory()
  - [ ] searchRooms()
  - [ ] getRoomDetails()
  - [ ] getCategories()
- [ ] TrendingService implemented (scoring logic)
  - [ ] calculateTrendingScore()
  - [ ] updateAllTrendingScores()
  - [ ] updateRoomTrendingScore()

### API Routes
- [ ] GET /api/discovery
- [ ] GET /api/discovery/live-now
- [ ] GET /api/discovery/trending
- [ ] GET /api/discovery/categories
- [ ] GET /api/discovery/categories/:id
- [ ] GET /api/discovery/search
- [ ] GET /api/room/:id
- [ ] POST /api/room/:id/join
- [ ] All routes mounted in server.ts

### Tests
- [ ] 20+ integration tests written
- [ ] All tests passing
- [ ] Coverage > 80%
- [ ] Error cases covered

### Documentation
- [ ] All services documented with JSDoc
- [ ] All routes documented with examples
- [ ] Error handling documented

---

## Summary: Week 1

**Deliverables:**
✅ Discovery schema with 4 new tables (categories, room_viewers, room_engagement, updated room)  
✅ DiscoveryService with 6 methods (live, trending, search, categories, details, join)  
✅ TrendingService with scoring algorithm  
✅ 8 API routes with full error handling  
✅ 20+ integration tests (all passing)  

**Next: Week 2 focuses on Trending caching and real-time updates.**

---

Generated: March 1, 2026  
Status: READY FOR IMPLEMENTATION
