/**
 * Turn Management Service
 *
 * Orchestrates turn-taking in live rooms:
 * - Fetches candidate messages
 * - Calls orchestrator for scoring
 * - Selects next message to play
 * - Triggers TTS synthesis and audio playback
 * - Updates room state and message status
 * - Handles timeouts and edge cases
 *
 * Part of Day 7: Orchestrator Integration
 */

import type { Server as SocketIOServer } from "socket.io";
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
import { ttsService } from "./tts-service.js";
import { getJamService } from "./jam-service.js";
import { roomRepository, messageRepository } from "../repositories/index.js";
import {
  emitTurnSelected,
  emitMessageSubmitted,
  emitOrchestratorError,
  emitTurnStatusUpdate,
} from "./websocket-orchestration-handlers.js";
import { ValidationError, NotFoundError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

// Import WebSocket emitters - will be set from server.ts
let _io: SocketIOServer | null = null;

export function setSocketIO(io: SocketIOServer): void {
  _io = io;
}

export function getSocketIO(): SocketIOServer | null {
  return _io;
}

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
const MIN_SCORE_THRESHOLD = parseInt(process.env.MIN_SCORE_THRESHOLD || "30", 10);

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
      () => this._runTurnLoop(roomId).catch((err) => {
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

    // 5. EMIT WEBSOCKET EVENT - Message Submitted
    if (_io) {
      emitMessageSubmitted(_io, roomId, message);
    }

    // 6. NOTIFY TURN MANAGER (via event/webhook - async)
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

    // 8. EMIT WEBSOCKET EVENT - Turn Selected
    if (_io) {
      emitTurnSelected(_io, roomId, {
        roomId,
        turnNumber: room.turnCount + 1,
        messageId: winner.messageId,
        agentId: winner.dimensions.agentId || "unknown",
        text: toScore.find(m => m.id === winner.messageId)?.text || "",
        score: winner.score,
      });
    }

    // 9. SYNTHESIZE AUDIO & PLAY
    try {
      const selectedMessage = toScore.find(m => m.id === winner.messageId);
      if (selectedMessage) {
        await this._synthesizeAndPlayAudio(roomId, selectedMessage, winner);
      }
    } catch (audioError) {
      logger.error("Audio synthesis/playback failed", {
        roomId,
        messageId: winner.messageId,
        error: audioError instanceof Error ? audioError.message : String(audioError),
      });
      
      // Emit error but continue
      if (_io) {
        emitOrchestratorError(_io, roomId, "Audio synthesis failed");
      }
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

  /**
   * Synthesize message to audio and trigger playback
   *
   * @param roomId - Room ID
   * @param message - Selected message
   * @param score - Orchestrator score
   */
  private async _synthesizeAndPlayAudio(
    roomId: string,
    message: RoomMessage,
    score: RoomMessageScore,
  ): Promise<void> {
    const jamService = getJamService();

    // 1. SYNTHESIZE AUDIO
    const ttsResult = await ttsService.synthesize({
      messageId: message.id,
      text: message.text,
      agentId: message.agentId,
    });

    logger.info("Audio synthesized", {
      roomId,
      messageId: message.id,
      duration: ttsResult.duration,
      voiceId: ttsResult.voiceId,
    });

    // 2. UPDATE MESSAGE WITH AUDIO URL
    await messageRepository.updateStatus(message.id, "playing", {
      audioUrl: ttsResult.audioUrl,
    });

    // 3. PLAY AUDIO IN JAM ROOM
    try {
      // Get room's Jam room ID
      const room = await roomRepository.getById(roomId);
      if (!room?.jamRoomId) {
        logger.warn("Room has no Jam room ID, skipping audio playback", { roomId });
        return;
      }

      // TODO: Implement audio playback in Jam
      // For now, just emit that audio is playing
      if (_io) {
        _io.to(roomId).emit("audio:playing", {
          messageId: message.id,
          audioUrl: ttsResult.audioUrl,
          duration: ttsResult.duration,
          timestamp: new Date(),
        });
      }

      // Simulate audio playing (in real implementation, wait for Jam webhook)
      setTimeout(async () => {
        await messageRepository.updateStatus(message.id, "played", {
          playedAt: new Date(),
        });

        logger.info("Audio playback completed", {
          roomId,
          messageId: message.id,
        });

        // Emit transcript line available
        if (_io) {
          _io.to(roomId).emit("transcript:line", {
            roomId,
            messageId: message.id,
            agentId: message.agentId,
            text: message.text,
            audioUrl: ttsResult.audioUrl,
            timestamp: new Date(),
          });
        }
      }, ttsResult.duration * 1000);

    } catch (err) {
      logger.error("Failed to play audio in Jam room", {
        roomId,
        messageId: message.id,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }
}

/**
 * Singleton instance
 */
export const turnManagementService = new TurnManagementService();
