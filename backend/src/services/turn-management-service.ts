/**
 * Turn Management Service
 *
 * Orchestrates turn-taking in live rooms:
 * - Fetches candidate messages
 * - Calls orchestrator for scoring
 * - Selects next message to play
 * - Updates room state and message status
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
} from "../../common/types/index.js";
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

// ===================================================================
// Turn Management Service
// ===================================================================

export class TurnManagementService {
  private activeRooms = new Map<string, NodeJS.Timeout>(); // roomId -> intervalId

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
   * @param roomId - Room ID
   */
  stopTurnManagement(roomId: string): void {
    const intervalId = this.activeRooms.get(roomId);
    if (!intervalId) {
      return;
    }

    clearInterval(intervalId);
    this.activeRooms.delete(roomId);

    logger.info("Stopped turn management", { roomId });
  }

  /**
   * Submit a message to a room
   *
   * Validates and stores message as "candidate" for scoring
   *
   * @param roomId - Room ID
   * @param agentId - Agent submitting
   * @param text - Message text
   * @returns Stored message
   * @throws ValidationError if validation fails
   * @throws NotFoundError if room or agent not found
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

    // 3. VERIFY AGENT IS IN ROOM
    // TODO: Implement participant verification
    // For now, assume any verified agent can submit

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
      textLength: text.length,
    });

    // 5. NOTIFY TURN MANAGER (via event/webhook - async)
    // This will trigger turn selection on next loop

    return message;
  }

  /**
   * Get current turn status for a room
   *
   * @param roomId - Room ID
   * @returns Turn status
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
   * Internal: Run one iteration of the turn loop
   *
   * Steps:
   * 1. Fetch candidate messages
   * 2. Call orchestrator to score
   * 3. Select winner
   * 4. Update message status
   * 5. Emit WebSocket event
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

      if (elapsed > timeoutMs && room.turnCount === 0) {
        logger.warn("Room timeout: no turns completed", {
          roomId,
          elapsedSeconds: elapsed / 1000,
          timeoutSeconds: TURN_TIMEOUT_SECONDS,
        });
        // TODO: Handle timeout (nudge agents, close room, etc.)
        return;
      }
    }

    // 3. FETCH CANDIDATE MESSAGES
    const candidates = await messageRepository.getByRoomAndStatus(
      roomId,
      "candidate",
    );

    if (candidates.length === 0) {
      // No messages to score yet
      return;
    }

    // Limit to top MAX_CANDIDATES_PER_TURN
    const toScore = candidates.slice(0, MAX_CANDIDATES_PER_TURN);

    logger.debug("Scoring candidates", {
      roomId,
      count: toScore.length,
      totalCandidates: candidates.length,
    });

    // 4. CALL ORCHESTRATOR TO SCORE
    let scores: RoomMessageScore[];
    try {
      scores = await this._scoreMessages(room, toScore);
    } catch (err) {
      logger.error("Orchestrator scoring failed", {
        roomId,
        error: err instanceof Error ? err.message : String(err),
      });
      // Continue next iteration, don't crash
      return;
    }

    // 5. SELECT WINNER
    const winner = this._selectWinner(scores);
    if (!winner) {
      logger.debug("No message met quality threshold", {
        roomId,
        minThreshold: MIN_SCORE_THRESHOLD,
      });
      return;
    }

    // 6. UPDATE MESSAGE STATUS
    await messageRepository.updateStatus(winner.messageId, "selected", {
      selectedAt: new Date(),
      score: winner.score,
    });

    // 7. UPDATE ROOM STATE
    await roomRepository.updateTurn(roomId, room.turnCount + 1);

    // Get the winning message and agent info
    const winningMessage = messages.find((m) => m.id === winner.messageId);
    if (!winningMessage) {
      throw new Error("Winning message not found");
    }

    logger.info("Turn selected", {
      roomId,
      turnNumber: room.turnCount + 1,
      messageId: winner.messageId,
      agentId: winningMessage.agentId || "unknown",
      score: winner.score,
    });

    // 8. SYNTHESIZE AUDIO & STREAM TO JAM
    try {
      const ttsService = getTTSService();

      // Get Jam room ID from room data
      const roomData = await roomRepository.getById(roomId);
      if (!roomData?.jam_room_id) {
        throw new Error("Jam room not found for streaming");
      }

      logger.info("Synthesizing audio for turn", {
        roomId,
        messageId: winner.messageId,
        textLength: winningMessage.text.length,
      });

      // Synthesize and stream in one operation
      const { durationMs } = await ttsService.synthesizeAndStream(
        roomData.jam_room_id,
        winningMessage.text,
        winner.messageId
      );

      // Update message with audio metadata
      await messageRepository.updateStatus(winner.messageId, "played", {
        playedAt: new Date(),
        audioDuration: durationMs,
      });

      logger.info("Audio streamed successfully", {
        roomId,
        messageId: winner.messageId,
        durationMs,
      });

      // 9. EMIT WEBSOCKET EVENT TO CLIENTS
      const { getIO } = await import("../server.js");
      const io = getIO();

      io.to(`room:${roomId}`).emit("turn:completed", {
        roomId,
        turnNumber: room.turnCount + 1,
        messageId: winner.messageId,
        agentId: winningMessage.agentId,
        text: winningMessage.text,
        score: winner.score,
        audioDuration: durationMs,
        timestamp: new Date().toISOString(),
      });

      logger.debug("WebSocket event emitted", {
        roomId,
        event: "turn:completed",
      });

    } catch (err) {
      logger.error("Failed to synthesize or stream audio", {
        roomId,
        messageId: winner.messageId,
        error: err instanceof Error ? err.message : String(err),
      });

      // Still mark message as played even if audio failed
      await messageRepository.updateStatus(winner.messageId, "played", {
        playedAt: new Date(),
        audioError: err instanceof Error ? err.message : String(err),
      });

      // Emit error event to clients
      try {
        const { getIO } = await import("../server.js");
        const io = getIO();
        io.to(`room:${roomId}`).emit("turn:error", {
          roomId,
          messageId: winner.messageId,
          error: "Audio streaming failed",
          timestamp: new Date().toISOString(),
        });
      } catch (wsErr) {
        logger.error("Failed to emit error event", { error: wsErr });
      }
    }
  }

      // Get Jam room ID from room data
      const roomData = await roomRepository.getById(roomId);
      if (!roomData?.jam_room_id) {
        throw new Error("Jam room not found for streaming");
      }

      logger.info("Synthesizing audio for turn", {
        roomId,
        messageId: winner.messageId,
        textLength: winningMessage.text.length,
      });

      // Synthesize and stream in one operation
      const { durationMs } = await ttsService.synthesizeAndStream(
        roomData.jam_room_id,
        winningMessage.text,
        winner.messageId,
        winner.dimensions.voiceId,
      );

      // Update message with audio metadata
      await messageRepository.updateStatus(winner.messageId, "played", {
        playedAt: new Date(),
        audioDuration: durationMs,
      });

      logger.info("Audio streamed successfully", {
        roomId,
        messageId: winner.messageId,
        durationMs,
      });

      // 9. EMIT WEBSOCKET EVENT TO CLIENTS
      // Import the WebSocket server from server.ts
      const { getIO } = await import("../server.js");
      const io = getIO();

      io.to(`room:${roomId}`).emit("turn:completed", {
        roomId,
        turnNumber: room.turnCount + 1,
        messageId: winner.messageId,
        agentId: winner.dimensions.agentId,
        agentName: winner.dimensions.agentName,
        text: winningMessage.text,
        score: winner.score,
        audioDuration: durationMs,
        timestamp: new Date().toISOString(),
      });

      logger.debug("WebSocket event emitted", {
        roomId,
        event: "turn:completed",
      });
    } catch (err) {
      logger.error("Failed to synthesize or stream audio", {
        roomId,
        messageId: winner.messageId,
        error: err instanceof Error ? err.message : String(err),
      });

      // Still mark message as played even if audio failed
      await messageRepository.updateStatus(winner.messageId, "played", {
        playedAt: new Date(),
        audioError: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Call orchestrator to score messages
   *
   * @param room - Room context
   * @param messages - Messages to score
   * @returns Scores
   */
  private async _scoreMessages(
    room: Room,
    messages: RoomMessage[],
  ): Promise<RoomMessageScore[]> {
    // Build scoring context
    const request: RoomMessageScoringRequest = {
      roomId: room.id,
      messages: messages.map((m) => ({
        messageId: m.id,
        agentId: m.agentId,
        text: m.text,
      })),
      context: {
        roomType: room.type,
        objective: room.objective,
        history: [], // TODO: Build from transcript
      },
    };

    return await orchestratorClient.scoreMessages(request);
  }

  /**
   * Select winner from scored messages
   *
   * Rules:
   * 1. Score must exceed MIN_SCORE_THRESHOLD
   * 2. Select highest-scoring message
   *
   * @param scores - Scored messages
   * @returns Selected score or null
   */
  private _selectWinner(scores: RoomMessageScore[]): RoomMessageScore | null {
    // Sort by score descending
    const sorted = [...scores].sort((a, b) => b.score - a.score);

    // Find first above threshold
    for (const score of sorted) {
      if (score.score >= MIN_SCORE_THRESHOLD) {
        return score;
      }
    }

    // No winner
    return null;
  }
}

/**
 * Singleton instance
 */
export const turnManagementService = new TurnManagementService();
