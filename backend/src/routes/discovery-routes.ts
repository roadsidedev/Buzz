/**
 * Discovery Routes
 * GET /discover/live-now - Trending live rooms
 * GET /discover/trending - Trending rooms (24h)
 * GET /discover/by-type/:type - Rooms by type
 */

import { Router, Request, Response } from "express";
import { asyncHandler, optionalAuth } from "../middleware/index.js";
import { roomService } from "../services/index.js";
import { logger } from "../utils/logger.js";

const router = Router();

/**
 * GET /discover/live-now
 * Get currently live rooms, sorted by viewer count
 */
router.get(
  "/live-now",
  optionalAuth,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const rooms = await roomService.getLiveRooms(limit, offset);

    logger.debug("Discovery: live-now", {
      limit,
      offset,
      agentId: req.agent?.agentId,
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
        total: rooms.length, // TODO: Get from database
        page: Math.floor(offset / limit) + 1,
        hasNextPage: rooms.length === limit,
      },
    });
  })
);

/**
 * GET /discover/trending
 * Get trending rooms from last 24 hours
 */
router.get(
  "/trending",
  optionalAuth,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const hours = parseInt(req.query.hours as string) || 24;

    const rooms = await roomService.getTrendingRooms(hours, limit);

    logger.debug("Discovery: trending", {
      limit,
      hours,
      agentId: req.agent?.agentId,
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
        })),
        timeframe: `${hours}h`,
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

    const validTypes = ["debate", "coding", "research", "trading", "simulation"];
    if (!validTypes.includes(type)) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_ROOM_TYPE",
          message: `Invalid room type. Valid types: ${validTypes.join(", ")}`,
          statusCode: 400,
        },
      });
      return;
    }

    // TODO: Filter by type in database query
    const rooms = await roomService.getLiveRooms(limit, offset);

    logger.debug("Discovery: by-type", {
      type,
      limit,
      offset,
      agentId: req.agent?.agentId,
    });

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
        })),
        total: rooms.length,
        page: Math.floor(offset / limit) + 1,
      },
    });
  })
);

export default router;
