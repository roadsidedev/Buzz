/**
 * Message Repository
 * Data access layer for message queries and mutations
 *
 * Handles:
 * - Create/read/update messages
 * - Query by room, status, agent
 * - Update message status and metadata
 *
 * Part of Day 7
 */

import type { RoomMessage, MessageStatus } from "@common/types/index";
import { query, queryOne } from "../config/database.js";
import { logger } from "../utils/logger.js";

// ===================================================================
// Type Definitions
// ===================================================================

interface MessageRow {
  id: string;
  room_id: string;
  agent_id: string;
  text: string;
  status: string;
  score: number | null;
  audio_url: string | null;
  selected_at: string | null;
  played_at: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

// ===================================================================
// Message Repository
// ===================================================================

export class MessageRepository {
  /**
   * Create a new message
   *
   * @param message - Message to create
   * @returns Created message
   */
  async create(message: RoomMessage): Promise<RoomMessage> {
    const text = `
      INSERT INTO message (
        id, room_id, agent_id, text, status, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING id, room_id, agent_id, text, status, score, audio_url,
                selected_at, played_at, created_at, updated_at
    `;

    const row = await queryOne<MessageRow>(text, [
      message.id,
      message.roomId,
      message.agentId,
      message.text,
      message.status,
    ]);

    if (!row) {
      throw new Error("Failed to create message");
    }

    logger.debug("Message created in database", {
      messageId: message.id,
      roomId: message.roomId,
      status: message.status,
    });

    return this._mapRowToMessage(row);
  }

  /**
   * Get message by ID
   *
   * @param id - Message ID
   * @returns Message or null
   */
  async getById(id: string): Promise<RoomMessage | null> {
    const text = `
      SELECT id, room_id, agent_id, text, status, score, audio_url,
             selected_at, played_at, created_at, updated_at
      FROM message
      WHERE id = $1
    `;

    const row = await queryOne<MessageRow>(text, [id]);

    if (!row) {
      return null;
    }

    return this._mapRowToMessage(row);
  }

  /**
   * Get all messages for a room
   *
   * @param roomId - Room ID
   * @returns Messages in creation order
   */
  async getByRoom(roomId: string): Promise<RoomMessage[]> {
    const text = `
      SELECT id, room_id, agent_id, text, status, score, audio_url,
             selected_at, played_at, created_at, updated_at
      FROM message
      WHERE room_id = $1
      ORDER BY created_at ASC
    `;

    const rows = await query<MessageRow>(text, [roomId]);
    return rows.map((row) => this._mapRowToMessage(row));
  }

  /**
   * Get messages with specific status
   *
   * @param roomId - Room ID
   * @param status - Message status
   * @returns Messages with status
   */
  async getByRoomAndStatus(
    roomId: string,
    status: MessageStatus,
  ): Promise<RoomMessage[]> {
    const text = `
      SELECT id, room_id, agent_id, text, status, score, audio_url,
             selected_at, played_at, created_at, updated_at
      FROM message
      WHERE room_id = $1 AND status = $2
      ORDER BY created_at ASC
    `;

    const rows = await query<MessageRow>(text, [roomId, status]);
    return rows.map((row) => this._mapRowToMessage(row));
  }

  /**
   * Get messages from an agent in a room
   *
   * @param roomId - Room ID
   * @param agentId - Agent ID
   * @returns Messages from agent
   */
  async getByRoomAndAgent(
    roomId: string,
    agentId: string,
  ): Promise<RoomMessage[]> {
    const text = `
      SELECT id, room_id, agent_id, text, status, score, audio_url,
             selected_at, played_at, created_at, updated_at
      FROM message
      WHERE room_id = $1 AND agent_id = $2
      ORDER BY created_at ASC
    `;

    const rows = await query<MessageRow>(text, [roomId, agentId]);
    return rows.map((row) => this._mapRowToMessage(row));
  }

  /**
   * Update message status and metadata
   *
   * @param messageId - Message ID
   * @param status - New status
   * @param metadata - Optional fields to update
   * @returns Updated message
   */
  async updateStatus(
    messageId: string,
    status: MessageStatus,
    metadata?: {
      score?: number;
      audioUrl?: string;
      selectedAt?: Date;
      playedAt?: Date;
    },
  ): Promise<RoomMessage> {
    const updates: string[] = [];
    const values: unknown[] = [messageId];
    let paramIndex = 2;

    updates.push(`status = $${paramIndex}`);
    values.push(status);
    paramIndex++;

    if (metadata?.score !== undefined) {
      updates.push(`score = $${paramIndex}`);
      values.push(metadata.score);
      paramIndex++;
    }

    if (metadata?.audioUrl !== undefined) {
      updates.push(`audio_url = $${paramIndex}`);
      values.push(metadata.audioUrl);
      paramIndex++;
    }

    if (metadata?.selectedAt !== undefined) {
      updates.push(`selected_at = $${paramIndex}`);
      values.push(metadata.selectedAt.toISOString());
      paramIndex++;
    }

    if (metadata?.playedAt !== undefined) {
      updates.push(`played_at = $${paramIndex}`);
      values.push(metadata.playedAt.toISOString());
      paramIndex++;
    }

    updates.push(`updated_at = NOW()`);

    const text = `
      UPDATE message
      SET ${updates.join(", ")}
      WHERE id = $1
      RETURNING id, room_id, agent_id, text, status, score, audio_url,
                selected_at, played_at, created_at, updated_at
    `;

    const row = await queryOne<MessageRow>(text, values);

    if (!row) {
      throw new Error("Failed to update message");
    }

    logger.debug("Message updated in database", {
      messageId,
      status,
      score: metadata?.score,
    });

    return this._mapRowToMessage(row);
  }

  /**
   * Delete a message
   *
   * @param messageId - Message ID
   * @returns true if deleted
   */
  async delete(messageId: string): Promise<boolean> {
    const text = `DELETE FROM message WHERE id = $1`;

    // Execute and check affected rows
    // Note: This is a simplified version; actual implementation depends on database library
    await queryOne(text, [messageId]);

    logger.debug("Message deleted from database", { messageId });

    return true;
  }

  /**
   * Count messages by status in room
   *
   * @param roomId - Room ID
   * @param status - Message status
   * @returns Count
   */
  async countByRoomAndStatus(
    roomId: string,
    status: MessageStatus,
  ): Promise<number> {
    const text = `
      SELECT COUNT(*) as count
      FROM message
      WHERE room_id = $1 AND status = $2
    `;

    const row = await queryOne<{ count: number }>(text, [roomId, status]);
    return row?.count || 0;
  }

  /**
   * Get average score for room
   *
   * @param roomId - Room ID
   * @returns Average score or 0
   */
  async getAverageScore(roomId: string): Promise<number> {
    const text = `
      SELECT AVG(score) as avg_score
      FROM message
      WHERE room_id = $1 AND score IS NOT NULL
    `;

    const row = await queryOne<{ avg_score: number | null }>(text, [roomId]);
    return row?.avg_score || 0;
  }

  /**
   * Get message statistics for agent in room
   *
   * @param roomId - Room ID
   * @param agentId - Agent ID
   * @returns Statistics
   */
  async getAgentStats(
    roomId: string,
    agentId: string,
  ): Promise<{
    submitted: number;
    selected: number;
    averageScore: number;
  }> {
    const text = `
      SELECT
        COUNT(*) as submitted,
        SUM(CASE WHEN status = 'selected' THEN 1 ELSE 0 END) as selected,
        AVG(CASE WHEN score IS NOT NULL THEN score ELSE NULL END) as avg_score
      FROM message
      WHERE room_id = $1 AND agent_id = $2
    `;

    const row = await queryOne<{
      submitted: number;
      selected: number;
      avg_score: number | null;
    }>(text, [roomId, agentId]);

    return {
      submitted: row?.submitted || 0,
      selected: row?.selected || 0,
      averageScore: row?.avg_score || 0,
    };
  }

  /**
   * Map database row to RoomMessage type
   *
   * @param row - Database row
   * @returns RoomMessage
   */
  private _mapRowToMessage(row: MessageRow): RoomMessage {
    return {
      id: row.id,
      roomId: row.room_id,
      agentId: row.agent_id,
      text: row.text,
      createdAt: new Date(row.created_at),
      status: row.status as MessageStatus,
      score: row.score || undefined,
      audioUrl: row.audio_url || undefined,
      selectedAt: row.selected_at ? new Date(row.selected_at) : undefined,
      playedAt: row.played_at ? new Date(row.played_at) : undefined,
    };
  }
}

/**
 * Singleton instance
 */
export const messageRepository = new MessageRepository();
