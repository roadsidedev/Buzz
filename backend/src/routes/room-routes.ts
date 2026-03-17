// @ts-nocheck
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
  requireApiKey,
  roomCreationLimiter,
} from "../middleware/index.js";
import { validate, CreateRoomRequestSchema } from "../utils/validators.js";
import { roomService, paymentService, orchestratorClient } from "../services/index.js";
import { logger } from "../utils/logger.js";

const router = Router();

/**
 * Normalize room creation request body from agent-friendly snake_case
 * to our internal camelCase schema.
 *
 * Agents send (per OpenClaw skill docs):
 *   { type, title, objective, max_participants, spawn_fee_amount, spawn_fee_currency }
 *
 * Backend expects (Zod schema):
 *   { type, objective, spawnFee (cents integer), invitedAgentIds }
 */
function normalizeRoomRequest(body: Record<string, unknown>): Record<string, unknown> {
  const normalized = { ...body };

  // Map spawn_fee_amount (dollars as decimal) → spawnFee (cents as integer)
  if (normalized.spawn_fee_amount !== undefined && normalized.spawnFee === undefined) {
    const amount = Number(normalized.spawn_fee_amount);
    if (!isNaN(amount)) {
      normalized.spawnFee = Math.round(amount * 100);
    }
    delete normalized.spawn_fee_amount;
  }

  // If spawnFee is missing entirely, provide a sensible default ($2.50 = 250 cents)
  if (normalized.spawnFee === undefined) {
    normalized.spawnFee = 250;
  }

  // Map title → objective if objective is missing (agents often send title as the key description)
  if (normalized.objective === undefined && normalized.title !== undefined) {
    normalized.objective = normalized.title;
  }

  // Clean up extra fields that aren't in the schema (Zod strict mode would reject them)
  // These are accepted by the skill docs but not needed for the Zod validation
  delete normalized.spawn_fee_currency;
  delete normalized.max_participants;
  delete normalized.min_duration_minutes;
  delete normalized.title;

  return normalized;
}

/**
 * Shared room creation handler used by both POST / and POST /create
 */
async function handleCreateRoom(req: Request, res: Response): Promise<void> {
  const agent = req.agent!;
  const authenticatedUser = undefined; // No JWT for API Key auth

  // 1. NORMALIZE & VALIDATE REQUEST
  const normalizedBody = normalizeRoomRequest(req.body);
  const input = validate(CreateRoomRequestSchema, normalizedBody);

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

  // Register room with Python orchestrator
  try {
    await orchestratorClient.registerRoom(room);
  } catch (err) {
    logger.error("Failed to register room with orchestrator", {
      roomId: room.id,
      error: err instanceof Error ? err.message : String(err),
    });
    // Continue anyway, room was created in DB
  }

  const audioReady = !!room.jamRoomUrl;

  res.status(201).json({
    success: true,
    data: {
      room: {
        id: room.id,
        type: room.type,
        objective: room.objective,
        status: room.status,
        jamRoomUrl: room.jamRoomUrl || null,
        audioReady,
        createdAt: room.createdAt,
      },
      ...(audioReady
        ? {}
        : {
            notice:
              "Room created successfully. Audio (Jam) service is temporarily unavailable. " +
              `Call POST /api/v1/rooms/${room.id}/jam to initialize audio when ready.`,
          }),
    },
  });
}

/**
 * POST /rooms
 * Create a new room at the root path (agent-friendly endpoint)
 * This is the primary endpoint documented in OpenClaw skill.md
 */
router.post(
  "/",
  requireApiKey,
  roomCreationLimiter,
  asyncHandler(handleCreateRoom)
);

/**
 * POST /rooms/create
 * Create a new room (legacy/alternative endpoint)
 * Kept for backwards compatibility
 */
router.post(
  "/create",
  requireApiKey,
  roomCreationLimiter,
  asyncHandler(handleCreateRoom)
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
 * POST /rooms/:id
 * Pantry-compatible room initialization endpoint.
 *
 * The Jam service V2 calls POST ${PANTRY_URL}/api/v1/rooms/:id to create a
 * Jam audio room. When PANTRY_URL is configured to point at this backend
 * (common in single-service Railway deployments where no separate pantry
 * process is running), this route intercepts that call and responds with a
 * pantry-compatible payload so the Jam service initializes successfully.
 *
 * Flow:
 *  1. Jam service sends a SSR-signed payload (body.Certified = base64 JSON).
 *  2. This route decodes the payload to recover { id, name, ... }.
 *  3. Verifies the room exists in the database (lightweight security check).
 *  4. Returns the decoded payload augmented with createdAt, matching the
 *     JamRoomV2 interface expected by jam-service-v2.ts.
 *
 * No agent API-key auth is required here because this is an internal
 * service-to-service call using SSR (Ed25519) signed payloads.
 */
router.post(
  "/:id",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    // Verify the room exists in the database (security guard).
    const room = await roomService.getRoomById(id).catch(() => null);
    if (!room) {
      res.status(404).json({
        success: false,
        error: {
          code: "ROOM_NOT_FOUND",
          message: `Room ${id} not found`,
          statusCode: 404,
        },
      });
      return;
    }

    // Decode the SSR signed payload.  The Jam service sends:
    //   { Certified: "<base64 JSON>", signatures: [...] }
    // The Certified field decodes to the original payload:
    //   { id, name, description, stageOnly, sfu, creator }
    let payload: Record<string, unknown> = req.body || {};
    if (payload.Certified && typeof payload.Certified === "string") {
      try {
        payload = JSON.parse(
          Buffer.from(payload.Certified, "base64").toString("utf-8"),
        );
      } catch {
        // Fall through — return raw body augmented with id/createdAt below.
      }
    }

    // Return a pantry-compatible JamRoomV2 response.
    res.json({
      ...payload,
      id,
      sfuEnabled: payload.sfu ?? false,
      createdAt: room.createdAt ?? new Date().toISOString(),
    });
  })
);

/**
 * POST /rooms/:id/jam
 * Initialize (or re-initialize) the Jam audio room for an existing room.
 *
 * Used when room creation succeeded but the Jam service was unavailable at
 * that time (room.status === "pending", room.jamRoomUrl === null).
 * Idempotent: safe to call even if Jam is already initialized.
 *
 * Only the room host may call this endpoint.
 */
router.post(
  "/:id/jam",
  requireApiKey,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const agent = req.agent!;

    // Only the host may initialize audio for the room
    const room = await roomService.getRoomById(id);
    if (room.hostAgentId !== agent.agentId) {
      res.status(403).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Only the room host can initialize audio",
          statusCode: 403,
        },
      });
      return;
    }

    const updatedRoom = await roomService.initializeJamRoom(id);

    logger.info("Jam audio initialized via API", {
      roomId: id,
      agentId: agent.agentId,
      jamRoomId: updatedRoom.jamRoomId,
    });

    res.json({
      success: true,
      data: {
        room: {
          id: updatedRoom.id,
          type: updatedRoom.type,
          objective: updatedRoom.objective,
          status: updatedRoom.status,
          jamRoomUrl: updatedRoom.jamRoomUrl,
          audioReady: !!updatedRoom.jamRoomUrl,
          createdAt: updatedRoom.createdAt,
        },
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
  requireApiKey,
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

    // If room is pending (Jam was unavailable at creation), attempt to
    // initialize audio now.  initializeJamRoom() is idempotent — if Jam
    // is already set up it returns immediately.
    if (room.status === "pending" && !room.jamRoomId) {
      try {
        await roomService.initializeJamRoom(id);
        logger.info("Jam auto-initialized on agent join", {
          roomId: id,
          agentId: agent.agentId,
        });
      } catch (err) {
        // Jam still unavailable — let the agent join anyway.
        // The room stays pending; audio can be retried later.
        logger.warn("Auto Jam init on join failed — room stays pending", {
          roomId: id,
          agentId: agent.agentId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Add agent as participant
    await roomService.addParticipant(id, agent.agentId);

    logger.info("Agent joined room", {
      roomId: id,
      agentId: agent.agentId,
    });

    // Start room in orchestrator if it's not already started
    // (Orchestrator handles idempotency)
    try {
      await orchestratorClient.startRoom(id);
    } catch (err) {
      logger.warn("Failed to start room in orchestrator", {
        roomId: id,
        error: err instanceof Error ? err.message : String(err),
      });
    }

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
  requireApiKey,
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
