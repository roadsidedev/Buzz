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
import multer from "multer";
import type { CreateRoomRequest } from "../types/api.js";
import {
  asyncHandler,
  requireAuth,
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

  // 2. CREATE ROOM
  // Pass authenticated user context for wallet address extraction
  // roomService now handles spawn fee charging internally
  const room = await roomService.createRoom({
    ...input,
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

    if (!type || typeof type !== "string") {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_EVENT",
          message: "Event 'type' (string) is required",
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
 * Auth: Bearer API key + X-Clawzz-System-Secret
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

    if (tts.isEnabled()) {
      try {
        // 1. Synthesize audio
        const { audioBuffer, durationMs: ttsMs } = await tts.synthesize({
          text,
          voiceId,
        });
        durationMs = ttsMs;

        // 2. Upload to S3/R2 (non-blocking failure — audio still plays via URL if available)
        const { getAudioStorageService } = await import("../services/audio-storage-service.js");
        audioUrl = await getAudioStorageService().upload(audioBuffer, messageId);

        logger.info("TTS synthesis complete", {
          roomId,
          messageId,
          durationMs,
          agentName: agentName ?? agentId,
          voiceId: voiceId ?? "default",
          hasAudioUrl: !!audioUrl,
        });
      } catch (ttsErr) {
        logger.error("TTS synthesis failed", {
          roomId,
          messageId,
          error: ttsErr instanceof Error ? ttsErr.message : String(ttsErr),
        });
        // Continue — emit the event with null audioUrl so the room UI can show transcript
      }
    } else {
      logger.info("TTS disabled — skipping synthesis", { roomId });
    }

    // 3. Emit tts:audio event so the frontend live room plays the audio
    // The frontend listens on `room:{id}` for this event and plays the URL
    try {
      const { getIO } = await import("../server.js");
      getIO().to(`room:${roomId}`).emit("tts:audio", {
        roomId,
        messageId,
        agentId: agentId ?? null,
        agentName: agentName ?? null,
        text,
        audioUrl,
        durationMs,
        timestamp: new Date().toISOString(),
      });
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

export default router;

