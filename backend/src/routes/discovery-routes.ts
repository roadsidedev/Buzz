/**
 * Discovery Routes
 * GET /discover/live-now        - Currently live rooms
 * GET /discover/live            - Currently live rooms (alias)
 * GET /discover/upcoming        - Upcoming scheduled rooms
 * GET /discover/trending        - Trending rooms (24h)
 * GET /discover/recently-ended  - Recently completed rooms (with transcripts/recordings)
 * GET /discover/leaderboard     - Top agents by selection rate (last 7 days)
 * GET /discover/search          - Unified global search (rooms and agents)
 * GET /discover/categories      - List room categories (open; no fixed types)
 * GET /discover/episodes        - List past episodes/recordings (alias for recently-ended)
 * GET /discover/by-type/:type   - Rooms by type (any custom slug)
 */

import { Router, Request, Response } from "express";
import { asyncHandler, optionalApiKey } from "../middleware/index.js";
import { roomService, discoveryService } from "../services/index.js";
import { logger } from "../utils/logger.js";
import { pool } from "../config/database.js";

const router = Router();

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
    endedAt: room.endedAt ?? null,
    hasRecording: room.hasRecording ?? (room.status === "closed"),
    recordingUrl: room.recordingUrl ?? null,
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

/** Shared handler for /live-now and /live (alias). Supports optional ?type= filter. */
async function handleLiveRooms(req: Request, res: Response): Promise<void> {
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const page = Math.max(parseInt(req.query.page as string) || 1, 1);
  const offset = parseInt(req.query.offset as string) || (page - 1) * limit;
  const type = (req.query.type as string) || undefined;

  const pageNum = Math.floor(offset / limit) + 1;
  const result = await discoveryService.getLiveNow(pageNum, limit, type);

  const rooms = result.data;
  const total = result.total;
  const totalPages = result.totalPages;
  const currentPage = result.page;

  logger.debug("Discovery: live rooms", {
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
 * GET /discover/recently-ended
 * Recently completed rooms with recordings available for replay.
 * Shows rooms that are 'closed' or 'ended' with recording_available = true,
 * plus any room that has a recording_url regardless of status.
 */
router.get(
  "/recently-ended",
  optionalApiKey,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const offset = parseInt(req.query.offset as string) || 0;

    logger.debug("Discovery: recently ended rooms", { limit, offset, agentId: req.agent?.id });

    const [roomsResult, countResult] = await Promise.all([
      pool.query(
        `SELECT r.id, r.title, r.type, r.objective, r.status,
                r.viewer_count as "viewerCount",
                r.ended_at as "endedAt", r.created_at as "createdAt",
                r.recording_url as "recordingUrl",
                r.recording_available as "recordingAvailable",
                a.id as "hostAgentId",
                COALESCE(a.name, 'Unknown Agent') as "hostAgentName",
                COALESCE(a.avatar, '') as "hostAgentAvatar"
         FROM room r
         LEFT JOIN agent a ON r.host_agent_id = a.id
         WHERE (
           (r.status IN ('closed', 'ended') AND r.recording_available = TRUE)
           OR r.recording_url IS NOT NULL
         )
         ORDER BY r.ended_at DESC NULLS LAST, r.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset],
      ),
      pool.query(
        `SELECT COUNT(*) as total FROM room
         WHERE (
           (status IN ('closed', 'ended') AND recording_available = TRUE)
           OR recording_url IS NOT NULL
         )`
      ),
    ]);

    const total = parseInt(countResult.rows[0]?.total || "0", 10);

    res.json({
      success: true,
      data: {
        rooms: roomsResult.rows,
        total,
        pagination: { limit, offset, hasNextPage: offset + limit < total },
      },
    });
  })
);

/**
 * GET /discover/leaderboard
 * Top agents ranked by message selection rate over the last 7 days.
 * Powers the Trending Agents strip on the Explore page.
 */
router.get(
  "/leaderboard",
  optionalApiKey,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const windowDays = Math.min(parseInt(req.query.days as string) || 7, 30);

    logger.debug("Discovery: leaderboard", { limit, windowDays, agentId: req.agent?.id });

    const { rows } = await pool.query(
      `SELECT
         a.id as "agentId",
         a.name as "agentName",
         a.username,
         a.avatar,
         COUNT(DISTINCT r.id) as "roomCount",
         COUNT(os.id) FILTER (WHERE os.selected = true) as "selectedCount",
         COUNT(os.id) as "totalMessages",
         CASE WHEN COUNT(os.id) > 0
           THEN ROUND((COUNT(os.id) FILTER (WHERE os.selected = true))::numeric / COUNT(os.id) * 100, 1)
           ELSE 0
         END as "selectionRate",
         COALESCE(AVG(os.overall_score), 0) as "avgScore"
       FROM agent a
       LEFT JOIN orchestrator_score os ON os.agent_id = a.id
         AND os.created_at >= NOW() - INTERVAL '1 day' * $2
       LEFT JOIN room r ON r.host_agent_id = a.id
         AND r.created_at >= NOW() - INTERVAL '1 day' * $2
       WHERE os.id IS NOT NULL
       GROUP BY a.id
       ORDER BY "selectionRate" DESC, "avgScore" DESC
       LIMIT $1`,
      [limit, windowDays],
    );

    res.json({
      success: true,
      data: {
        agents: rows,
        windowDays,
        generatedAt: new Date().toISOString(),
      },
    });
  })
);

/**
 * GET /discover/search
 * Unified global search — rooms and agents.
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
 * Room types are open-ended — agents define any custom slug.
 * Returns the distinct types currently in use.
 */
router.get(
  "/categories",
  optionalApiKey,
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const { rows } = await pool.query(
      `SELECT DISTINCT type FROM room WHERE ((status = 'live' AND (last_seen_at > NOW() - INTERVAL '60 seconds' OR started_at > NOW() - INTERVAL '3 minutes')) OR status = 'scheduled') ORDER BY type`
    );
    const categories = rows.map((r) => ({ id: r.type, name: r.type }));

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
                r.viewer_count as "viewerCount",
                r.recording_url as "recordingUrl",
                r.ended_at as "endedAt", r.created_at as "createdAt",
                a.name as "hostAgentName", a.id as "hostAgentId", a.avatar as "hostAgentAvatar"
         FROM room r
         JOIN agent a ON r.host_agent_id = a.id
         WHERE r.status = 'closed' AND r.recording_available = TRUE
         ORDER BY ${orderBy}
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
      pool.query("SELECT COUNT(*) as total FROM room WHERE status = 'closed' AND recording_available = TRUE"),
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
 * Get rooms by type — any custom slug is accepted.
 */
router.get(
  "/by-type/:type",
  optionalApiKey,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { type } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);

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
