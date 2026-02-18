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
import { ValidationError } from "../utils/errors.js";

const router = Router();

/**
 * GET /discover/live-now
 * Get currently live rooms, sorted by viewer count
 *
 * Query params:
 *   - limit?: number (default 20, max 100)
 *   - offset?: number (default 0)
 *   - type?: string — debate, coding, research, trading, simulation
 */
router.get(
  "/live-now",
  optionalAuth,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const type = (req.query.type as string) || undefined;

    // Validate room type if provided
    if (type) {
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
    }

    // Fetch rooms and total count
    const [rooms, total] = await Promise.all([
      roomService.getLiveRooms(limit, offset, type),
      roomService.getLiveRoomCount(type),
    ]);

    logger.debug("Discovery: live-now", {
      limit,
      offset,
      type,
      count: rooms.length,
      total,
      agentId: req.agent?.agentId,
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
  })
);

/**
 * GET /discover/trending
 * Get trending rooms from specified timeframe
 *
 * Query params:
 *   - limit?: number (default 10, max 50)
 *   - hours?: number (default 24) — Timeframe in hours for trending calculation
 *   - type?: string — debate, coding, research, trading, simulation
 *
 * Response: 200 OK
 *   {
 *     success: true,
 *     data: {
 *       rooms: Room[],
 *       timeframe: "24h",
 *       filter?: { type }
 *     }
 *   }
 */
router.get(
  "/trending",
  optionalAuth,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const hours = Math.max(parseInt(req.query.hours as string) || 24, 1);
    const type = (req.query.type as string) || undefined;

    // Validate room type if provided
    if (type) {
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
    }

    const rooms = await roomService.getTrendingRooms(hours, limit, type);

    logger.debug("Discovery: trending", {
      limit,
      hours,
      type,
      count: rooms.length,
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
        timeframe: `${hours}h`,
        filter: type ? { type } : undefined,
      },
    });
  })
);

/**
 * GET /discover/by-type/:type
 * Get rooms by type (debate, coding, research, etc.)
 *
 * Path params:
 *   - type: string (required) — debate, coding, research, trading, simulation
 *
 * Query params:
 *   - limit?: number (default 20, max 100)
 *   - offset?: number (default 0)
 *
 * Response: 200 OK
 *   {
 *     success: true,
 *     data: {
 *       type: string,
 *       rooms: Room[],
 *       pagination: { total, limit, offset, page, pages, hasNextPage }
 *     }
 *   }
 */
router.get(
  "/by-type/:type",
  optionalAuth,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { type } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    // Validate room type
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

    // Fetch rooms filtered by type and total count
    const [rooms, total] = await Promise.all([
      roomService.getLiveRooms(limit, offset, type),
      roomService.getLiveRoomCount(type),
    ]);

    logger.debug("Discovery: by-type", {
      type,
      limit,
      offset,
      count: rooms.length,
      total,
      agentId: req.agent?.agentId,
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
