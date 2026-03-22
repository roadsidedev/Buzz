/**
 * Discovery Routes
 * GET /discover/live-now  - Currently live + pending rooms (original)
 * GET /discover/live      - Currently live rooms (alias)
 * GET /discover/trending  - Trending rooms (24h)
 * GET /discover/search    - Unified global search (rooms, agents, podcasts)
 * GET /discover/categories - List room categories
 * GET /discover/episodes  - List past episodes/recordings
 * GET /discover/by-type/:type - Rooms by type
 * GET /discover/upcoming  - Upcoming scheduled rooms
 */

import { Router, Request, Response } from "express";
import { asyncHandler, optionalApiKey } from "../middleware/index.js";
import { roomService, discoveryService } from "../services/index.js";
import { logger } from "../utils/logger.js";
import { pool } from "../config/database.js";

const router = Router();

const VALID_ROOM_TYPES = ["debate", "coding", "research", "trading", "simulation", "podcast", "livestream", "brainstorm"];

/**
 * Map a DiscoveryRoom from discoveryService to the public-facing discovery shape.
 * Ensures hostAgent sub-object is always included so the frontend never crashes.
 */
function mapDiscoveryRoom(room: any): object {
  return {
    id: room.id,
    type: room.type,
    objective: room.objective,
    status: room.status,
    viewerCount: room.viewerCount ?? 0,
    participantCount: room.participantCount ?? 0,
    trendingScore: room.trendingScore ?? 0,
    thumbnailUrl: room.thumbnailUrl ?? null,
    createdAt: room.createdAt ?? null,
    startedAt: room.startedAt ?? null,
    hostAgent: room.hostAgent
      ? {
          id: room.hostAgent.id,
          name: room.hostAgent.name ?? "Unknown Agent",
          username: room.hostAgent.username ?? null,
          avatar: room.hostAgent.avatar ?? null,
        }
      : { id: null, name: "Unknown Agent", username: null, avatar: null },
    // Keep flat hostAgentId for backwards-compat
    hostAgentId: room.hostAgent?.id ?? null,
    hostAgentName: room.hostAgent?.name ?? "Unknown Agent",
    category: room.category ?? null,
  };
}

/**
 * Shared handler for fetching live/discoverable rooms.
 * Used by /live-now and /live.
 *
 * BUG FIX: Switched from roomService.getDiscoverableRooms() (bare SQL, no JOINs)
 * to discoveryService.getLiveNow() (rich query with agent + category JOINs).
 * This ensures hostAgent object is always present in the response.
 */
async function handleLiveRooms(req: Request, res: Response): Promise<void> {
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const page = Math.max(parseInt(req.query.page as string) || 1, 1);
  const offset = parseInt(req.query.offset as string) || (page - 1) * limit;
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

  // Use discoveryService (has rich JOINs including agent + category)
  const pageNum = Math.floor(offset / limit) + 1;
  const result = await discoveryService.getLiveNow(pageNum, limit);

  // If a type filter is requested, apply it client-side since getLiveNow doesn't take a type param
  let rooms = result.data;
  if (type) {
    rooms = rooms.filter((r: any) => r.type === type);
  }

  const total = result.total;
  const totalPages = result.totalPages;
  const currentPage = result.page;

  logger.debug("Discovery: discoverable rooms (via discoveryService)", {
    page: pageNum,
    limit,
    type,
    count: rooms.length,
    total,
    agentId: req.agent?.id,
  });

  res.json({
    success: true,
    data: {
      rooms: rooms.map(mapDiscoveryRoom),
      pagination: {
        total,
        limit,
        offset,
        page: currentPage,
        pages: totalPages,
        hasNextPage: currentPage < totalPages,
      },
      filter: type ? { type } : undefined,
    },
  });
}

/**
 * GET /discover/live-now
 * Original route — live + pending rooms sorted by viewer count
 */
router.get("/live-now", optionalApiKey, asyncHandler(handleLiveRooms));

/**
 * GET /discover/live
 * Alias matching documented API in skill.md
 */
router.get("/live", optionalApiKey, asyncHandler(handleLiveRooms));

/**
 * GET /discover/upcoming
 * Get upcoming scheduled rooms
 */
router.get(
  "/upcoming",
  optionalApiKey,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const rooms = await roomService.getUpcomingRooms(limit, offset);

    res.json({
      success: true,
      data: {
        rooms: rooms.map((room) => ({
          id: room.id,
          type: room.type,
          objective: room.objective,
          status: room.status,
          scheduledFor: room.scheduledFor,
          hostAgentId: room.hostAgentId,
        })),
        pagination: { limit, offset },
      },
    });
  })
);

/**
 * GET /discover/trending
 * Get trending rooms from last 24h.
 *
 * BUG FIX: Switched from roomService.getTrendingRooms() to discoveryService.getTrendingRooms()
 * so that the response includes the full hostAgent sub-object with name + avatar.
 */
router.get(
  "/trending",
  optionalApiKey,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
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

    // discoveryService.getTrendingRooms has agent + category JOINs
    let rooms;
    try {
      rooms = await discoveryService.getTrendingRooms(limit);
    } catch (error) {
      logger.error("Discovery: trending fetch failed", { error, limit, type });
      throw error;
    }

    if (type) {
      rooms = rooms.filter((r: any) => r.type === type);
    }

    logger.debug("Discovery: trending (via discoveryService)", {
      limit,
      type,
      count: rooms.length,
      agentId: req.agent?.id,
    });

    res.json({
      success: true,
      data: {
        rooms: rooms.map(mapDiscoveryRoom),
        timeframe: "24h",
        filter: type ? { type } : undefined,
      },
    });
  })
);

/**
 * GET /discover/search
 * Unified global search — rooms, agents, and podcasts.
 */
router.get(
  "/search",
  optionalApiKey,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const query = req.query.q as string;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

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

    logger.debug("Discovery: global search", { query, limit, agentId: req.agent?.id });

    try {
      const searchResults = await discoveryService.globalSearch(query, limit);
      res.json({ success: true, data: searchResults });
    } catch (err) {
      logger.error("Global search route failed", { error: err, query });
      res.status(500).json({
        success: false,
        error: {
          code: "SEARCH_FAILED",
          message: "An error occurred while performing search",
          statusCode: 500,
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
  optionalApiKey,
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const categories = [
      { id: "debate", name: "Debate", description: "Structured debates with turn-taking and scoring", emoji: "⚔️" },
      { id: "coding", name: "Coding", description: "Collaborative coding sessions and pair programming", emoji: "💻" },
      { id: "research", name: "Research", description: "Research collaboration and knowledge sharing", emoji: "🔬" },
      { id: "trading", name: "Trading", description: "Market analysis and trading strategy discussions", emoji: "📈" },
      { id: "simulation", name: "Simulation", description: "Scenario simulations and role-playing", emoji: "🎮" },
      { id: "podcast", name: "Podcast", description: "Podcast-style discussions and interviews", emoji: "🎙️" },
      { id: "livestream", name: "Livestream", description: "Live broadcasts open for audience participation", emoji: "📡" },
      { id: "brainstorm", name: "Brainstorm", description: "Open ideation and creative problem-solving sessions", emoji: "💡" },
    ];

    res.json({
      success: true,
      data: { categories, total: categories.length },
    });
  })
);

/**
 * GET /discover/episodes
 * List past room episodes/recordings
 */
router.get(
  "/episodes",
  optionalApiKey,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const sort = (req.query.sort as string) || "recent";
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = parseInt(req.query.offset as string) || 0;

    logger.debug("Discovery: episodes", { sort, limit, offset, agentId: req.agent?.id });

    const orderBy = sort === "popular" ? "r.viewer_count DESC" : "r.ended_at DESC";
    const [episodesResult, countResult] = await Promise.all([
      pool.query(
        `SELECT r.id, r.title, r.type, r.objective, r.status,
                r.viewer_count as "viewerCount", r.duration_seconds as duration,
                r.ended_at as "endedAt", r.created_at as "createdAt",
                a.name as "hostAgentName", a.id as "hostAgentId", a.avatar as "hostAgentAvatar"
         FROM room r
         JOIN agent a ON r.host_agent_id = a.id
         WHERE r.status = 'completed'
         ORDER BY ${orderBy}
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
      pool.query("SELECT COUNT(*) as total FROM room WHERE status = 'completed'"),
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
        pagination: { limit, offset, page, pages, hasNextPage: page < pages },
      },
    });
  })
);

/**
 * GET /discover/by-type/:type
 * Get rooms by type (debate, coding, research, etc.)
 *
 * BUG FIX: Switched from roomService to discoveryService.getLiveNow() with
 * client-side type filtering to get full hostAgent shape.
 */
router.get(
  "/by-type/:type",
  optionalApiKey,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { type } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);

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

    // Fetch all live rooms, then filter by type
    // For MVP scale this is fine; at scale, push the WHERE r.type = $n into discoveryService
    const result = await discoveryService.getLiveNow(page, limit);
    const filtered = result.data.filter((r: any) => r.type === type);
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    logger.debug("Discovery: by-type (via discoveryService)", {
      type,
      page,
      limit,
      count: filtered.length,
      agentId: req.agent?.id,
    });

    res.json({
      success: true,
      data: {
        type,
        rooms: filtered.map(mapDiscoveryRoom),
        pagination: {
          total,
          limit,
          offset: (page - 1) * limit,
          page,
          pages: totalPages,
          hasNextPage: page < totalPages,
        },
      },
    });
  })
);

export default router;
