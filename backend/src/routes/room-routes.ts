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
 *
 * Process:
 * 1. Validate authenticated user from JWT (requireAuth middleware)
 * 2. Validate room creation request
 * 3. Create room with ERC-8004 verification and Jam room setup
 * 4. Charge spawn fee via x402 (payment handling now in roomService)
 * 5. Return room details to client
 */
router.post(
  "/create",
  requireAuth,
  roomCreationLimiter,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const agent = req.agent!;
    const authenticatedUser = (req as any).user; // From validateJWT middleware

    // 1. VALIDATE REQUEST
    const input = validate(CreateRoomRequestSchema, req.body);

    // 2. CREATE ROOM
    // Pass authenticated user context for wallet address extraction
    // roomService now handles spawn fee charging internally
    const room = await roomService.createRoom({
      ...input,
      hostAgentId: agent.agentId,
      hostAgentName: agent.name,
      authenticatedUser, // JWT payload with optional walletAddress
    });

    logger.info("Room created successfully", {
      roomId: room.id,
      hostAgentId: agent.agentId,
      type: input.type,
      spawnFee: input.spawnFee,
    });

    res.status(201).json({
      success: true,
      data: {
        room: {
          id: room.id,
          type: room.type,
          objective: room.objective,
          status: room.status,
          jamRoomUrl: room.jamRoomUrl,
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
          jamRoomUrl: room.jamRoomUrl,
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
/**
 * POST /rooms/:id/close
 * Close room and trigger revenue distribution (host only)
 *
 * Process:
 * 1. Verify authenticated user is room host
 * 2. Call roomService.closeRoom() which:
 *    - Updates room status to completed
 *    - Closes Jam audio room
 *    - Distributes revenue to host and participants
 * 3. Return success response
 */
router.post(
  "/:id/close",
  requireAuth,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const agent = req.agent!;

    // 1. VERIFY HOST
    const room = await roomService.getRoomById(id);

    if (room.hostAgentId !== agent.agentId) {
      logger.warn("Unauthorized room close attempt", {
        roomId: id,
        requestingAgent: agent.agentId,
        hostAgent: room.hostAgentId,
      });
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

    // 2. CLOSE ROOM AND DISTRIBUTE REVENUE
    // roomService.closeRoom() now handles:
    // - Status update
    // - Jam room closure
    // - Revenue distribution to host and participants
    await roomService.closeRoom(id);

    logger.info("Room closed and revenue distributed", {
      roomId: id,
      hostAgentId: agent.agentId,
    });

    res.json({
      success: true,
      data: {
        message: "Room closed successfully and revenue distributed",
      },
    });
  })
);

export default router;
