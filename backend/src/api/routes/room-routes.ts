/**
 * Room Routes
 *
 * Endpoints for room creation, management, and orchestration:
 * - POST /api/rooms - Create new room
 * - POST /api/rooms/:id/messages - Submit message
 * - GET /api/rooms/:id/messages - Get messages
 * - GET /api/rooms/:id/turn-status - Get current turn
 * - POST /api/rooms/:id/close - Close room
 *
 * Part of Day 7: Orchestrator Integration
 */

import { Router, Request, Response } from "express";
import type { RoomMessage } from "@common/types/index";
import { RoomStatus, MessageStatus } from "@common/types/index";
import { roomRepository, messageRepository } from "../../repositories/index.js";
import { turnManagementService } from "../../services/turn-management-service.js";
import { messageService } from "../../services/message-service.js";
import { outputContractService } from "../../services/output-contract-service.js";
import { requireApiKey } from "../../middleware/api-key-auth.js";
import { ValidationError, NotFoundError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";

const router = Router();

// ===================================================================
// SUBMIT MESSAGE ENDPOINT
// ===================================================================

/**
 * POST /api/rooms/:id/messages
 *
 * Submit a message to a room as an agent
 *
 * Auth: Required (JWT with agentId)
 * Body: { text: string }
 * Returns: { message: RoomMessage }
 * Status: 201 Created | 400 Validation | 404 Not Found | 500 Error
 */
router.post("/api/rooms/:id/messages", async (req: Request, res: Response) => {
  try {
    const roomId = req.params.id;
    const { text } = req.body as { text?: string };

    // Extract agent ID from authenticated user (JWT via validateJWT middleware)
    const agentId = (req as any).user?.agentId;

    if (!agentId) {
      logger.warn("Missing agent ID in message submission", {
        roomId,
        path: req.path,
      });
      return res.status(401).json({
        success: false,
        error: {
          code: "MISSING_AUTH",
          message: "Authentication required to submit messages",
          statusCode: 401,
        },
      });
    }

    // 1. VALIDATE INPUT
    if (!text || typeof text !== "string") {
      return res.status(400).json({
        error: "Message text is required and must be a string",
        code: "INVALID_TEXT",
      });
    }

    // 2. SUBMIT MESSAGE
    const message = await turnManagementService.submitMessage(
      roomId,
      agentId,
      text,
    );

    logger.info("Message submitted via API", {
      messageId: message.id,
      roomId,
      agentId,
    });

    return res.status(201).json({
      success: true,
      message,
    });
  } catch (err) {
    if (err instanceof ValidationError) {
      logger.warn("Message validation failed", {
        roomId: req.params.id,
        error: err.message,
      });
      return res.status(400).json({
        error: err.message,
        context: (err as any).context,
      });
    }

    if (err instanceof NotFoundError) {
      return res.status(404).json({
        error: "Room not found",
        code: "ROOM_NOT_FOUND",
      });
    }

    logger.error("Message submission failed", {
      roomId: req.params.id,
      error: err instanceof Error ? err.message : String(err),
    });

    return res.status(500).json({
      error: "Failed to submit message",
      code: "SUBMISSION_FAILED",
    });
  }
});

// ===================================================================
// GET MESSAGES ENDPOINT
// ===================================================================

/**
 * GET /api/rooms/:id/messages
 *
 * Get messages in a room
 *
 * Query Params:
 *   - status: 'candidate' | 'selected' | 'played' | 'all' (default: all)
 *   - limit: number (default: 50)
 *   - offset: number (default: 0)
 *
 * Returns: { messages: RoomMessage[], total: number }
 * Status: 200 OK | 404 Not Found | 500 Error
 */
router.get("/api/rooms/:id/messages", async (req: Request, res: Response) => {
  try {
    const roomId = req.params.id;
    const status = (req.query.status as string) || "all";
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
    const offset = parseInt(req.query.offset as string) || 0;

    // 1. VERIFY ROOM EXISTS
    const room = await roomRepository.getById(roomId);
    if (!room) {
      return res.status(404).json({
        error: "Room not found",
        code: "ROOM_NOT_FOUND",
      });
    }

    // 2. GET MESSAGES
    let messages: RoomMessage[];

    if (status === "all") {
      messages = await messageRepository.getByRoom(roomId);
    } else {
      messages = await messageRepository.getByRoomAndStatus(
        roomId,
        status as any,
      );
    }

    // 3. APPLY PAGINATION
    const total = messages.length;
    const paginated = messages.slice(offset, offset + limit);

    logger.debug("Messages retrieved", {
      roomId,
      status,
      total,
      returned: paginated.length,
    });

    return res.status(200).json({
      success: true,
      messages: paginated,
      total,
      limit,
      offset,
    });
  } catch (err) {
    logger.error("Failed to retrieve messages", {
      roomId: req.params.id,
      error: err instanceof Error ? err.message : String(err),
    });

    return res.status(500).json({
      error: "Failed to retrieve messages",
      code: "RETRIEVAL_FAILED",
    });
  }
});

// ===================================================================
// GET TURN STATUS ENDPOINT
// ===================================================================

/**
 * GET /api/rooms/:id/turn-status
 *
 * Get current turn status for a room
 *
 * Returns: {
 *   roomId: string
 *   status: 'waiting' | 'in_progress' | 'complete' | 'timeout'
 *   currentTurn: number
 *   candidateCount: number
 *   nextTurnAt: Date
 * }
 * Status: 200 OK | 404 Not Found | 500 Error
 */
router.get(
  "/api/rooms/:id/turn-status",
  async (req: Request, res: Response) => {
    try {
      const roomId = req.params.id;

      // 1. GET TURN STATUS
      const turnStatus = await turnManagementService.getTurnStatus(roomId);

      logger.debug("Turn status retrieved", {
        roomId,
        turn: turnStatus.currentTurn,
        candidates: turnStatus.candidateCount,
      });

      return res.status(200).json({
        success: true,
        data: turnStatus,
      });
    } catch (err) {
      if (err instanceof NotFoundError) {
        return res.status(404).json({
          error: "Room not found",
          code: "ROOM_NOT_FOUND",
        });
      }

      logger.error("Failed to get turn status", {
        roomId: req.params.id,
        error: err instanceof Error ? err.message : String(err),
      });

      return res.status(500).json({
        error: "Failed to get turn status",
        code: "STATUS_FAILED",
      });
    }
  },
);

// ===================================================================
// GET COMPLETION STATUS ENDPOINT
// ===================================================================

/**
 * GET /api/rooms/:id/completion
 *
 * Check if room meets output contract
 *
 * Returns: {
 *   roomId: string
 *   completionPercentage: number (0-100)
 *   completionLevel: 'minimum' | 'standard' | 'exceptional'
 *   minimumMet: boolean
 *   standardMet: boolean
 *   exceptionalMet: boolean
 *   suggestedAction: 'continue' | 'close'
 *   failedRequirements: string[]
 * }
 * Status: 200 OK | 404 Not Found | 500 Error
 */
router.get("/api/rooms/:id/completion", async (req: Request, res: Response) => {
  try {
    const roomId = req.params.id;

    // 1. CHECK COMPLETION
    const status = await outputContractService.checkCompletion(roomId);

    logger.info("Completion checked", {
      roomId,
      completionLevel: status.completionLevel,
      percentage: status.completionPercentage,
    });

    return res.status(200).json({
      success: true,
      data: status,
    });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return res.status(404).json({
        error: "Room not found",
        code: "ROOM_NOT_FOUND",
      });
    }

    logger.error("Failed to check completion", {
      roomId: req.params.id,
      error: err instanceof Error ? err.message : String(err),
    });

    return res.status(500).json({
      error: "Failed to check completion",
      code: "COMPLETION_CHECK_FAILED",
    });
  }
});

// ===================================================================
// CLOSE ROOM ENDPOINT
// ===================================================================

/**
 * POST /api/rooms/:id/close
 *
 * Close a room (manually or after completion)
 *
 * Body: { reason?: string }
 *
 * Returns: { room: Room, reason: string }
 * Status: 200 OK | 400 Validation | 404 Not Found | 500 Error
 */
router.post("/api/rooms/:id/close", async (req: Request, res: Response) => {
  try {
    const roomId = req.params.id;
    const { reason = "manual_close" } = req.body as { reason?: string };

    // 1. VERIFY ROOM EXISTS
    const room = await roomRepository.getById(roomId);
    if (!room) {
      return res.status(404).json({
        error: "Room not found",
        code: "ROOM_NOT_FOUND",
      });
    }

    // 2. CHECK IF ALREADY CLOSED
    if (room.status === "completed" || room.status === "cancelled") {
      return res.status(400).json({
        error: `Room is already ${room.status}`,
        code: "ROOM_ALREADY_CLOSED",
      });
    }

    // 3. STOP TURN MANAGEMENT
    turnManagementService.stopTurnManagement(roomId);

    // 4. UPDATE ROOM STATUS
    await roomRepository.updateStatus(roomId, RoomStatus.COMPLETED);

    logger.info("Room closed", {
      roomId,
      reason,
      previousStatus: room.status,
      newStatus: "completed",
    });

    // 5. TODO: Trigger payment distribution (Day 8)
    // await paymentService.distributeRevenue(roomId);

    const updatedRoom = await roomRepository.getById(roomId);

    return res.status(200).json({
      success: true,
      room: updatedRoom,
      reason,
    });
  } catch (err) {
    logger.error("Failed to close room", {
      roomId: req.params.id,
      error: err instanceof Error ? err.message : String(err),
    });

    return res.status(500).json({
      error: "Failed to close room",
      code: "CLOSE_FAILED",
    });
  }
});

// ===================================================================
// START ORCHESTRATION ENDPOINT
// ===================================================================

/**
 * POST /api/rooms/:id/start-orchestration
 *
 * Start turn management for a room (internal endpoint)
 *
 * Returns: { success: boolean, message: string }
 * Status: 200 OK | 400 Validation | 404 Not Found | 500 Error
 */
router.post(
  "/api/rooms/:id/start-orchestration",
  async (req: Request, res: Response) => {
    try {
      const roomId = req.params.id;

      // 1. START TURN MANAGEMENT
      await turnManagementService.startTurnManagement(roomId);

      logger.info("Turn management started", { roomId });

      return res.status(200).json({
        success: true,
        message: "Turn management started",
      });
    } catch (err) {
      if (err instanceof ValidationError) {
        return res.status(400).json({
          error: err.message,
          context: (err as any).context,
        });
      }

      if (err instanceof NotFoundError) {
        return res.status(404).json({
          error: "Room not found",
          code: "ROOM_NOT_FOUND",
        });
      }

      logger.error("Failed to start orchestration", {
        roomId: req.params.id,
        error: err instanceof Error ? err.message : String(err),
      });

      return res.status(500).json({
        error: "Failed to start orchestration",
        code: "START_FAILED",
      });
    }
  },
);

// ===================================================================
// TRIGGER TTS ENDPOINT (For Orchestrator / Radio Runner)
// ===================================================================

/**
 * POST /api/rooms/:id/tts
 *
 * Trigger TTS synthesis and streaming for a selected message.
 *
 * Auth: Required (API Key)
 * Body: { messageId: string, text: string, agentId?: string }
 *
 * Returns: { durationMs: number }
 */
router.post("/api/rooms/:id/tts", requireApiKey, async (req: Request, res: Response) => {
  try {
    const roomId = req.params.id;
    const { messageId, text, agentId } = req.body as {
      messageId: string;
      text: string;
      agentId?: string;
    };

    if (!messageId || !text) {
      return res.status(400).json({ error: "messageId and text required" });
    }

    const room = await roomRepository.getById(roomId);
    if (!room || !room.jamRoomId) {
      return res.status(404).json({ error: "Room or jamRoomId not found" });
    }

    const { getTTSService } = await import("../../services/tts-service.js");
    const tts = getTTSService();

    if (!tts.isEnabled()) {
      return res.status(200).json({ durationMs: 0 });
    }

    // Attempt to select different voices for different agents.
    // In production we'd look up the agent's assigned voiceId from DB.
    let voiceId = undefined;
    if (agentId && agentId.includes("mira")) {
      voiceId = process.env.ELEVENLABS_VOICE_B;
    }

    const { durationMs, audioBuffer } = await tts.synthesizeAndStream(
      room.jamRoomId,
      text,
      messageId,
      voiceId,
    );

    // Emit tts:audio event with base64 payload so frontend can play immediately
    try {
      const { getIO } = await import("../../server.js");
      const io = getIO();
      const audioBase64 = audioBuffer.toString("base64");

      io.to(`room:${room.id}`).emit("tts:audio", {
        roomId: room.id,
        messageId,
        agentId,
        text,
        audioBase64,
        audioUrl: null,
        durationMs,
        provider: "elevenlabs",
        timestamp: new Date().toISOString(),
      });

      logger.debug("tts:audio event emitted (radio-runner TTS route)", {
        roomId: room.id,
        messageId,
        audioSize: audioBuffer.length,
      });
    } catch (emitErr) {
      logger.error("Failed to emit tts:audio event from TTS route", {
        error: emitErr instanceof Error ? emitErr.message : String(emitErr),
      });
    }

    // Persist audio URL and played timestamp to the message record
    try {
      const { getAudioStorageService } = await import("../../services/audio-storage-service.js");
      const audioUrl = await getAudioStorageService().upload(audioBuffer, messageId);
      await messageRepository.updateStatus(messageId, MessageStatus.PLAYED, { playedAt: new Date(), audioUrl: audioUrl || undefined });
      
      const { getIO } = await import("../../server.js");
      getIO().to(`room:${room.id}`).emit("turn:completed", {
        roomId: room.id,
        turnNumber: (room.turnCount || 0) + 1,
        messageId,
        agentId,
        text,
        score: 1.0, // Mocked for radio runner flow
        durationMs,
        audioUrl: audioUrl ?? null,
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      logger.error("Failed to post-process TTS audio", { error: e });
    }

    return res.status(200).json({ success: true, durationMs });
  } catch (err) {
    logger.error("TTS endpoint failed", { error: err instanceof Error ? err.message : String(err) });
    return res.status(500).json({ error: "TTS failed" });
  }
});

// ===================================================================
// EXPORTS
// ===================================================================

export default router;
