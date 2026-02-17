/**
 * Discovery Service
 * Handles fetching and filtering rooms for discovery page
 */

import type { Pool, QueryResult } from "pg";
import type {
  DiscoveryRoom,
  RoomDetails,
  Category,
  DiscoveryFilters,
  PaginatedResponse,
} from "../../common/types/discovery.js";
import { NotFoundError, DatabaseError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import {
  sanitizeSearchQuery,
  buildPaginationParams,
  SQLInjectionError,
} from "../utils/sql-injection-prevention.js";

/**
 * DiscoveryService: Fetch and filter rooms for discovery page
 *
 * Responsibilities:
 * - Get live rooms (status='live', sorted by viewer_count)
 * - Get trending rooms (sorted by trending_score)
 * - Search rooms (full-text search on objective, description)
 * - Filter by category
 * - Paginate results
 * - Load room details with participants
 */
export class DiscoveryService {
  constructor(private db: Pool) {}

  /**
   * Get all live rooms with pagination
   */
  async getLiveNow(
    page: number = 1,
    limit: number = 20,
  ): Promise<PaginatedResponse<DiscoveryRoom>> {
    try {
      logger.info("Fetching live rooms", { page, limit });

      const offset = (page - 1) * limit;

      // Get live rooms with viewer count
      const { rows: rooms } = await this.db.query(
        `
        SELECT
          r.id,
          r.objective,
          r.description,
          r.type,
          r.status,
          r.thumbnail_url,
          r.created_at,
          r.started_at,
          c.id as category_id,
          c.name as category_name,
          c.color as category_color,
          c.slug as category_slug,
          a.id as host_agent_id,
          a.name as host_agent_name,
          a.avatar as host_agent_avatar,
          COALESCE(rv.viewer_count, 0) as viewer_count,
          COUNT(DISTINCT rp.agent_id) as participant_count,
          COALESCE(re.trending_score, 0) as trending_score
        FROM room r
        LEFT JOIN category c ON r.category_id = c.id
        LEFT JOIN agent a ON r.host_agent_id = a.id
        LEFT JOIN room_viewers rv ON r.id = rv.room_id
        LEFT JOIN room_engagement re ON r.id = re.room_id
        LEFT JOIN room_participant rp ON r.id = rp.room_id AND rp.left_at IS NULL
        WHERE r.status = 'live' AND r.visibility = 'public'
        GROUP BY r.id, c.id, a.id, rv.room_id, re.room_id
        ORDER BY rv.viewer_count DESC NULLS LAST, r.started_at DESC
        LIMIT $1 OFFSET $2
        `,
        [limit, offset],
      );

      // Get total count
      const countResult = await this.db.query(
        `SELECT COUNT(*) as total_count FROM room WHERE status = 'live' AND visibility = 'public'`,
      );
      const totalCount = parseInt(countResult.rows[0].total_count, 10);

      logger.info("Live rooms fetched", {
        count: rooms.length,
        total: totalCount,
        page,
      });

      return {
        data: rooms.map(this._mapRoomRow),
        pagination: {
          page,
          limit,
          total: totalCount,
          hasMore: offset + limit < totalCount,
        },
      };
    } catch (err) {
      logger.error("Failed to fetch live rooms", { error: err, page, limit });
      throw new DatabaseError("Failed to fetch live rooms", {
        cause: err as Error,
      });
    }
  }

  /**
   * Get trending rooms (sorted by engagement metrics)
   */
  async getTrendingRooms(limit: number = 10): Promise<DiscoveryRoom[]> {
    try {
      logger.info("Fetching trending rooms", { limit });

      const { rows: rooms } = await this.db.query(
        `
        SELECT
          r.id,
          r.objective,
          r.description,
          r.type,
          r.status,
          r.thumbnail_url,
          r.created_at,
          r.started_at,
          c.id as category_id,
          c.name as category_name,
          c.color as category_color,
          c.slug as category_slug,
          a.id as host_agent_id,
          a.name as host_agent_name,
          a.avatar as host_agent_avatar,
          COALESCE(rv.viewer_count, 0) as viewer_count,
          COALESCE(re.trending_score, 0) as trending_score,
          COUNT(DISTINCT rp.agent_id) as participant_count
        FROM room r
        LEFT JOIN category c ON r.category_id = c.id
        LEFT JOIN agent a ON r.host_agent_id = a.id
        LEFT JOIN room_viewers rv ON r.id = rv.room_id
        LEFT JOIN room_engagement re ON r.id = re.room_id
        LEFT JOIN room_participant rp ON r.id = rp.room_id AND rp.left_at IS NULL
        WHERE (r.status = 'live' OR r.status = 'completed') AND r.visibility = 'public'
        GROUP BY r.id, c.id, a.id, rv.room_id, re.room_id
        ORDER BY COALESCE(re.trending_score, 0) DESC, rv.viewer_count DESC
        LIMIT $1
        `,
        [limit],
      );

      logger.info("Trending rooms fetched", { count: rooms.length });
      return rooms.map(this._mapRoomRow);
    } catch (err) {
      logger.error("Failed to fetch trending rooms", { error: err, limit });
      throw new DatabaseError("Failed to fetch trending rooms", {
        cause: err as Error,
      });
    }
  }

  /**
   * Get rooms by category with pagination
   */
  async getByCategory(
    categoryId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<PaginatedResponse<DiscoveryRoom>> {
    try {
      logger.info("Fetching rooms by category", { categoryId, page, limit });

      const offset = (page - 1) * limit;

      // Verify category exists
      const categoryResult = await this.db.query(
        `SELECT id FROM category WHERE id = $1`,
        [categoryId],
      );

      if (categoryResult.rows.length === 0) {
        throw new NotFoundError("Category", categoryId);
      }

      // Get rooms in category
      const { rows: rooms } = await this.db.query(
        `
        SELECT
          r.id,
          r.objective,
          r.description,
          r.type,
          r.status,
          r.thumbnail_url,
          r.created_at,
          r.started_at,
          c.id as category_id,
          c.name as category_name,
          c.color as category_color,
          c.slug as category_slug,
          a.id as host_agent_id,
          a.name as host_agent_name,
          a.avatar as host_agent_avatar,
          COALESCE(rv.viewer_count, 0) as viewer_count,
          COUNT(DISTINCT rp.agent_id) as participant_count,
          COALESCE(re.trending_score, 0) as trending_score
        FROM room r
        LEFT JOIN category c ON r.category_id = c.id
        LEFT JOIN agent a ON r.host_agent_id = a.id
        LEFT JOIN room_viewers rv ON r.id = rv.room_id
        LEFT JOIN room_engagement re ON r.id = re.room_id
        LEFT JOIN room_participant rp ON r.id = rp.room_id AND rp.left_at IS NULL
        WHERE r.category_id = $1 AND r.visibility = 'public'
        GROUP BY r.id, c.id, a.id, rv.room_id, re.room_id
        ORDER BY r.started_at DESC NULLS LAST
        LIMIT $2 OFFSET $3
        `,
        [categoryId, limit, offset],
      );

      // Get total count
      const countResult = await this.db.query(
        `SELECT COUNT(*) as total_count FROM room WHERE category_id = $1 AND visibility = 'public'`,
        [categoryId],
      );
      const totalCount = parseInt(countResult.rows[0].total_count, 10);

      return {
        data: rooms.map(this._mapRoomRow),
        pagination: {
          page,
          limit,
          total: totalCount,
          hasMore: offset + limit < totalCount,
        },
      };
    } catch (err) {
      logger.error("Failed to fetch rooms by category", {
        error: err,
        categoryId,
        page,
        limit,
      });
      throw new DatabaseError("Failed to fetch rooms by category", {
        cause: err as Error,
      });
    }
  }

  /**
   * Search rooms by objective and description (full-text search)
   */
  async searchRooms(
    query: string,
    filters?: DiscoveryFilters,
    page: number = 1,
    limit: number = 20,
  ): Promise<PaginatedResponse<DiscoveryRoom>> {
    try {
      // Validate and sanitize query to prevent SQL injection
      if (!query || query.trim().length === 0) {
        throw new Error("Search query cannot be empty");
      }

      // Sanitize search query to prevent SQL injection in full-text search
      const sanitizedQuery = sanitizeSearchQuery(query);

      if (!sanitizedQuery) {
        throw new Error("Search query contains invalid characters");
      }

      // Validate pagination parameters
      const { limit: validLimit, offset } = buildPaginationParams(
        limit,
        (page - 1) * limit,
        100,
      );

      logger.info("Searching rooms", {
        query: sanitizedQuery,
        filters,
        page,
        limit: validLimit,
      });

      let sql = `
        SELECT
          r.id,
          r.objective,
          r.description,
          r.type,
          r.status,
          r.thumbnail_url,
          r.created_at,
          r.started_at,
          c.id as category_id,
          c.name as category_name,
          c.color as category_color,
          c.slug as category_slug,
          a.id as host_agent_id,
          a.name as host_agent_name,
          a.avatar as host_agent_avatar,
          COALESCE(rv.viewer_count, 0) as viewer_count,
          COUNT(DISTINCT rp.agent_id) as participant_count,
          COALESCE(re.trending_score, 0) as trending_score
        FROM room r
        LEFT JOIN category c ON r.category_id = c.id
        LEFT JOIN agent a ON r.host_agent_id = a.id
        LEFT JOIN room_viewers rv ON r.id = rv.room_id
        LEFT JOIN room_engagement re ON r.id = re.room_id
        LEFT JOIN room_participant rp ON r.id = rp.room_id AND rp.left_at IS NULL
        WHERE r.search_vector @@ plainto_tsquery('english', $1)
          AND r.visibility = 'public'
      `;

      const params: any[] = [sanitizedQuery];

      // Apply optional filters with validation
      if (filters?.categoryId) {
        // Validate categoryId is a valid UUID format
        const uuidPattern =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidPattern.test(filters.categoryId)) {
          throw new Error("Invalid category ID format");
        }
        sql += ` AND r.category_id = $${params.length + 1}`;
        params.push(filters.categoryId);
      }

      if (filters?.status) {
        // Validate status is an allowed value
        const allowedStatuses = ["live", "completed", "pending", "cancelled"];
        if (!allowedStatuses.includes(filters.status)) {
          throw new Error("Invalid status filter");
        }
        sql += ` AND r.status = $${params.length + 1}`;
        params.push(filters.status);
      }

      sql += `
        GROUP BY r.id, c.id, a.id, rv.room_id, re.room_id
        ORDER BY ts_rank(r.search_vector, plainto_tsquery('english', $1)) DESC,
                 r.started_at DESC NULLS LAST
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;

      params.push(validLimit, offset);

      const { rows: rooms } = await this.db.query(sql, params);

      // Get total count
      let countSql =
        `SELECT COUNT(*) as total_count FROM room ` +
        `WHERE search_vector @@ plainto_tsquery('english', $1) AND visibility = 'public'`;
      const countParams: any[] = [sanitizedQuery];

      if (filters?.categoryId) {
        countSql += ` AND category_id = $${countParams.length + 1}`;
        countParams.push(filters.categoryId);
      }

      const countResult = await this.db.query(countSql, countParams);
      const totalCount = parseInt(countResult.rows[0].total_count, 10);

      return {
        data: rooms.map(this._mapRoomRow),
        pagination: {
          page,
          limit: validLimit,
          total: totalCount,
          hasMore: offset + validLimit < totalCount,
        },
      };
    } catch (err) {
      // Handle SQL injection errors specifically
      if (err instanceof SQLInjectionError) {
        logger.error("SQL injection attempt detected in search", {
          error: err.message,
          context: err.context,
          ip: "req.ip", // Would need access to req object in real implementation
        });
        throw new DatabaseError("Invalid search query", { cause: err });
      }

      logger.error("Search failed", { error: err, query, page, limit });
      throw new DatabaseError("Search failed", { cause: err as Error });
    }
  }

  /**
   * Get full room details including participants
   */
  async getRoomDetails(roomId: string): Promise<RoomDetails> {
    try {
      logger.info("Fetching room details", { roomId });

      // Get room with engagement metrics
      const roomResult = await this.db.query(
        `
        SELECT
          r.id,
          r.objective,
          r.description,
          r.type,
          r.status,
          r.thumbnail_url,
          r.created_at,
          r.started_at,
          r.ended_at,
          c.id as category_id,
          c.name as category_name,
          c.color as category_color,
          c.slug as category_slug,
          a.id as host_agent_id,
          a.name as host_agent_name,
          a.avatar as host_agent_avatar,
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
        [roomId],
      );

      if (roomResult.rows.length === 0) {
        throw new NotFoundError("Room", roomId);
      }

      const room = roomResult.rows[0];

      // Get participants
      const { rows: participants } = await this.db.query(
        `
        SELECT
          a.id,
          a.name,
          a.avatar,
          rp.joined_at
        FROM room_participant rp
        LEFT JOIN agent a ON rp.agent_id = a.id
        WHERE rp.room_id = $1 AND rp.left_at IS NULL
        ORDER BY rp.joined_at ASC
        `,
        [roomId],
      );

      const mappedRoom = this._mapRoomRow(room);

      return {
        ...mappedRoom,
        description: room.description,
        participants: participants.map((p: any) => ({
          id: p.id,
          name: p.name,
          avatar: p.avatar,
          joinedAt: p.joined_at,
        })),
      };
    } catch (err) {
      logger.error("Failed to fetch room details", { error: err, roomId });
      throw new DatabaseError("Failed to fetch room details", {
        cause: err as Error,
      });
    }
  }

  /**
   * Get all categories
   */
  async getCategories(): Promise<Category[]> {
    try {
      logger.info("Fetching categories");

      const { rows: categories } = await this.db.query(
        `SELECT id, name, slug, description, icon_url, color, order_index 
         FROM category 
         ORDER BY order_index ASC`,
      );

      return categories.map((c: any) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        iconUrl: c.icon_url,
        color: c.color,
        orderIndex: c.order_index,
      }));
    } catch (err) {
      logger.error("Failed to fetch categories", { error: err });
      throw new DatabaseError("Failed to fetch categories", {
        cause: err as Error,
      });
    }
  }

  /**
   * Helper: Map database row to DiscoveryRoom object
   */
  private _mapRoomRow(row: any): DiscoveryRoom {
    return {
      id: row.id,
      objective: row.objective,
      description: row.description,
      type: row.type,
      status: row.status,
      thumbnailUrl: row.thumbnail_url,
      createdAt: row.created_at,
      startedAt: row.started_at,
      category: row.category_id
        ? {
            id: row.category_id,
            name: row.category_name,
            slug: row.category_slug,
            color: row.category_color,
            description: "",
            iconUrl: "",
            orderIndex: 0,
          }
        : undefined,
      hostAgent: {
        id: row.host_agent_id,
        name: row.host_agent_name,
        avatar: row.host_agent_avatar,
      },
      viewerCount: row.viewer_count,
      participantCount: row.participant_count,
      trendingScore: row.trending_score,
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
