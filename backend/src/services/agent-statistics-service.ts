// @ts-nocheck
/**
 * Agent Statistics Service
 *
 * Persists final performance metrics for agents after room completion.
 * Tracks message counts, scores, and revenue for analytics and leaderboards.
 *
 * Part of Day 8: Agent Statistics Updates
 */

import { v4 as uuidv4 } from "uuid";
import type { Room } from "@common/types/index";
import { messageRepository, roomRepository } from "../repositories/index.js";
import { query, queryOne } from "../config/database.js";
import { logger } from "../utils/logger.js";

// ===================================================================
// Type Definitions
// ===================================================================

interface AgentStatisticRecord {
  id: string;
  roomId: string;
  agentId: string;
  messagesSubmitted: number;
  messagesSelected: number;
  averageScore: number;
  totalAudioTimeSeconds: number;
  createdAt: Date;
  updatedAt: Date;
}

interface AgentStatisticRow {
  id: string;
  room_id: string;
  agent_id: string;
  messages_submitted: number;
  messages_selected: number;
  average_score: number;
  total_audio_time_seconds: number;
  created_at: string;
  updated_at: string;
}

interface RoomParticipant {
  agentId: string;
  role: "host" | "participant";
}

// ===================================================================
// Agent Statistics Service
// ===================================================================

export class AgentStatisticsService {
  /**
   * Update statistics for all participants in a completed room
   *
   * Called when room transitions to "completed" status.
   * Aggregates message counts, scores, and calculates engagement metrics.
   *
   * @param roomId - The completed room ID
   * @returns Array of persisted statistics records
   */
  async updateRoomStatistics(roomId: string): Promise<AgentStatisticRecord[]> {
    try {
      // 1. FETCH ROOM DATA
      const room = await roomRepository.getById(roomId);
      if (!room) {
        throw new Error(`Room ${roomId} not found`);
      }

      logger.info("Starting statistics update for room", {
        roomId,
        hostAgent: room.hostAgentId,
      });

      // 2. GET ALL PARTICIPANTS
      const participants = await this._getRoomParticipants(roomId, room);
      if (participants.length === 0) {
        logger.warn("No participants found in room", { roomId });
        return [];
      }

      // 3. CALCULATE STATISTICS FOR EACH PARTICIPANT
      const statisticsRecords: AgentStatisticRecord[] = [];

      for (const participant of participants) {
        try {
          const stats = await this._calculateAgentStatistics(
            roomId,
            participant.agentId,
            room,
          );
          statisticsRecords.push(stats);

          logger.debug("Calculated statistics for agent", {
            roomId,
            agentId: participant.agentId,
            messagesSubmitted: stats.messagesSubmitted,
            messagesSelected: stats.messagesSelected,
            averageScore: stats.averageScore,
          });
        } catch (err) {
          logger.error("Failed to calculate statistics for agent", {
            roomId,
            agentId: participant.agentId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      // 4. PERSIST ALL STATISTICS
      const persistedStats = await Promise.all(
        statisticsRecords.map((stats) => this._persistStatistics(stats)),
      );

      logger.info("Room statistics updated successfully", {
        roomId,
        totalAgents: persistedStats.length,
      });

      return persistedStats;
    } catch (err) {
      logger.error("Error updating room statistics", {
        roomId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  /**
   * Get statistics for an agent in a specific room
   *
   * @param roomId - Room ID
   * @param agentId - Agent ID
   * @returns Statistics record or null if not found
   */
  async getAgentRoomStatistics(
    roomId: string,
    agentId: string,
  ): Promise<AgentStatisticRecord | null> {
    try {
      const text = `
        SELECT id, room_id, agent_id, messages_submitted, messages_selected,
               average_score, total_audio_time_seconds, created_at, updated_at
        FROM agent_statistics
        WHERE room_id = $1 AND agent_id = $2
      `;

      const row = await queryOne<AgentStatisticRow>(text, [roomId, agentId]);

      if (!row) {
        return null;
      }

      return this._mapRowToRecord(row);
    } catch (err) {
      logger.error("Failed to fetch agent statistics", {
        roomId,
        agentId,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  /**
   * Get aggregate statistics for an agent across all rooms
   *
   * @param agentId - Agent ID
   * @returns Aggregate statistics
   */
  async getAgentAggregateStatistics(agentId: string): Promise<{
    totalRooms: number;
    totalMessagesSubmitted: number;
    totalMessagesSelected: number;
    averageScoreAcrossRooms: number;
    totalAudioTimeSeconds: number;
  }> {
    try {
      const text = `
        SELECT
          COUNT(DISTINCT room_id) as total_rooms,
          SUM(messages_submitted) as total_messages_submitted,
          SUM(messages_selected) as total_messages_selected,
          AVG(average_score) as average_score_across_rooms,
          SUM(total_audio_time_seconds) as total_audio_time_seconds
        FROM agent_statistics
        WHERE agent_id = $1
      `;

      const row = await queryOne<{
        total_rooms: number;
        total_messages_submitted: number;
        total_messages_selected: number;
        average_score_across_rooms: number;
        total_audio_time_seconds: number;
      }>(text, [agentId]);

      return {
        totalRooms: row?.total_rooms || 0,
        totalMessagesSubmitted: row?.total_messages_submitted || 0,
        totalMessagesSelected: row?.total_messages_selected || 0,
        averageScoreAcrossRooms: row?.average_score_across_rooms || 0,
        totalAudioTimeSeconds: row?.total_audio_time_seconds || 0,
      };
    } catch (err) {
      logger.error("Failed to fetch aggregate statistics", {
        agentId,
        error: err instanceof Error ? err.message : String(err),
      });
      return {
        totalRooms: 0,
        totalMessagesSubmitted: 0,
        totalMessagesSelected: 0,
        averageScoreAcrossRooms: 0,
        totalAudioTimeSeconds: 0,
      };
    }
  }

  /**
   * Get top agents by selection rate
   *
   * @param limit - Number of agents to return
   * @returns Top agents with their stats
   */
  async getTopAgentsBySelectionRate(limit: number = 10): Promise<
    Array<{
      agentId: string;
      selectionRate: number;
      totalMessagesSelected: number;
      totalMessagesSubmitted: number;
    }>
  > {
    try {
      const text = `
        SELECT
          agent_id,
          SUM(messages_selected)::float / NULLIF(SUM(messages_submitted), 0) as selection_rate,
          SUM(messages_selected) as total_messages_selected,
          SUM(messages_submitted) as total_messages_submitted
        FROM agent_statistics
        GROUP BY agent_id
        HAVING SUM(messages_submitted) > 0
        ORDER BY selection_rate DESC, total_messages_selected DESC
        LIMIT $1
      `;

      const rows = await query<{
        agent_id: string;
        selection_rate: number;
        total_messages_selected: number;
        total_messages_submitted: number;
      }>(text, [limit]);

      return rows.map((row) => ({
        agentId: row.agent_id,
        selectionRate: row.selection_rate || 0,
        totalMessagesSelected: row.total_messages_selected,
        totalMessagesSubmitted: row.total_messages_submitted,
      }));
    } catch (err) {
      logger.error("Failed to fetch top agents", {
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }

  /**
   * Internal: Get all participants in a room (host + participants)
   *
   * @private
   */
  private async _getRoomParticipants(
    roomId: string,
    room: Room,
  ): Promise<RoomParticipant[]> {
    // For MVP, we'll get participants from the message history
    // A participant is anyone who submitted a message

    const messages = await messageRepository.getByRoom(roomId);
    const agentIds = new Set<string>();

    // Add host
    agentIds.add(room.hostAgentId);

    // Add all agents who submitted messages
    for (const msg of messages) {
      agentIds.add(msg.agentId);
    }

    // Convert to participant list
    return Array.from(agentIds).map((agentId) => ({
      agentId,
      role: agentId === room.hostAgentId ? "host" : "participant",
    }));
  }

  /**
   * Internal: Calculate statistics for a single agent in a room
   *
   * @private
   */
  private async _calculateAgentStatistics(
    roomId: string,
    agentId: string,
    room: Room,
  ): Promise<AgentStatisticRecord> {
    // Get message stats
    const messageStats = await messageRepository.getAgentStats(roomId, agentId);

    // Get selected messages for this agent
    const selectedMessages = await messageRepository.getByRoomAndAgent(
      roomId,
      agentId,
    );
    const playedMessages = selectedMessages.filter(
      (m) => m.status === "played" && m.playedAt,
    );

    // Calculate audio time (estimate: 0.1s per character in average speech rate)
    const totalAudioTimeSeconds = Math.ceil(
      playedMessages.reduce((acc, msg) => acc + msg.text.length * 0.05, 0),
    );

    return {
      id: uuidv4(),
      roomId,
      agentId,
      messagesSubmitted: messageStats.submitted,
      messagesSelected: messageStats.selected,
      averageScore: messageStats.averageScore,
      totalAudioTimeSeconds,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Internal: Persist statistics to database
   *
   * @private
   */
  private async _persistStatistics(
    stats: AgentStatisticRecord,
  ): Promise<AgentStatisticRecord> {
    try {
      const text = `
        INSERT INTO agent_statistics (
          id, room_id, agent_id, messages_submitted, messages_selected,
          average_score, total_audio_time_seconds, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        ON CONFLICT (room_id, agent_id) DO UPDATE SET
          messages_submitted = $4,
          messages_selected = $5,
          average_score = $6,
          total_audio_time_seconds = $7,
          updated_at = NOW()
        RETURNING id, room_id, agent_id, messages_submitted, messages_selected,
                  average_score, total_audio_time_seconds, created_at, updated_at
      `;

      const row = await queryOne<AgentStatisticRow>(text, [
        stats.id,
        stats.roomId,
        stats.agentId,
        stats.messagesSubmitted,
        stats.messagesSelected,
        stats.averageScore,
        stats.totalAudioTimeSeconds,
      ]);

      if (!row) {
        throw new Error("Failed to persist statistics");
      }

      logger.debug("Statistics persisted", {
        roomId: stats.roomId,
        agentId: stats.agentId,
      });

      return this._mapRowToRecord(row);
    } catch (err) {
      logger.error("Failed to persist statistics", {
        roomId: stats.roomId,
        agentId: stats.agentId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  /**
   * Internal: Map database row to record
   *
   * @private
   */
  private _mapRowToRecord(row: AgentStatisticRow): AgentStatisticRecord {
    return {
      id: row.id,
      roomId: row.room_id,
      agentId: row.agent_id,
      messagesSubmitted: row.messages_submitted,
      messagesSelected: row.messages_selected,
      averageScore: row.average_score,
      totalAudioTimeSeconds: row.total_audio_time_seconds,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}

/**
 * Singleton instance
 */
export const agentStatisticsService = new AgentStatisticsService();
