/**
 * Discovery Routes
 * GET /discover/live-now  - Currently live rooms (original)
 * GET /discover/live      - Currently live rooms (alias)
 * GET /discover/trending  - Trending rooms (24h)
 * GET /discover/search    - Search rooms by query
 * GET /discover/categories - List room categories
 * GET /discover/episodes  - List past episodes/recordings
 * GET /discover/by-type/:type - Rooms by type
 */

import { Router, Request, Response } from "express";
import { asyncHandler, optionalAuth } from "../middleware/index.js";
import { roomService } from "../services/index.js";
import { logger } from "../utils/logger.js";
import { ValidationError } from "../utils/errors.js";
import { pool } from "../config/database.js";

const router = Router();

const VALID_ROOM_TYPES = ["debate", "coding", "research", "trading", "simulation", "podcast"];

/**
 * Shared handler for fetching live rooms (used by /live-now and /live)
 */
async function handleLiveRooms(req: Request, res: Response): Promise<void> {
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const offset = parseInt(req.query.offset as string) || 0;
  const type = (req.query.type as string) || undefined;

  // Validate room type if provided
  if (type && !VALID_ROOM_TYPES.includes(type)) {
    res.status(400).json({
      success: false,
      error: {
        code: "INVALID_ROOM_TYPE",
        message: `Invalid room type. Valid types: ${VALID_ROOM_TYPES.join(", ")}`,
        statusCode: 400,
      },
    });
    return;
  }

  // Fetch discoverable rooms (live + pending) and total count
  const [rooms, total] = await Promise.all([
    roomService.getDiscoverableRooms(limit, offset, type),
    roomService.getDiscoverableRoomCount(type),
  ]);

  logger.debug("Discovery: discoverable rooms", {
    limit,
    offset,
    type,
    count: rooms.length,
    total,
    agentId: req.agent?.id,
  });

  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  res.json({
    success: true,
    data: {
      rooms: rooms.map((room) => ({
        id: room.id,
        type: room.type,
        objective: room.objective,
        status: room.status,
        viewerCount: room.viewerCount,
        participantCount: room.participantCount,
        hostAgentId: room.hostAgentId,
      })),
      pagination: {
        total,
        limit,
        offset,
        page,
        pages: totalPages,
        hasNextPage: page < totalPages,
      },
      filter: type ? { type } : undefined,
    },
  });
}

/**
 * GET /discover/live-now
 * Get currently live rooms, sorted by viewer count (original route)
 */
router.get(
  "/live-now",
  optionalAuth,
  asyncHandler(handleLiveRooms)
);

/**
 * GET /discover/live
 * Alias for /live-now — matches the documented API in skill.md
 */
router.get(
  "/live",
  optionalAuth,
  asyncHandler(handleLiveRooms)
);

/**
 * GET /discover/trending
 * Get trending rooms from specified timeframe
 */
router.get(
  "/trending",
  optionalAuth,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const hours = Math.max(parseInt(req.query.hours as string) || 24, 1);
    const type = (req.query.type as string) || undefined;

    // Validate room type if provided
    if (type && !VALID_ROOM_TYPES.includes(type)) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_ROOM_TYPE",
          message: `Invalid room type. Valid types: ${VALID_ROOM_TYPES.join(", ")}`,
          statusCode: 400,
        },
      });
      return;
    }

    const rooms = await roomService.getTrendingRooms(hours, limit, type);

    logger.debug("Discovery: trending", {
      limit,
      hours,
      type,
      count: rooms.length,
      agentId: req.agent?.id,
    });

    res.json({
      success: true,
      data: {
        rooms: rooms.map((room) => ({
          id: room.id,
          type: room.type,
          objective: room.objective,
          status: room.status,
          viewerCount: room.viewerCount,
          participantCount: room.participantCount,
        })),
        timeframe: `${hours}h`,
        filter: type ? { type } : undefined,
      },
    });
  })
);

/**
 * GET /discover/search
 * Search rooms by query string
 *
 * Query params:
 *   - q: string (required) — Search query
 *   - type?: string — Filter by room type
 *   - status?: string — Filter by status (live, ended, scheduled)
 *   - limit?: number (default 20, max 100)
 *   - offset?: number (default 0)
 */
router.get(
  "/search",
  optionalAuth,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const query = req.query.q as string;
    const type = (req.query.type as string) || undefined;
    const status = (req.query.status as string) || undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: {
          code: "MISSING_QUERY",
          message: "Search query parameter 'q' is required",
          hint: "Example: /discover/search?q=AI+ethics",
          statusCode: 400,
        },
      });
      return;
    }

    logger.debug("Discovery: search", {
      query,
      type,
      status,
      limit,
      offset,
      agentId: req.agent?.id,
    });

    // Search across rooms — for now, fetch all rooms and filter
    // In production this would use full-text search in PostgreSQL
    try {
      const rooms = await roomService.getLiveRooms(limit, offset, type);
      const searchLower = query.toLowerCase();

      const filtered = rooms.filter((room) =>
        room.objective?.toLowerCase().includes(searchLower) ||
        room.type?.toLowerCase().includes(searchLower)
      );

      res.json({
        success: true,
        data: {
          query,
          rooms: filtered.map((room) => ({
            id: room.id,
            type: room.type,
            objective: room.objective,
            status: room.status,
            viewerCount: room.viewerCount,
            participantCount: room.participantCount,
          })),
          total: filtered.length,
          filter: { type, status },
        },
      });
    } catch {
      // Return empty results on error (don't crash)
      res.json({
        success: true,
        data: {
          query,
          rooms: [],
          total: 0,
        },
      });
    }
  })
);

/**
 * GET /discover/categories
 * List available room categories/types
 */
router.get(
  "/categories",
  optionalAuth,
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const categories = [
      {
        id: "debate",
        name: "Debate",
        description: "Structured debates with turn-taking and scoring",
        emoji: "⚔️",
      },
      {
        id: "coding",
        name: "Coding",
        description: "Collaborative coding sessions and pair programming",
        emoji: "💻",
      },
      {
        id: "research",
        name: "Research",
        description: "Research collaboration and knowledge sharing",
        emoji: "🔬",
      },
      {
        id: "trading",
        name: "Trading",
        description: "Market analysis and trading strategy discussions",
        emoji: "📈",
      },
      {
        id: "simulation",
        name: "Simulation",
        description: "Scenario simulations and role-playing",
        emoji: "🎮",
      },
      {
        id: "podcast",
        name: "Podcast",
        description: "Podcast-style discussions and interviews",
        emoji: "🎙️",
      },
    ];

    res.json({
      success: true,
      data: {
        categories,
        total: categories.length,
      },
    });
  })
);

/**
 * GET /discover/episodes
 * List past room episodes/recordings
 *
 * Query params:
 *   - sort?: string — popular, recent (default: recent)
 *   - limit?: number (default 20, max 50)
 *   - offset?: number (default 0)
 */
router.get(
  "/episodes",
  optionalAuth,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const sort = (req.query.sort as string) || "recent";
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = parseInt(req.query.offset as string) || 0;

    logger.debug("Discovery: episodes", {
      sort,
      limit,
      offset,
      agentId: req.agent?.id,
    });

    // Query completed rooms from the database
    const orderBy = sort === "popular" ? "r.viewer_count DESC" : "r.ended_at DESC";
    const [episodesResult, countResult] = await Promise.all([
      pool.query(
        `SELECT r.id, r.title, r.type, r.objective, r.status,
                r.viewer_count as "viewerCount", r.duration_seconds as duration,
                r.ended_at as "endedAt", r.created_at as "createdAt",
                a.name as "hostAgentName", a.id as "hostAgentId"
         FROM room r
         JOIN agent a ON r.host_agent_id = a.id
         WHERE r.status = 'completed'
         ORDER BY ${orderBy}
         LIMIT $1 OFFSET $2`,
        [limit, offset],
      ),
      pool.query(
        "SELECT COUNT(*) as total FROM room WHERE status = 'completed'",
      ),
    ]);

    const total = parseInt(countResult.rows[0]?.total || "0", 10);
    const page = Math.floor(offset / limit) + 1;
    const pages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        episodes: episodesResult.rows,
        total,
        sort,
        pagination: {
          limit,
          offset,
          page,
          pages,
          hasNextPage: page < pages,
        },
      },
    });
  })
);

/**
 * GET /discover/by-type/:type
 * Get rooms by type (debate, coding, research, etc.)
 */
router.get(
  "/by-type/:type",
  optionalAuth,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { type } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    // Validate room type
    if (!VALID_ROOM_TYPES.includes(type)) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_ROOM_TYPE",
          message: `Invalid room type. Valid types: ${VALID_ROOM_TYPES.join(", ")}`,
          statusCode: 400,
        },
      });
      return;
    }

    // Fetch discoverable rooms filtered by type and total count
    const [rooms, total] = await Promise.all([
      roomService.getDiscoverableRooms(limit, offset, type),
      roomService.getDiscoverableRoomCount(type),
    ]);

    logger.debug("Discovery: by-type", {
      type,
      limit,
      offset,
      count: rooms.length,
      total,
      agentId: req.agent?.id,
    });

    const page = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        type,
        rooms: rooms.map((room) => ({
          id: room.id,
          type: room.type,
          objective: room.objective,
          status: room.status,
          viewerCount: room.viewerCount,
          participantCount: room.participantCount,
        })),
        pagination: {
          total,
          limit,
          offset,
          page,
          pages: totalPages,
          hasNextPage: page < totalPages,
        },
      },
    });
  })
);

export default router;
