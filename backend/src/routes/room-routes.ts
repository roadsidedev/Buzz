/**
 * Room Routes
 * POST /rooms/create - Create new room
 * GET /rooms/:id - Get room details
 * GET /rooms/live - Get live rooms
 * POST /rooms/:id/join - Join room as speaker
 * POST /rooms/:id/close - Close room (host only)
 */

import { Router, Request, Response } from "express";
import type { CreateRoomRequest } from "../types/api.js";
import {
  asyncHandler,
  requireAuth,
  roomCreationLimiter,
} from "../middleware/index.js";
import { validate, CreateRoomRequestSchema } from "../utils/validators.js";
import { roomService, paymentService } from "../services/index.js";
import { logger } from "../utils/logger.js";

const router = Router();

/**
 * POST /rooms/create
 * Create a new room (requires authentication)
 */
router.post(
  "/create",
  requireAuth,
  roomCreationLimiter,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const agent = req.agent!;

    // Validate request
    const input = validate(CreateRoomRequestSchema, req.body);

    // Create room
    const room = await roomService.createRoom({
      ...input,
      hostAgentId: agent.agentId,
      hostAgentName: agent.name,
    });

    // Charge spawn fee
    try {
      await paymentService.chargeSpawnFee(
        agent.agentId,
        room.id,
        input.spawnFee,
        agent.erc8004Address
      );
    } catch (error) {
      logger.error("Spawn fee charge failed", error);
      res.status(402).json({
        success: false,
        error: {
          code: "PAYMENT_FAILED",
          message: "Failed to process spawn fee",
          statusCode: 402,
        },
      });
      return;
    }

    res.status(201).json({
      success: true,
      data: {
        room: {
          id: room.id,
          type: room.type,
          objective: room.objective,
          status: room.status,
          createdAt: room.createdAt,
        },
      },
    });
  })
);

/**
 * GET /rooms/:id
 * Get room details
 */
router.get(
  "/:id",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const room = await roomService.getRoomById(id);

    res.json({
      success: true,
      data: {
        room: {
          id: room.id,
          type: room.type,
          objective: room.objective,
          status: room.status,
          spawnFee: room.spawnFee,
          viewerCount: room.viewerCount,
          participantCount: room.participantCount,
          createdAt: room.createdAt,
          startedAt: room.startedAt,
        },
      },
    });
  })
);

/**
 * GET /rooms/live
 * Get currently live rooms (paginated)
 */
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const rooms = await roomService.getLiveRooms(limit, offset);

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
        total: rooms.length, // TODO: Get actual total from database
        page: Math.floor(offset / limit) + 1,
        pageSize: limit,
      },
    });
  })
);

/**
 * POST /rooms/:id/join
 * Join room as speaker (requires authentication)
 */
router.post(
  "/:id/join",
  requireAuth,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const agent = req.agent!;

    const room = await roomService.getRoomById(id);

    if (room.status === "completed" || room.status === "cancelled") {
      res.status(400).json({
        success: false,
        error: {
          code: "ROOM_CLOSED",
          message: "This room is no longer active",
          statusCode: 400,
        },
      });
      return;
    }

    // Add agent as participant
    await roomService.addParticipant(id, agent.agentId);

    logger.info("Agent joined room", {
      roomId: id,
      agentId: agent.agentId,
    });

    res.json({
      success: true,
      data: {
        message: "Joined room successfully",
      },
    });
  })
);

/**
 * POST /rooms/:id/close
 * Close room (host only)
 */
router.post(
  "/:id/close",
  requireAuth,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const agent = req.agent!;

    const room = await roomService.getRoomById(id);

    // Verify host
    if (room.hostAgentId !== agent.agentId) {
      res.status(403).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Only room host can close the room",
          statusCode: 403,
        },
      });
      return;
    }

    await roomService.closeRoom(id);

    logger.info("Room closed", { roomId: id });

    res.json({
      success: true,
      data: {
        message: "Room closed successfully",
      },
    });
  })
);

export default router;
