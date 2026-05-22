/**
 * Room Routes
 * POST /rooms/create - Create new room
 * GET /rooms/:id - Get room details
 * GET /rooms/live - Get live rooms
 * POST /rooms/:id/join - Join room as speaker
 * POST /rooms/:id/close - Close room (host only)
 */

import crypto from "crypto";
import { Router, Request, Response } from "express";
import multer from "multer";
import type { CreateRoomRequest } from "../types/api.js";
import {
  asyncHandler,
  requireApiKey,
  optionalApiKey,
  roomCreationLimiter,
} from "../middleware/index.js";
import { validate, CreateRoomRequestSchema } from "../utils/validators.js";
import { roomService, paymentService, orchestratorClient } from "../services/index.js";
import { roomRepository } from "../repositories/room-repository.js";
import { getAudioStorageService } from "../services/audio-storage-service.js";
import { notificationRepository } from "../repositories/notification-repository.js";
import { logger } from "../utils/logger.js";

// Multer config — memory storage, 200 MB limit for audio recordings
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });

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

  // Clean up extra fields that aren't in the schema (Zod strict mode would reject them)
  // These are accepted by the skill docs but not needed for the Zod validation
  delete normalized.spawn_fee_currency;
  delete normalized.max_participants;
  delete normalized.min_duration_minutes;

  if (normalized.scheduled_for !== undefined && normalized.scheduledFor === undefined) {
    normalized.scheduledFor = normalized.scheduled_for;
    delete normalized.scheduled_for;
  }

  // Normalize recording_enabled snake_case → camelCase
  if (normalized.recording_enabled !== undefined && normalized.recordingEnabled === undefined) {
    normalized.recordingEnabled = normalized.recording_enabled;
    delete normalized.recording_enabled;
  }

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

  logger.info("Creating room", {
    hostAgentId: agent.agentId,
    hostAgentName: agent.name,
    type: input.type,
    objective: input.objective?.slice(0, 50),
    spawnFee: input.spawnFee,
    recordingEnabled: input.recordingEnabled,
  });

  // 2. CREATE ROOM
  // Pass authenticated user context for wallet address extraction
  // roomService now handles spawn fee charging internally
  const room = await roomService.createRoom({
    ...input,
    scheduledFor: typeof input.scheduledFor === "string"
      ? new Date(input.scheduledFor)
      : input.scheduledFor,
    hostAgentId: agent.agentId,
    hostAgentName: agent.name,
    authenticatedUser, // JWT payload with optional walletAddress
    recordingEnabled: input.recordingEnabled !== false, // default true
  });

  logger.info("Room created successfully", {
    roomId: room.id,
    hostAgentId: agent.agentId,
    type: input.type,
    spawnFee: input.spawnFee,
    status: room.status,
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
          title: room.title || null,
          objective: room.objective,
          status: room.status,
          spawnFee: room.spawnFee,
          jamRoomUrl: room.jamRoomUrl,
          viewerCount: room.viewerCount,
          participantCount: room.participantCount,
          createdAt: room.createdAt,
          startedAt: room.startedAt,
          scheduledFor: room.scheduledFor || null,
          hostAgentId: room.hostAgentId || null,
          recordingEnabled: room.recordingEnabled,
          recordingUrl: room.recordingUrl || null,
          recordingStartedAt: room.recordingStartedAt || null,
          recordingEndedAt: room.recordingEndedAt || null,
        },
      },
    });
  })
);

/**
 * GET /rooms/:id/participants
 * Get current participants in a room
 */
router.get(
  "/:id/participants",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    // Verify room exists
    await roomService.getRoomById(id);

    const { rows } = await (await import("../config/database.js")).pool.query(
      `SELECT rp.agent_id as id, a.name, a.avatar, rp.role, rp.joined_at
       FROM room_participant rp
       LEFT JOIN agent a ON rp.agent_id = a.id
       WHERE rp.room_id = $1 AND rp.status = 'joined'
       ORDER BY rp.joined_at ASC`,
      [id]
    );

    res.json({
      success: true,
      data: {
        participants: rows.map((p) => ({
          id: p.id,
          name: p.name || "Agent",
          avatar: p.avatar || null,
          role: p.role || "speaker",
          joinedAt: p.joined_at,
        })),
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
 * POST /rooms/:id/cohost
 * Set a joined participant as co-host (host only).
 * Body: { agentId: string }
 */
router.post(
  "/:id/cohost",
  requireApiKey,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const agent = req.agent!;
    const { agentId: targetAgentId } = req.body;

    if (!targetAgentId) {
      res.status(400).json({
        success: false,
        error: {
          code: "MISSING_AGENT_ID",
          message: "agentId is required",
          statusCode: 400,
        },
      });
      return;
    }

    const room = await roomService.getRoomById(id);

    if (room.hostAgentId !== agent.agentId) {
      res.status(403).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Only the room host can set co-hosts",
          statusCode: 403,
        },
      });
      return;
    }

    const { pool } = await import("../config/database.js");

    const { rows: check } = await pool.query(
      `SELECT agent_id FROM room_participant WHERE room_id = $1 AND agent_id = $2 AND status = 'joined'`,
      [id, targetAgentId],
    );

    if (check.length === 0) {
      res.status(400).json({
        success: false,
        error: {
          code: "NOT_A_PARTICIPANT",
          message: "Target agent has not joined this room",
          statusCode: 400,
        },
      });
      return;
    }

    await pool.query(
      `UPDATE room_participant SET role = 'co_host' WHERE room_id = $1 AND agent_id = $2`,
      [id, targetAgentId],
    );

    logger.info("Co-host set", {
      roomId: id,
      hostAgentId: agent.agentId,
      cohostAgentId: targetAgentId,
    });

    res.json({
      success: true,
      data: { message: "Co-host set successfully" },
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
  optionalApiKey,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { userId, role = "speaker" } = req.body;

    // Identity resolution with spoofing prevention:
    // - Authenticated agents (API key present): agentId is ALWAYS taken from the
    //   verified token; body.userId is ignored to prevent impersonation.
    // - Unauthenticated callers (human participants): agentId comes from body.userId.
    let agentId: string | undefined;

    if (req.agent) {
      // Agent is authenticated via API key — lock identity to the verified token.
      agentId = req.agent.agentId;
      // If the caller also supplied a userId that disagrees, reject immediately.
      if (userId && userId !== agentId) {
        res.status(403).json({
          success: false,
          error: {
            code: "IDENTITY_MISMATCH",
            message: "Supplied userId does not match your authenticated identity",
            statusCode: 403,
          },
        });
        return;
      }
    } else {
      // Unauthenticated path (e.g. human listener) — accept body userId.
      agentId = userId;
    }

    if (!agentId) {
      res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "API key or userId is required",
          statusCode: 401,
        },
      });
      return;
    }

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
    // initialize audio now.
    if (room.status === "pending" && !room.jamRoomId) {
      try {
        await roomService.initializeJamRoom(id);
        logger.info("Jam auto-initialized on join", {
          roomId: id,
          agentId,
        });
      } catch (err) {
        logger.warn("Auto Jam init on join failed — room stays pending", {
          roomId: id,
          agentId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Add agent/user as participant
    await roomService.addParticipant(id, agentId, role);

    logger.info("Participant joined room", {
      roomId: id,
      agentId,
      role,
    });

    // Start room in orchestrator if it's not already started
    try {
      await orchestratorClient.startRoom(id);
    } catch (err) {
      logger.warn("Failed to start room in orchestrator", {
        roomId: id,
        agentId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    res.json({
      success: true,
      data: {
        message: "Joined room successfully",
        agentId,
      },
    });
  })
);

/**
 * POST /rooms/:id/notify
 * Subscribe to notifications for a scheduled room
 */
router.post(
  "/:id/notify",
  optionalApiKey,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    
    // Accept either authenticated agent OR human user from body
    const subscriberId = req.agent?.id || req.body.userId;
    
    if (!subscriberId) {
      res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Must provide API key or userId in body",
          statusCode: 401
        }
      });
      return;
    }

    const room = await roomService.getRoomById(id);
    
    if (room.status !== "scheduled") {
      res.status(400).json({
         success: false,
         error: {
           code: "NOT_SCHEDULED",
           message: "Room is not a scheduled room",
           statusCode: 400
         }
      });
      return;
    }
    
    await notificationRepository.addNotification(id, subscriberId);
    
    logger.info("User/Agent subscribed to room notifications", {
      roomId: id,
      subscriberId
    });

    res.json({ success: true, message: "Subscribed to notifications" });
  })
);

/**
 * POST /rooms/:id/heartbeat
 * Record host heartbeat — keeps room visible in discovery.
 *
 * The discovery feed filters by `last_seen_at > NOW() - INTERVAL '60 seconds'`.
 * The radio-runner calls this endpoint every ~30s via the room_keeper watchdog.
 *
 * Auth: Bearer API key (host only)
 */
router.post(
  "/:id/heartbeat",
  requireApiKey,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const agent = req.agent!;

    const room = await roomService.getRoomById(id);
    if (room.hostAgentId !== agent.agentId) {
      res.status(403).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Only the room host can send heartbeats",
          statusCode: 403,
        },
      });
      return;
    }

    await roomService.recordHeartbeat(id);

    res.json({
      success: true,
      data: { lastSeenAt: new Date().toISOString() },
    });
  })
);

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

/**
 * POST /rooms/:id/recording
 * Upload a recorded audio file for a room (host only).
 * Recording is stored in S3/R2 via AudioStorageService and the URL is
 * persisted on the room record. Body: multipart/form-data, field "audio".
 */
router.post(
  "/:id/recording",
  requireApiKey,
  upload.single("audio"),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const agent = req.agent!;

    const room = await roomService.getRoomById(id);

    if (room.hostAgentId !== agent.agentId) {
      res.status(403).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Only the room host can upload a recording", statusCode: 403 },
      });
      return;
    }

    if (!room.recordingEnabled) {
      res.status(400).json({
        success: false,
        error: { code: "RECORDING_DISABLED", message: "Recording is disabled for this room", statusCode: 400 },
      });
      return;
    }

    if (!req.file || !req.file.buffer) {
      res.status(400).json({
        success: false,
        error: { code: "NO_FILE", message: "No audio file provided. Use field name 'audio'.", statusCode: 400 },
      });
      return;
    }

    const storageService = getAudioStorageService();
    if (!storageService.isConfigured()) {
      res.status(503).json({
        success: false,
        error: { code: "STORAGE_UNAVAILABLE", message: "Audio storage is not configured on this server", statusCode: 503 },
      });
      return;
    }

    const contentType = req.file.mimetype || "audio/webm";
    const ext = contentType.includes("ogg") ? "ogg" : contentType.includes("mp4") ? "mp4" : "webm";
    const recordingUrl = await storageService.uploadFile(
      req.file.buffer,
      `recordings/${id}.${ext}`,
      contentType,
    );

    if (!recordingUrl) {
      res.status(500).json({
        success: false,
        error: { code: "UPLOAD_FAILED", message: "Failed to upload recording to storage", statusCode: 500 },
      });
      return;
    }

    let startedAt: Date | undefined;
    if (req.body.startedAt) {
      const d = new Date(req.body.startedAt);
      if (!isNaN(d.getTime())) startedAt = d;
    }
    let endedAt: Date = new Date();
    if (req.body.endedAt) {
      const d = new Date(req.body.endedAt);
      if (!isNaN(d.getTime())) endedAt = d;
    }

    await roomRepository.updateRecordingUrl(id, recordingUrl, startedAt, endedAt);

    logger.info("Room recording uploaded", { roomId: id, recordingUrl, agentId: agent.agentId });

    res.json({
      success: true,
      data: { recordingUrl },
    });
  })
);

/**
 * POST /rooms/:id/messages
 * Submit a message for orchestrator scoring and TTS audio generation.
 *
 * Agents use this to speak in a live room. The message is scored by the
 * orchestrator, and if selected, converted to audio via ElevenLabs TTS.
 *
 * Two body formats supported:
 *   - Simple:  { text: "Your message here" }
 *   - Legacy:  { message: { id, agent_id, text } }
 *
 * Auth: Bearer API key (required)
 * Rate limit: 100 msg/min
 */
router.post(
  "/:id/messages",
  requireApiKey,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id: roomId } = req.params;
    const agentId = req.agent!.id;

    // Support both simple and legacy body formats
    let text: string;
    const legacyMsg = (req.body as any)?.message;
    if (legacyMsg?.text) {
      text = legacyMsg.text;
    } else if (typeof req.body?.text === "string") {
      text = req.body.text;
    } else {
      res.status(400).json({
        success: false,
        error: {
          code: "MISSING_FIELDS",
          message: "Required: { text: \"Your message\" }",
          statusCode: 400,
        },
      });
      return;
    }

    // Validate text
    const trimmed = text.trim();
    if (trimmed.length < 10) {
      res.status(400).json({
        success: false,
        error: {
          code: "TEXT_TOO_SHORT",
          message: "Message must be at least 10 characters",
          length: trimmed.length,
          statusCode: 400,
        },
      });
      return;
    }
    if (trimmed.length > 2000) {
      res.status(400).json({
        success: false,
        error: {
          code: "TEXT_TOO_LONG",
          message: "Message cannot exceed 2000 characters",
          length: trimmed.length,
          statusCode: 400,
        },
      });
      return;
    }

    // Verify room exists and is live
    const room = await roomService.getRoomById(roomId);
    if (!room) {
      res.status(404).json({
        success: false,
        error: {
          code: "ROOM_NOT_FOUND",
          message: `Room ${roomId} not found`,
          statusCode: 404,
        },
      });
      return;
    }
    if (room.status !== "live") {
      res.status(400).json({
        success: false,
        error: {
          code: "ROOM_NOT_LIVE",
          message: `Room is ${room.status}, not live. Only live rooms accept messages.`,
          statusCode: 400,
        },
      });
      return;
    }

    // Auto-generate message
    const messageId = crypto.randomUUID();

    const { pool } = await import("../config/database.js");
    await pool.query(
      `INSERT INTO message (id, room_id, agent_id, text, status, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (id) DO NOTHING`,
      [messageId, roomId, agentId, trimmed, "candidate"],
    );

    // Forward to orchestrator for scoring queue
    try {
      await orchestratorClient.submitMessage(roomId, {
        id: messageId,
        agentId,
        text: trimmed,
      });
    } catch (orchErr) {
      logger.warn("Forwarded to orchestrator (will retry on next turn)", {
        roomId,
        messageId,
        error: orchErr instanceof Error ? orchErr.message : String(orchErr),
      });
    }

    logger.info("Message submitted for scoring + TTS", {
      roomId,
      messageId,
      agentId,
      textLength: trimmed.length,
    });

    res.status(201).json({
      success: true,
      data: {
        messageId,
        status: "candidate",
        text: trimmed,
        hint: "If selected, your message will be converted to audio via TTS and broadcast to all listeners.",
      },
    });
  })
);

/**
 * POST /rooms/:id/events
 * Emit a typed event into a room's event stream.
 *
 * Body: { type: string, payload: object }
 *
 * Used by the radio-runner daemon to inject MUSIC_BREAK events and
 * any future room-level events (e.g., POLL, ANNOUNCEMENT).
 *
 * Events are stored in the room_event table and can be consumed by
 * the frontend via polling GET /rooms/:id/events or a future
 * WebSocket/SSE subscription.
 */
router.post(
  "/:id/events",
  optionalApiKey,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { type, payload } = req.body;

    // Strict whitelist to prevent log-injection and event-spoofing (H6)
    const ALLOWED_EVENT_TYPES = new Set([
      "message",
      "join",
      "leave",
      "end",
      "music_break",
      "announcement",
      "poll",
      "reaction",
      "system",
    ]);

    if (!type || typeof type !== "string" || !ALLOWED_EVENT_TYPES.has(type)) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_EVENT_TYPE",
          message: `Event type must be one of: ${[...ALLOWED_EVENT_TYPES].join(", ")}`,
          statusCode: 400,
        },
      });
      return;
    }

    // Verify room exists
    const room = await roomService.getRoomById(id);
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

    // Store the event
    const { pool } = await import("../config/database.js");
    const eventId = require("crypto").randomUUID();
    await pool.query(
      `INSERT INTO room_event (id, room_id, type, payload, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT DO NOTHING`,
      [eventId, id, type, JSON.stringify(payload || {})],
    ).catch((err: Error) => {
      // If room_event table doesn't exist yet, log and continue
      // The event is still returned to the caller
      logger.warn("room_event table may not exist — event not persisted", {
        roomId: id,
        type,
        error: err.message,
      });
    });

    logger.info("Room event emitted", {
      roomId: id,
      type,
      eventId,
    });

    res.json({
      success: true,
      data: {
        eventId,
        type,
        roomId: id,
      },
    });
  })
);

/**
 * GET /rooms/:id/events
 * Retrieve recent events for a room (paginated, newest first).
 *
 * Query params:
 *   limit  — max events to return (default 20, max 100)
 *   after  — ISO timestamp, return events after this time
 */
router.get(
  "/:id/events",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const after = req.query.after as string || null;

    // Verify room exists
    await roomService.getRoomById(id);

    const { pool } = await import("../config/database.js");

    try {
      const query = after
        ? `SELECT id, type, payload, created_at FROM room_event
           WHERE room_id = $1 AND created_at > $2
           ORDER BY created_at DESC LIMIT $3`
        : `SELECT id, type, payload, created_at FROM room_event
           WHERE room_id = $1
           ORDER BY created_at DESC LIMIT $2`;

      const params = after ? [id, after, limit] : [id, limit];
      const { rows } = await pool.query(query, params);

      res.json({
        success: true,
        data: {
          events: rows.map((e: any) => ({
            id: e.id,
            type: e.type,
            payload: e.payload,
            createdAt: e.created_at,
          })),
          count: rows.length,
        },
      });
    } catch {
      // Table may not exist yet
      res.json({
        success: true,
        data: { events: [], count: 0 },
      });
    }
  })
);

/**
 * POST /rooms/:id/soundboard
 * Trigger a soundboard clip for the room.
 *
 * Host-only: verifies the requesting agent is the room host.
 * The sound is emitted as a WebSocket event to all room listeners
 * who then play it through their HTML5 audio element.
 *
 * Body: { sound_id: string }
 * Auth: Bearer API key (host only)
 */

// Whitelist of valid soundboard sound IDs — prevents arbitrary sound injection
const VALID_SOUND_IDS = new Set([
  "lofi-chill-1", "lofi-rain-1", "lofi-night-1", "lofi-study-1",
  "classic-funk-1", "classic-jazz-1", "classic-soul-1", "classic-disco-1",
  "sfx-clap-1", "sfx-boo-1", "sfx-laugh-1", "sfx-drumroll-1",
  "sfx-airhorn-1", "sfx-whoosh-1", "sfx-bell-1", "sfx-gameover-1",
]);

// Soundboard rate limiter: max 5 sounds per 10 seconds per room
const soundboardRateLimit = new Map<string, { count: number; resetAt: number }>();
function checkSoundboardRateLimit(roomId: string): boolean {
  const now = Date.now();
  const entry = soundboardRateLimit.get(roomId);
  if (!entry || now > entry.resetAt) {
    soundboardRateLimit.set(roomId, { count: 1, resetAt: now + 10_000 });
    return true;
  }
  if (entry.count >= 5) return false;
  entry.count++;
  return true;
}

router.post(
  "/:id/soundboard",
  requireApiKey,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id: roomId } = req.params;
    const { sound_id } = req.body as { sound_id?: string };

    if (!sound_id) {
      res.status(400).json({
        success: false,
        error: {
          code: "MISSING_SOUND_ID",
          message: "sound_id is required",
          statusCode: 400,
        },
      });
      return;
    }

    // Validate sound_id against whitelist
    if (!VALID_SOUND_IDS.has(sound_id)) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_SOUND_ID",
          message: `Unknown sound_id: ${sound_id}`,
          statusCode: 400,
        },
      });
      return;
    }

    // Rate limit: max 5 sounds per 10 seconds
    if (!checkSoundboardRateLimit(roomId)) {
      res.status(429).json({
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: "Too many sounds — try again in a few seconds",
          statusCode: 429,
        },
      });
      return;
    }

    // Verify room exists
    const room = await roomService.getRoomById(roomId);
    if (!room) {
      res.status(404).json({
        success: false,
        error: {
          code: "ROOM_NOT_FOUND",
          message: `Room ${roomId} not found`,
          statusCode: 404,
        },
      });
      return;
    }

    // Verify requester is the room host
    const agentId = req.agent?.id;
    if (room.hostAgentId !== agentId) {
      res.status(403).json({
        success: false,
        error: {
          code: "NOT_HOST",
          message: "Only the room host can trigger soundboard sounds",
          statusCode: 403,
        },
      });
      return;
    }

    // Emit soundboard event to all room listeners
    try {
      const { getIO } = await import("../server.js");
      const io = getIO();
      io.to(`room:${roomId}`).emit("soundboard:play", {
        roomId,
        soundId: sound_id,
        triggeredBy: agentId,
        timestamp: new Date().toISOString(),
      });

      logger.info("Soundboard sound triggered", {
        roomId,
        soundId: sound_id,
        agentId,
      });

      res.json({
        success: true,
        data: {
          soundId: sound_id,
          roomId,
        },
      });
    } catch (err) {
      logger.error("Failed to emit soundboard event", {
        roomId,
        soundId: sound_id,
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(500).json({
        success: false,
        error: {
          code: "SOUNDBOARD_ERROR",
          message: "Failed to trigger soundboard sound",
          statusCode: 500,
        },
      });
    }
  })
);

/**
 * POST /rooms/:id/process-turn
 * Trigger orchestrator turn processing for a room.
 *
 * Called by radio-runner to score candidate messages, select the winner,
 * and return the result for TTS synthesis.
 *
 * Flow:
 *   1. Verify room exists and is live
 *   2. Call orchestratorClient.processTurn(roomId)
 *   3. Return { status, selected_message_id, selected_agent_id, score, turn_number }
 *
 * Auth: Bearer API key (any authenticated agent)
 */
router.post(
  "/:id/process-turn",
  requireApiKey,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id: roomId } = req.params;

    const room = await roomService.getRoomById(roomId);
    if (!room) {
      res.status(404).json({
        success: false,
        error: {
          code: "ROOM_NOT_FOUND",
          message: `Room ${roomId} not found`,
          statusCode: 404,
        },
      });
      return;
    }

    try {
      const result = await orchestratorClient.processTurn(roomId);

      res.json({
        success: true,
        data: {
          status: result.status,
          selected_message_id: result.selected_message_id,
          selected_agent_id: result.selected_agent_id,
          score: result.score,
          turn_number: result.turn_number,
        },
      });
    } catch (err) {
      logger.error("Process turn failed", {
        roomId,
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(500).json({
        success: false,
        error: {
          code: "TURN_PROCESSING_ERROR",
          message: "Failed to process turn",
          statusCode: 500,
        },
      });
    }
  })
);

/**
 * POST /rooms/:id/tts
 * Synthesize a selected message as speech and stream it to the live room.
 *
 * Called by the radio-runner after the orchestrator selects a winning message.
 * Flow:
 *   1. Synthesize audio via ElevenLabs (or no-op if TTS disabled)
 *   2. Upload MP3 to S3/R2 (AudioStorageService)
 *   3. Emit `tts:audio` Socket.IO event to `room:{id}` so the frontend plays it
 *   4. Return { success, durationMs } to caller
 *
 * Voice selection: send `agentName` in the request body.
 *   - Contains "mira" (case-insensitive) → ELEVENLABS_VOICE_B
 *   - Otherwise → ELEVENLABS_VOICE_A (Alex / default)
 *
 * Auth: Bearer API key + X-Buzz-System-Secret
 */
router.post(
  "/:id/tts",
  requireApiKey,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id: roomId } = req.params;
    const {
      messageId,
      text,
      agentId,
      agentName,
    } = req.body as {
      messageId?: string;
      text?: string;
      agentId?: string;
      agentName?: string;
    };

    if (!messageId || !text) {
      res.status(400).json({
        success: false,
        error: {
          code: "MISSING_FIELDS",
          message: "messageId and text are required",
          statusCode: 400,
        },
      });
      return;
    }

    // Verify the room exists
    const room = await roomService.getRoomById(roomId);

    // Resolve voice: use agentName (not the UUID agentId) for matching
    const isMira = (agentName ?? "").toLowerCase().includes("mira");
    const voiceId = isMira
      ? process.env.ELEVENLABS_VOICE_B
      : process.env.ELEVENLABS_VOICE_A;

    // Lazy-load TTS service to avoid circular deps
    const { getTTSService } = await import("../services/tts-service.js");
    const tts = getTTSService();

    let durationMs = 0;
    let audioUrl: string | null = null;

    // Get Jam room ID for streaming audio to the room
    const jamRoomId = room.jamRoomId || roomId;

    let ttsProvider = "none";
    let audioBase64: string | null = null;

    if (tts.isEnabled()) {
      try {
        // Use synthesizeAndStream to generate audio (with fallback between providers)
        // Pass agentName for voice gender detection (Alex=male, Mira=female)
        const { audioBuffer, durationMs: ttsMs, provider } = await tts.synthesizeAndStream(
          jamRoomId,
          text,
          messageId,
          voiceId,
          agentName,
        );
        durationMs = ttsMs;
        ttsProvider = provider;
        audioBase64 = audioBuffer.toString("base64");

        // Also upload to S3/R2 for replay/archival
        const { getAudioStorageService } = await import("../services/audio-storage-service.js");
        audioUrl = await getAudioStorageService().upload(audioBuffer, messageId);

        logger.info("TTS synthesis complete", {
          roomId,
          jamRoomId,
          messageId,
          durationMs,
          agentName: agentName ?? agentId,
          voiceId: voiceId ?? "default",
          provider: ttsProvider,
          hasAudioUrl: !!audioUrl,
        });
      } catch (ttsErr) {
        logger.error("TTS synthesis/streaming failed", {
          roomId,
          jamRoomId,
          messageId,
          error: ttsErr instanceof Error ? ttsErr.message : String(ttsErr),
        });
        // Continue — emit the event with null audioUrl so the room UI can show transcript
      }
    } else {
      logger.info("TTS disabled — skipping synthesis", { roomId });
    }

    // 3. Emit tts:audio event so the frontend live room plays the audio
    // The frontend listens on `room:{id}` for this event and injects via WebRTCAudioBridge
    try {
      const { getIO } = await import("../server.js");
      const { emitAgentSpeakingStart, emitAgentSpeakingEnd } = await import("../services/websocket-orchestration-handlers.js");

      const io = getIO();

      // Notify agent Jam clients that this agent is speaking — others should
      // temporarily mute their microphones to prevent overlapping audio.
      if (agentId) {
        emitAgentSpeakingStart(io, roomId, agentId);
      }

      io.to(`room:${roomId}`).emit("tts:audio", {
        roomId,
        messageId,
        agentId: agentId ?? null,
        agentName: agentName ?? null,
        text,
        audioUrl,
        audioBase64,
        durationMs,
        provider: ttsProvider,
        timestamp: new Date().toISOString(),
      });

      // After audio finishes, signal agents to restore their microphones.
      if (agentId && durationMs > 0) {
        setTimeout(() => emitAgentSpeakingEnd(io, roomId), durationMs);
      }
    } catch (socketErr) {
      // Non-fatal: log and continue
      logger.warn("Failed to emit tts:audio Socket.IO event", {
        roomId,
        error: socketErr instanceof Error ? socketErr.message : String(socketErr),
      });
    }

    res.json({ success: true, durationMs });
  })
);

/**
 * POST /rooms/:id/process-turn
 * Trigger a single turn processing cycle for the room.
 *
 * Used by external cron/worker services to drive the orchestration loop
 * when the backend is deployed on serverless platforms (Vercel) where
 * setInterval-based turn management is not available.
 *
 * This endpoint:
 * 1. Fetches candidate messages from the queue
 * 2. Calls the orchestrator to score and select a winner
 * 3. If a winner is selected, triggers TTS synthesis and audio streaming
 *
 * Body: none (optional: { force: true } to skip empty queue checks)
 * Auth: Bearer API key (host only)
 */
router.post(
  "/:id/process-turn",
  requireApiKey,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id: roomId } = req.params;
    const agentId = req.agent!.id;

    // Verify room is live
    const room = await roomService.getRoomById(roomId);
    if (!room) {
      res.status(404).json({ success: false, error: { code: "ROOM_NOT_FOUND", message: `Room ${roomId} not found`, statusCode: 404 } });
      return;
    }
    if (room.status !== "live") {
      res.status(400).json({ success: false, error: { code: "ROOM_NOT_LIVE", message: `Room is ${room.status}`, statusCode: 400 } });
      return;
    }

    // Process one turn — use direct DB + scoring engine (works without Redis).
    // On serverless deploys (Vercel) the Redis-backed orchestrator state store
    // is unavailable, so we drive the turn loop against PostgreSQL directly.
    const { pool: db } = await import("../config/database.js");

    // 1. Fetch unscored candidate and queued messages from DB
    //    (queued = scored in a prior turn but never selected)
    const candidates = (await db.query(
      `SELECT id, room_id, agent_id, text, status, created_at, score
       FROM message
       WHERE room_id = $1 AND status IN ('candidate', 'queued')
       ORDER BY created_at ASC LIMIT 5`,
      [roomId],
    )).rows;

    if (candidates.length === 0) {
      res.json({ success: true, data: { processed: false, reason: "No candidate messages in queue" } });
      return;
    }

    // 2. Score candidates (use orchestrator scoring engine if available)
    let selectedIdx = 0;
    let selectedScore = 50;
    try {
      const { ScoringEngine } = await import("../services/scoring/scoring-engine.js");
      const engine = new ScoringEngine();
      const scoringMsgs = candidates.map(m => ({
        id: m.id,
        roomId: m.room_id,
        agentId: m.agent_id,
        text: m.text,
        status: m.status,
        createdAt: new Date(m.created_at),
      }));
      const context = {
        roomId,
        roomType: room.type,
        roomObjective: room.objective || "",
        transcriptHistory: [] as Array<{ turn: number; agentId: string; text: string; score: number; timestamp: string }>,
        participationHistory: {} as Record<string, number>,
        weights: { relevance: 0.35, novelty: 0.25, coherence: 0.20, actionability: 0.15, engagement: 0.05 },
      };
      const scores = await engine.scoreBatch(scoringMsgs, context as any);
      let maxScore = -1;
      scores.forEach((s, i) => { if (s.overallScore > maxScore) { maxScore = s.overallScore; selectedIdx = i; selectedScore = s.overallScore; } });
    } catch (scoreErr) {
      logger.warn("LLM scoring unavailable, using fallback (first message)", { roomId, error: scoreErr instanceof Error ? scoreErr.message : String(scoreErr) });
      selectedIdx = 0;
      selectedScore = 50;
    }

    const winner = candidates[selectedIdx];
    const turnNumber = (room.turnCount || 0) + 1;

    // 3. Mark winner as SELECTED, leave others as CANDIDATE for future turns
    await db.query(
      `UPDATE message SET status = 'selected', score = $1, selected_at = NOW() WHERE id = $2`,
      [selectedScore, winner.id],
    );
    // Score non-winners with a slight penalty so turn selector has signal
    for (let i = 0; i < candidates.length; i++) {
      if (i !== selectedIdx) {
        await db.query(
          `UPDATE message SET score = $1 WHERE id = $2 AND score IS NULL`,
          [Math.max(0, selectedScore - 10), candidates[i].id],
        );
      }
    }

    // 4. Update room turn count
    await db.query(
      `UPDATE room SET turn_count = $1, last_turn_at = NOW() WHERE id = $2`,
      [turnNumber, roomId],
    );

    logger.info("Turn processed via DB-direct path", {
      roomId, turnNumber, messageId: winner.id, agentId: winner.agent_id, score: selectedScore,
    });

    // 5. Trigger TTS synthesis + streaming
    const { messageRepository } = await import("../repositories/message-repository.js");
    const winningMessage = await messageRepository.getById(winner.id);
    if (winningMessage) {
      const { turnManagementService } = await import("../services/turn-management-service.js");
      await turnManagementService.synthesizeAndStream(room, winningMessage, { score: selectedScore });
    }

    res.json({
      success: true,
      data: {
        processed: true,
        turnNumber,
        messageId: winner.id,
        agentId: winner.agent_id,
        score: selectedScore,
        text: winner.text,
      },
    });
  })
);

/**
 * POST /rooms/:id/redirect
 * Notify all Socket.IO clients connected to this room that it has been
 * superseded by a new room (e.g. after a radio-runner room respawn).
 * Emits `room:redirect` to every socket in `room:{id}` so the frontend
 * can navigate to the new room URL automatically.
 *
 * Body: { newRoomId: string }
 * Auth: Bearer API key
 */
router.post(
  "/:id/redirect",
  requireApiKey,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id: roomId } = req.params;
    const { newRoomId } = req.body as { newRoomId?: string };

    if (!newRoomId || typeof newRoomId !== "string") {
      res.status(400).json({
        success: false,
        error: { code: "MISSING_NEW_ROOM_ID", message: "newRoomId is required" },
      });
      return;
    }

    try {
      const { getIO } = await import("../server.js");
      const io = getIO();
      io.to(`room:${roomId}`).emit("room:redirect", { newRoomId });
      logger.info("Emitted room:redirect", { oldRoomId: roomId, newRoomId });
    } catch (err) {
      logger.warn("Failed to emit room:redirect", {
        roomId,
        newRoomId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    res.json({ success: true });
  })
);

export default router;

