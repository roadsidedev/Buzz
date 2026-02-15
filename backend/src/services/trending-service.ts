/**
 * Trending Service
 * Calculates and manages trending scores for rooms with Redis caching
 */

import type { Pool } from "pg";
import { DatabaseError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import type { CacheService } from "./cache-service.js";
import { CacheKeyBuilder, CACHE_TTL } from "../utils/cache-keys.js";

/**
 * Trending metrics for a room
 */
export interface TrendingMetrics {
  roomId: string;
  viewerCount: number;
  totalMessages: number;
  engagementRate: number;
  growthRate: number;
  startedAt: Date;
  categoryId?: string;
}

/**
 * TrendingService: Calculate and cache trending scores
 *
 * Scoring formula (0-100):
 * trending_score = (
 *   0.35 * (viewer_count / max_viewers) +       // Popularity (35%)
 *   0.25 * (growth_rate / max_growth) +         // Growth (25%)
 *   0.20 * (engagement_rate / max_engagement) + // Engagement (20%)
 *   0.15 * time_boost +                         // Recency (15%)
 *   0.05 * category_affinity                    // Category (5%)
 * ) * 100
 */
export class TrendingService {
  private readonly SCORING_WEIGHTS = {
    POPULARITY: 0.35,
    GROWTH: 0.25,
    ENGAGEMENT: 0.2,
    RECENCY: 0.15,
    CATEGORY: 0.05,
  };

  constructor(
    private db: Pool,
    private cache?: CacheService
  ) {}

  /**
   * Calculate trending score for a single room
   *
   * @param metrics - Room engagement metrics
   * @returns Score 0-100
   */
  calculateTrendingScore(metrics: TrendingMetrics): number {
    // 1. Popularity: viewer count (normalized)
    const maxViewers = 10000; // Arbitrary max for normalization
    const popularityScore = Math.min(metrics.viewerCount / maxViewers, 1.0);

    // 2. Growth: % change in last hour (normalized)
    const maxGrowth = 200; // 200% growth is excellent
    const growthScore = Math.min(Math.abs(metrics.growthRate) / maxGrowth, 1.0);

    // 3. Engagement: messages per viewer
    const maxEngagement = 5; // 5 messages per viewer is high
    const engagementScore = Math.min(
      metrics.engagementRate / maxEngagement,
      1.0
    );

    // 4. Recency: boost newer rooms
    const timeSinceStart = Date.now() - new Date(metrics.startedAt).getTime();
    const minutesRunning = timeSinceStart / (1000 * 60);
    let recencyBoost = 1.0;
    if (minutesRunning < 30) recencyBoost = 1.0; // New rooms get full boost
    else if (minutesRunning < 60) recencyBoost = 0.9;
    else if (minutesRunning < 180) recencyBoost = 0.7; // 3 hours
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
        WHERE r.status = 'live' OR r.status = 'completed'
      `);

      let updatedCount = 0;

      // Calculate and update score for each room
      for (const room of rooms) {
        const score = this.calculateTrendingScore({
          roomId: room.id,
          viewerCount: room.viewer_count,
          totalMessages: room.total_messages,
          engagementRate: room.engagement_rate,
          growthRate: room.growth_rate,
          startedAt: room.started_at,
          categoryId: room.category_id,
        });

        // Update score in database
        await this.db.query(
          `UPDATE room_engagement 
           SET trending_score = $1, updated_at = now() 
           WHERE room_id = $2`,
          [score, room.id]
        );

        updatedCount++;
      }

      logger.info("Trending scores updated", { count: updatedCount });
      return updatedCount;
    } catch (err) {
      logger.error("Failed to update trending scores", { error: err });
      throw new DatabaseError("Failed to update trending scores", {
        cause: err as Error,
      });
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
      const result = await this.db.query(
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

      if (result.rows.length === 0) {
        logger.warn("Room not found for trending update", { roomId });
        return;
      }

      const room = result.rows[0];

      const score = this.calculateTrendingScore({
        roomId,
        viewerCount: room.viewer_count,
        totalMessages: room.total_messages,
        engagementRate: room.engagement_rate,
        growthRate: room.growth_rate,
        startedAt: room.started_at,
        categoryId: room.category_id,
      });

      await this.db.query(
        `UPDATE room_engagement 
         SET trending_score = $1, updated_at = now() 
         WHERE room_id = $2`,
        [score, roomId]
      );

      logger.debug("Room trending score updated", { roomId, score });
    } catch (err) {
      logger.error("Failed to update room trending score", {
        error: err,
        roomId,
      });
      throw new DatabaseError("Failed to update room trending score", {
        cause: err as Error,
      });
    }
  }

  /**
   * Update viewer count for a room
   */
  async updateViewerCount(roomId: string, count: number): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO room_viewers (room_id, viewer_count) 
         VALUES ($1, $2)
         ON CONFLICT (room_id) DO UPDATE 
         SET viewer_count = $2, updated_at = now()`,
        [roomId, count]
      );

      // Also update engagement metrics
      await this.updateRoomTrendingScore(roomId);
    } catch (err) {
      logger.error("Failed to update viewer count", { error: err, roomId });
      throw new DatabaseError("Failed to update viewer count", {
        cause: err as Error,
      });
    }
  }

  /**
   * Update engagement metrics for a room
   */
  async updateEngagementMetrics(
    roomId: string,
    metrics: {
      totalMessages?: number;
      totalLikes?: number;
      engagementRate?: number;
      growthRate?: number;
    }
  ): Promise<void> {
    try {
      let updateSql = `UPDATE room_engagement SET updated_at = now()`;
      const params: any[] = [];

      if (metrics.totalMessages !== undefined) {
        params.push(metrics.totalMessages);
        updateSql += `, total_messages = $${params.length}`;
      }

      if (metrics.totalLikes !== undefined) {
        params.push(metrics.totalLikes);
        updateSql += `, total_likes = $${params.length}`;
      }

      if (metrics.engagementRate !== undefined) {
        params.push(metrics.engagementRate);
        updateSql += `, engagement_rate = $${params.length}`;
      }

      if (metrics.growthRate !== undefined) {
        params.push(metrics.growthRate);
        updateSql += `, growth_rate = $${params.length}`;
      }

      params.push(roomId);
      updateSql += ` WHERE room_id = $${params.length}`;

      await this.db.query(updateSql, params);

      // Recalculate trending score with new metrics
      await this.updateRoomTrendingScore(roomId);
    } catch (err) {
      logger.error("Failed to update engagement metrics", {
        error: err,
        roomId,
      });
      throw new DatabaseError("Failed to update engagement metrics", {
        cause: err as Error,
      });
    }
  }

  /**
   * Initialize room engagement record on room creation
   */
  async initializeRoomEngagement(roomId: string): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO room_engagement (room_id) 
         VALUES ($1)
         ON CONFLICT (room_id) DO NOTHING`,
        [roomId]
      );

      await this.db.query(
        `INSERT INTO room_viewers (room_id) 
         VALUES ($1)
         ON CONFLICT (room_id) DO NOTHING`,
        [roomId]
      );
    } catch (err) {
      logger.error("Failed to initialize room engagement", {
        error: err,
        roomId,
      });
      throw new DatabaseError("Failed to initialize room engagement", {
        cause: err as Error,
      });
    }
  }

  /**
   * Get trending rooms from cache or calculate fresh
   * Includes optional category filter
   *
   * @param limit - Number of rooms to return
   * @param categoryId - Optional category filter
   * @returns Array of trending room data
   */
  async getTrendingCached(
    limit: number = 20,
    categoryId?: string
  ): Promise<any[]> {
    const cacheKey = CacheKeyBuilder.trending(categoryId);

    // Try to get from cache first
    if (this.cache) {
      const cached = await this.cache.get<any[]>(cacheKey);
      if (cached) {
        logger.debug("Trending cache hit", { key: cacheKey });
        return cached.slice(0, limit);
      }
    }

    // Cache miss - fetch and calculate
    logger.debug("Trending cache miss, calculating fresh", { key: cacheKey });

    const query = categoryId
      ? `
        SELECT
          r.id,
          r.objective,
          r.started_at,
          r.category_id,
          c.name as category_name,
          a.name as host_agent_name,
          COALESCE(rv.viewer_count, 0) as viewer_count,
          COALESCE(re.trending_score, 0) as trending_score,
          COALESCE(re.total_messages, 0) as total_messages,
          COALESCE(re.engagement_rate, 0) as engagement_rate,
          COALESCE(re.growth_rate, 0) as growth_rate
        FROM room r
        LEFT JOIN category c ON r.category_id = c.id
        LEFT JOIN agent a ON r.host_agent_id = a.id
        LEFT JOIN room_viewers rv ON r.id = rv.room_id
        LEFT JOIN room_engagement re ON r.id = re.room_id
        WHERE (r.status = 'live' OR r.status = 'completed')
          AND r.visibility = 'public'
          AND r.category_id = $1
        ORDER BY re.trending_score DESC NULLS LAST, r.started_at DESC
        LIMIT $2
      `
      : `
        SELECT
          r.id,
          r.objective,
          r.started_at,
          r.category_id,
          c.name as category_name,
          a.name as host_agent_name,
          COALESCE(rv.viewer_count, 0) as viewer_count,
          COALESCE(re.trending_score, 0) as trending_score,
          COALESCE(re.total_messages, 0) as total_messages,
          COALESCE(re.engagement_rate, 0) as engagement_rate,
          COALESCE(re.growth_rate, 0) as growth_rate
        FROM room r
        LEFT JOIN category c ON r.category_id = c.id
        LEFT JOIN agent a ON r.host_agent_id = a.id
        LEFT JOIN room_viewers rv ON r.id = rv.room_id
        LEFT JOIN room_engagement re ON r.id = re.room_id
        WHERE (r.status = 'live' OR r.status = 'completed')
          AND r.visibility = 'public'
        ORDER BY re.trending_score DESC NULLS LAST, r.started_at DESC
        LIMIT $1
      `;

    const params = categoryId ? [categoryId, limit] : [limit];
    const { rows } = await this.db.query(query, params);

    // Cache the result
    if (this.cache) {
      await this.cache.set(cacheKey, rows, CACHE_TTL.TRENDING);
    }

    return rows;
  }

  /**
   * Invalidate trending cache
   * Call this when metrics change
   */
  async invalidateTrendingCache(categoryId?: string): Promise<void> {
    if (!this.cache) return;

    try {
      if (categoryId) {
        await this.cache.delete(CacheKeyBuilder.trending(categoryId));
      } else {
        // Invalidate all trending caches
        await this.cache.deletePattern("trending:*");
      }
      logger.debug("Trending cache invalidated", { categoryId });
    } catch (err) {
      logger.warn("Failed to invalidate trending cache", {
        error: err,
        categoryId,
      });
    }
  }

  /**
   * Warm cache on startup or refresh
   * Pre-calculates and caches trending scores
   */
  async warmTrendingCache(): Promise<void> {
    if (!this.cache) return;

    try {
      logger.info("Warming trending cache");

      // Warm global trending
      await this.getTrendingCached(50);

      // Warm popular categories
      const { rows: categories } = await this.db.query(
        `SELECT id FROM category LIMIT 10`
      );

      for (const category of categories) {
        await this.getTrendingCached(20, category.id);
      }

      logger.info("Trending cache warmed", {
        categories: categories.length,
      });
    } catch (err) {
      logger.error("Failed to warm trending cache", { error: err });
    }
  }
}

/**
 * Factory: Create trending service with database connection
 */
export function createTrendingService(
  db: Pool,
  cache?: CacheService
): TrendingService {
  return new TrendingService(db, cache);
}
