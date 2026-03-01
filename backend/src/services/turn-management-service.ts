// @ts-nocheck
/**
 * Turn Management Service
 *
 * Orchestrates turn-taking in live rooms:
 * - Participant verification
 * - Fetches candidate messages
 * - Calls orchestrator for scoring
 * - Selects next message to play
 * - Handles timeouts and edge cases
 *
 * Part of Day 7: Orchestrator Integration
 */

import crypto from "crypto";
import type {
  Room,
  RoomMessage,
  MessageStatus,
  RoomType,
} from "@common/types/index";
import type {
  RoomMessageScoringRequest,
  RoomMessageScore,
} from "./orchestrator-client.js";
import { orchestratorClient } from "./orchestrator-client.js";
import { roomRepository, messageRepository } from "../repositories/index.js";
import { getJamService } from "./jam-service.js";
import { getTTSService } from "./tts-service.js";
import { ValidationError, NotFoundError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

// ===================================================================
// Configuration
// ===================================================================

const TURN_INTERVAL_SECONDS = parseInt(
  process.env.TURN_INTERVAL_SECONDS || "3",
  10,
);
const TURN_TIMEOUT_SECONDS = parseInt(
  process.env.TURN_TIMEOUT_SECONDS || "30",
  10,
);
const MIN_CANDIDATES_PER_TURN = parseInt(
  process.env.MIN_CANDIDATES_PER_TURN || "1",
  10,
);
const MAX_CANDIDATES_PER_TURN = parseInt(
  process.env.MAX_CANDIDATES_PER_TURN || "5",
  10,
);
const MIN_SCORE_THRESHOLD = parseInt(
  process.env.MIN_SCORE_THRESHOLD || "30",
  10,
);
const INACTIVITY_NUDGE_SECONDS = parseInt(
  process.env.INACTIVITY_NUDGE_SECONDS || "60",
  10,
);

// ===================================================================
// Type Definitions
// ===================================================================

export interface TurnResult {
  roomId: string;
  turnNumber: number;
  selectedMessageId: string;
  selectedAgentId: string;
  score: number;
  reason: string;
}

export interface TurnStatus {
  roomId: string;
  status: "waiting" | "in_progress" | "complete" | "timeout";
  currentTurn: number;
  candidateCount: number;
  lastTurnAt?: Date;
  nextTurnAt: Date;
}

export interface ParticipantInfo {
  agentId: string;
  role: "host" | "speaker" | "listener";
  status: "joined" | "left" | "idle";
  joinedAt: Date;
}

// ===================================================================
// Turn Management Service
// ===================================================================

export class TurnManagementService {
  private activeRooms = new Map<string, NodeJS.Timeout>(); // roomId -> intervalId
  private roomTimeouts = new Map<string, NodeJS.Timeout>(); // roomId -> timeout tracking

  /**
   * Start turn management loop for a room
   *
   * Runs orchestrator turn-taking every TURN_INTERVAL_SECONDS
   *
   * @param roomId - Room ID to manage
   * @throws NotFoundError if room doesn't exist
   */
  async startTurnManagement(roomId: string): Promise<void> {
    // Verify room exists and is live
    const room = await roomRepository.getById(roomId);
    if (!room) {
      throw new NotFoundError("Room not found", { roomId });
    }

    if (room.status !== "live") {
      throw new ValidationError("Room is not live", {
        roomId,
        status: room.status,
        code: "ROOM_NOT_LIVE",
      });
    }

    // Check if already running
    if (this.activeRooms.has(roomId)) {
      logger.warn("Turn management already running for room", { roomId });
      return;
    }

    logger.info("Starting turn management", {
      roomId,
      interval: TURN_INTERVAL_SECONDS,
      timeout: TURN_TIMEOUT_SECONDS,
    });

    // Start interval
    const intervalId = setInterval(
      () =>
        this._runTurnLoop(roomId).catch((err) => {
          logger.error("Turn loop error", {
            roomId,
            error: err instanceof Error ? err.message : String(err),
          });
        }),
      TURN_INTERVAL_SECONDS * 1000,
    );

    this.activeRooms.set(roomId, intervalId);
  }

  /**
   * Stop turn management for a room
   *
   * Cleans up interval and timeout tracking
   *
   * @param roomId - Room ID
   */
  stopTurnManagement(roomId: string): void {
    const intervalId = this.activeRooms.get(roomId);
    if (intervalId) {
      clearInterval(intervalId);
      this.activeRooms.delete(roomId);
    }

    // Also clear any pending timeout handlers
    const timeoutId = this.roomTimeouts.get(roomId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.roomTimeouts.delete(roomId);
    }

    logger.info("Stopped turn management", { roomId });
  }

  /**
   * Submit a message to a room
   *
   * Validates participant status, message content, then stores as "candidate"
   *
   * @param roomId - Room ID
   * @param agentId - Agent submitting message
   * @param text - Message text
   * @returns Stored message
   * @throws ValidationError if validation fails
   * @throws NotFoundError if room or participant not found
   */
  async submitMessage(
    roomId: string,
    agentId: string,
    text: string,
  ): Promise<RoomMessage> {
    // 1. VALIDATE INPUT
    if (!text || text.trim().length === 0) {
      throw new ValidationError("Message text cannot be empty", {
        field: "text",
        code: "EMPTY_TEXT",
      });
    }

    if (text.length < 10) {
      throw new ValidationError("Message must be at least 10 characters", {
        field: "text",
        length: text.length,
        code: "TEXT_TOO_SHORT",
      });
    }

    if (text.length > 2000) {
      throw new ValidationError("Message cannot exceed 2000 characters", {
        field: "text",
        length: text.length,
        code: "TEXT_TOO_LONG",
      });
    }

    // 2. VERIFY ROOM EXISTS AND IS LIVE
    const room = await roomRepository.getById(roomId);
    if (!room) {
      throw new NotFoundError("Room not found", { roomId });
    }

    if (room.status !== "live") {
      throw new ValidationError("Room is not live", {
        roomId,
        status: room.status,
        code: "ROOM_NOT_LIVE",
      });
    }

    // 3. VERIFY PARTICIPANT IS IN ROOM
    const participant = await this._verifyParticipant(roomId, agentId);
    if (!participant) {
      throw new ValidationError("Agent is not a participant in this room", {
        roomId,
        agentId,
        code: "NOT_PARTICIPANT",
      });
    }

    // 4. CREATE MESSAGE
    const message: RoomMessage = {
      id: crypto.randomUUID(),
      roomId,
      agentId,
      text: text.trim(),
      createdAt: new Date(),
      status: "candidate",
    };

    await messageRepository.create(message);

    logger.info("Message submitted", {
      messageId: message.id,
      roomId,
      agentId,
      participantRole: participant.role,
      textLength: text.length,
    });

    return message;
  }

  /**
   * Get current turn status for a room
   *
   * @param roomId - Room ID
   * @returns Turn status with pagination metadata
   */
  async getTurnStatus(roomId: string): Promise<TurnStatus> {
    const room = await roomRepository.getById(roomId);
    if (!room) {
      throw new NotFoundError("Room not found", { roomId });
    }

    // Count candidate messages
    const candidates = await messageRepository.getByRoomAndStatus(
      roomId,
      "candidate",
    );

    const now = new Date();
    const nextTurnAt = new Date(now.getTime() + TURN_INTERVAL_SECONDS * 1000);

    return {
      roomId,
      status: this.activeRooms.has(roomId) ? "in_progress" : "waiting",
      currentTurn: room.turnCount || 0,
      candidateCount: candidates.length,
      lastTurnAt: room.lastTurnAt,
      nextTurnAt,
    };
  }

  /**
   * Verify participant exists and is still in room
   *
   * Checks room_participant table to ensure agent is registered
   * and not left the room.
   *
   * @param roomId - Room ID
   * @param agentId - Agent ID to verify
   * @returns Participant info or null if not found/invalid
   */
  private async _verifyParticipant(
    roomId: string,
    agentId: string,
  ): Promise<ParticipantInfo | null> {
    try {
      // Query room_participant table for this agent
      const participant = await roomRepository.getParticipant(roomId, agentId);

      if (!participant) {
        logger.warn("Participant not found", { roomId, agentId });
        return null;
      }

      // Check if participant has left
      if (participant.status === "left") {
        logger.warn("Participant has left room", { roomId, agentId });
        return null;
      }

      logger.debug("Participant verified", {
        roomId,
        agentId,
        role: participant.role,
        status: participant.status,
      });

      return participant;
    } catch (err) {
      logger.error("Failed to verify participant", {
        roomId,
        agentId,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  /**
   * Internal: Run one iteration of the turn loop
   *
   * Steps:
   * 1. Check room still exists
   * 2. Check timeout (no activity)
   * 3. Fetch candidate messages
   * 4. Call orchestrator to score
   * 5. Select winner
   * 6. Update message + room state
   * 7. Synthesize audio & stream
   * 8. Emit WebSocket event
   *
   * @param roomId - Room ID
   */
  private async _runTurnLoop(roomId: string): Promise<void> {
    // 1. VERIFY ROOM STILL EXISTS
    const room = await roomRepository.getById(roomId);
    if (!room) {
      this.stopTurnManagement(roomId);
      return;
    }

    // If room is completed, stop
    if (room.status === "completed" || room.status === "cancelled") {
      this.stopTurnManagement(roomId);
      return;
    }

    // 2. CHECK TIMEOUT (no activity)
    if (room.startedAt) {
      const elapsed = Date.now() - room.startedAt.getTime();
      const timeoutMs = TURN_TIMEOUT_SECONDS * 1000;

      // If timeout reached with no turns, handle it
      if (elapsed > timeoutMs && room.turnCount === 0) {
        await this._handleTimeout(room);
        return;
      }

      // Check for inactivity and nudge agents if needed
      if (room.lastTurnAt) {
        const lastTurnElapsed = Date.now() - room.lastTurnAt.getTime();
        const nudgeMs = INACTIVITY_NUDGE_SECONDS * 1000;

        if (lastTurnElapsed > nudgeMs) {
          await this._handleInactivity(room);
        }
      }
    }

    // 3. CALL ORCHESTRATOR TO PROCESS TURN
    // The orchestrator handles:
    // - Fetching candidate messages
    // - Scoring them
    // - Appling moderation
    // - Selecting winner
    // - Updating message statuses via API callbacks
    // - Calculating output contracts
    
    let result;
    try {
      result = await orchestratorClient.processTurn(roomId);
    } catch (err) {
      logger.error("Orchestrator process-turn failed", {
        roomId,
        error: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    if (result.status !== "success" || !result.selected_message_id) {
      logger.debug("No message selected for turn", {
        roomId,
        status: result.status,
        error: result.error
      });
      return;
    }

    // 4. FETCH WINNING MESSAGE
    const winningMessage = await messageRepository.getById(result.selected_message_id);
    if (!winningMessage) {
      logger.error("Winning message returned by orchestrator not found in DB", {
        roomId,
        messageId: result.selected_message_id,
      });
      return;
    }

    logger.info("Turn selected", {
      roomId,
      turnNumber: result.turn_number || room.turnCount + 1,
      messageId: result.selected_message_id,
      agentId: result.selected_agent_id,
      score: result.score,
    });

    // 5. UPDATE ROOM STATE (Fallback, orchestrator might do this)
    await roomRepository.updateTurn(roomId, result.turn_number || room.turnCount + 1);

    // 6. SYNTHESIZE AUDIO & STREAM TO JAM
    const mockScore = { score: result.score || 0 };
    await this._synthesizeAndStream(room, winningMessage, mockScore as any);
  }

  /**
   * Synthesize message to audio and stream to Jam room
   *
   * @param room - Room context
   * @param message - Winning message to synthesize
   * @param winner - Score result
   */
  private async _synthesizeAndStream(
    room: Room,
    message: RoomMessage,
    winner: { score: number },
  ): Promise<void> {
    try {
      const ttsService = getTTSService();

      // Get Jam room ID
      const jamRoomId = room.jamRoomId;
      if (!jamRoomId) {
        throw new Error("Jam room not found for streaming");
      }

      logger.info("Synthesizing audio for turn", {
        roomId: room.id,
        messageId: message.id,
        textLength: message.text.length,
      });

      // Synthesize and stream in one operation
      const { durationMs } = await ttsService.synthesizeAndStream(
        jamRoomId,
        message.text,
        message.id,
      );

      // Update message with audio metadata
      await messageRepository.updateStatus(message.id, "played", {
        playedAt: new Date(),
        audioDuration: durationMs,
      });

      logger.info("Audio streamed successfully", {
        roomId: room.id,
        messageId: message.id,
        durationMs,
      });

      // 7. EMIT WEBSOCKET EVENT TO CLIENTS
      const { getIO } = await import("../server.js");
      const io = getIO();

      io.to(`room:${room.id}`).emit("turn:completed", {
        roomId: room.id,
        turnNumber: room.turnCount + 1,
        messageId: message.id,
        agentId: message.agentId,
        text: message.text,
        score: winner.score,
        audioDuration: durationMs,
        timestamp: new Date().toISOString(),
      });

      logger.debug("WebSocket event emitted", {
        roomId: room.id,
        event: "turn:completed",
      });
    } catch (err) {
      logger.error("Failed to synthesize or stream audio", {
        roomId: room.id,
        messageId: message.id,
        error: err instanceof Error ? err.message : String(err),
      });

      // Still mark message as played even if audio failed
      await messageRepository.updateStatus(message.id, "played", {
        playedAt: new Date(),
        audioError: err instanceof Error ? err.message : String(err),
      });

      // Emit error event to clients
      try {
        const { getIO } = await import("../server.js");
        const io = getIO();
        io.to(`room:${room.id}`).emit("turn:error", {
          roomId: room.id,
          messageId: message.id,
          error: "Audio streaming failed",
          timestamp: new Date().toISOString(),
        });
      } catch (wsErr) {
        logger.error("Failed to emit error event", { error: wsErr });
      }
    }
  }

  /**
   * Handle room timeout (no turns completed within timeout window)
   */
  private async _handleTimeout(room: Room): Promise<void> {
    logger.warn("Room timeout: no turns completed", {
      roomId: room.id,
      timeoutSeconds: TURN_TIMEOUT_SECONDS,
    });

    try {
      // Emit timeout event to connected clients
      const { getIO } = await import("../server.js");
      const io = getIO();

      io.to(`room:${room.id}`).emit("room:timeout", {
        roomId: room.id,
        reason: "No agent activity",
        timeoutSeconds: TURN_TIMEOUT_SECONDS,
        timestamp: new Date().toISOString(),
      });

      logger.info("Timeout event emitted", { roomId: room.id });
    } catch (err) {
      logger.error("Failed to emit timeout event", {
        roomId: room.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Handle inactivity (no turns for extended period)
   */
  private async _handleInactivity(room: Room): Promise<void> {
    logger.warn("Room inactivity detected", {
      roomId: room.id,
      lastTurnSeconds: room.lastTurnAt ? (Date.now() - room.lastTurnAt.getTime()) / 1000 : 0,
      inactivityThreshold: INACTIVITY_NUDGE_SECONDS,
    });

    try {
      // Emit nudge event to connected clients
      const { getIO } = await import("../server.js");
      const io = getIO();

      io.to(`room:${room.id}`).emit("room:nudge", {
        roomId: room.id,
        message: "No recent activity. Please submit messages to continue.",
        type: "inactivity_warning",
        timestamp: new Date().toISOString(),
      });

      logger.info("Inactivity nudge emitted", { roomId: room.id });
    } catch (err) {
      logger.error("Failed to emit nudge event", {
        roomId: room.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

/**
 * Singleton instance
 */
export const turnManagementService = new TurnManagementService();
