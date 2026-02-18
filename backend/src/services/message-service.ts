/**
 * Message Service
 *
 * Handles message lifecycle and queries:
 * - Create/update messages
 * - Status transitions
 * - Query candidates, transcripts, statistics
 * - Update agent statistics
 *
 * Part of Day 7: Message Management
 */

import crypto from "crypto";
import type { RoomMessage, MessageStatus } from "../../common/types/index.js";
import { ValidationError, NotFoundError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { messageRepository } from "../repositories/index.js";

// ===================================================================
// Type Definitions
// ===================================================================

export interface MessageStatistics {
  agentId: string;
  roomId: string;
  submitted: number;
  selected: number;
  selectionRate: number; // 0-1
  averageScore: number;
  totalAudioTime: number; // seconds
}

export interface CandidateMessage extends RoomMessage {
  waitTime: number; // Seconds since submission
  agentTurnCount: number; // How many times agent has spoken
}

// ===================================================================
// Message Service
// ===================================================================

export class MessageService {
  /**
   * Create a new message
   *
   * @param roomId - Room ID
   * @param agentId - Agent ID
   * @param text - Message text
   * @returns Created message
   */
  async createMessage(
    roomId: string,
    agentId: string,
    text: string,
  ): Promise<RoomMessage> {
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

    const message: RoomMessage = {
      id: crypto.randomUUID(),
      roomId,
      agentId,
      text: text.trim(),
      createdAt: new Date(),
      status: "candidate",
    };

    await messageRepository.create(message);

    logger.info("Message created", {
      messageId: message.id,
      roomId,
      agentId,
      textLength: text.length,
    });

    return message;
  }

  /**
   * Update message status and metadata
   *
   * @param messageId - Message ID
   * @param status - New status
   * @param metadata - Additional fields (score, audioUrl, etc.)
   * @returns Updated message
   */
  async updateMessage(
    messageId: string,
    status: MessageStatus,
    metadata?: {
      score?: number;
      audioUrl?: string;
      selectedAt?: Date;
      playedAt?: Date;
    },
  ): Promise<RoomMessage> {
    const message = await messageRepository.getById(messageId);
    if (!message) {
      throw new NotFoundError("Message not found", { messageId });
    }

    // Validate status transition
    this._validateStatusTransition(message.status, status);

    // Update
    await messageRepository.updateStatus(messageId, status, metadata);

    logger.info("Message updated", {
      messageId,
      roomId: message.roomId,
      oldStatus: message.status,
      newStatus: status,
      score: metadata?.score,
    });

    const updated = await messageRepository.getById(messageId);
    if (!updated) {
      throw new Error("Failed to retrieve updated message");
    }

    return updated;
  }

  /**
   * Get candidate messages for a room
   *
   * Returns messages awaiting scoring with metadata
   *
   * @param roomId - Room ID
   * @returns Candidate messages with wait times
   */
  async getCandidates(roomId: string): Promise<CandidateMessage[]> {
    const messages = await messageRepository.getByRoomAndStatus(
      roomId,
      "candidate",
    );

    const now = new Date();
    return messages.map((m) => ({
      ...m,
      waitTime: (now.getTime() - m.createdAt.getTime()) / 1000,
      agentTurnCount: 0, // TODO: Calculate from transcript
    }));
  }

  /**
   * Get transcript lines for a room
   *
   * Returns all played messages in order
   *
   * @param roomId - Room ID
   * @returns Played messages
   */
  async getTranscript(roomId: string): Promise<RoomMessage[]> {
    const messages = await messageRepository.getByRoomAndStatus(
      roomId,
      "played",
    );

    return messages.sort(
      (a, b) => (a.playedAt?.getTime() ?? 0) - (b.playedAt?.getTime() ?? 0),
    );
  }

  /**
   * Get all messages for a room (any status)
   *
   * @param roomId - Room ID
   * @returns All messages
   */
  async getByRoom(roomId: string): Promise<RoomMessage[]> {
    return await messageRepository.getByRoom(roomId);
  }

  /**
   * Get message by ID
   *
   * @param messageId - Message ID
   * @returns Message or null
   */
  async getMessage(messageId: string): Promise<RoomMessage | null> {
    return await messageRepository.getById(messageId);
  }

  /**
   * Get statistics for agent in room
   *
   * @param roomId - Room ID
   * @param agentId - Agent ID
   * @returns Statistics
   */
  async getAgentStatistics(
    roomId: string,
    agentId: string,
  ): Promise<MessageStatistics> {
    const allMessages = await messageRepository.getByRoom(roomId);

    const forAgent = allMessages.filter((m) => m.agentId === agentId);
    const submitted = forAgent.length;
    const selected = forAgent.filter((m) => m.status === "selected").length;

    const scores = forAgent
      .filter((m) => m.score !== undefined && m.score !== null)
      .map((m) => m.score as number);

    const averageScore =
      scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

    // Calculate total audio time from played messages (duration in seconds)
    // Only count messages that were actually played and have duration info
    const playedMessages = forAgent.filter(
      (m) => m.status === "played" || m.status === "playing",
    );

    let totalAudioTime = 0;
    for (const msg of playedMessages) {
      // If audioUrl is available, it means audio was synthesized
      // Duration would be stored in transcript or extracted from media metadata
      // For now, estimate based on text length (150 WPM = ~1.5 words/sec = 0.4 sec/word)
      if (msg.audioUrl) {
        totalAudioTime += Math.ceil(msg.text.split(/\s+/).length * 0.4);
      }
    }

    return {
      agentId,
      roomId,
      submitted,
      selected,
      selectionRate: submitted > 0 ? selected / submitted : 0,
      averageScore,
      totalAudioTime,
    };
  }

  /**
   * Delete old candidate messages (cleanup)
   *
   * Removes candidates older than specified age
   *
   * @param roomId - Room ID
   * @param olderThanSeconds - Age threshold
   * @returns Number deleted
   */
  async cleanupOldCandidates(
    roomId: string,
    olderThanSeconds: number = 3600,
  ): Promise<number> {
    const candidates = await messageRepository.getByRoomAndStatus(
      roomId,
      "candidate",
    );

    const now = new Date();
    const cutoff = new Date(now.getTime() - olderThanSeconds * 1000);

    const toDelete = candidates.filter((m) => m.createdAt < cutoff);

    for (const message of toDelete) {
      await messageRepository.delete(message.id);
    }

    logger.info("Cleaned up old candidates", {
      roomId,
      deleted: toDelete.length,
    });

    return toDelete.length;
  }

  /**
   * Validate message status transition
   *
   * Enforces state machine:
   * candidate → queued → selected → playing → played
   *            └─────→ rejected
   *
   * @param fromStatus - Current status
   * @param toStatus - Target status
   * @throws ValidationError if transition invalid
   */
  private _validateStatusTransition(
    fromStatus: MessageStatus,
    toStatus: MessageStatus,
  ): void {
    const validTransitions: Record<MessageStatus, MessageStatus[]> = {
      candidate: ["queued", "rejected"],
      queued: ["selected", "rejected"],
      selected: ["playing", "rejected"],
      playing: ["played", "rejected"],
      played: [],
      rejected: [],
    };

    if (!validTransitions[fromStatus].includes(toStatus)) {
      throw new ValidationError(
        `Invalid status transition: ${fromStatus} → ${toStatus}`,
        {
          fromStatus,
          toStatus,
          code: "INVALID_TRANSITION",
        },
      );
    }
  }
}

/**
 * Singleton instance
 */
export const messageService = new MessageService();
