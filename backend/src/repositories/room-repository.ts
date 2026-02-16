/**
 * Room Repository
 * Data access layer for room queries
 */

import type { Room, RoomStatus } from "../../common/types/index.js";
import { query, queryOne } from "../config/database.js";
import { logger } from "../utils/logger.js";

interface RoomRow {
  id: string;
  host_agent_id: string;
  type: string;
  status: string;
  objective: string;
  spawn_fee: number;
  jam_room_id: string | null;
  spawn_fee_payment_id: string | null;
  viewer_count: number;
  participant_count: number;
  completion_level: string;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  updated_at: string;
}

/**
 * Room Repository
 * Handles all room database operations
 */
export class RoomRepository {
  /**
   * Create a new room
   */
  async create(room: {
    id: string;
    host_agent_id: string;
    type: string;
    status: string;
    objective: string;
    spawn_fee: number;
  }): Promise<Room> {
    const text = `
      INSERT INTO room (id, host_agent_id, type, status, objective, spawn_fee, viewer_count, participant_count, completion_level, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, 0, 1, 'minimum', NOW(), NOW())
      RETURNING id, host_agent_id, type, status, objective, spawn_fee, jam_room_id, viewer_count, participant_count, completion_level, created_at, started_at, ended_at, updated_at
    `;

    const row = await queryOne<RoomRow>(text, [
      room.id,
      room.host_agent_id,
      room.type,
      room.status,
      room.objective,
      room.spawn_fee,
    ]);

    if (!row) {
      throw new Error("Failed to create room");
    }

    logger.info("Room created in database", {
      roomId: room.id,
      hostAgentId: room.host_agent_id,
      type: room.type,
    });

    return this.mapRowToRoom(row);
  }

  /**
   * Get room by ID
   */
  async getById(id: string): Promise<Room | null> {
    const text = `
      SELECT id, host_agent_id, type, status, objective, spawn_fee, jam_room_id, viewer_count, participant_count, completion_level, created_at, started_at, ended_at, updated_at
      FROM room
      WHERE id = $1
    `;

    const row = await queryOne<RoomRow>(text, [id]);

    if (!row) {
      logger.debug("Room not found", { roomId: id });
      return null;
    }

    return this.mapRowToRoom(row);
  }

  /**
   * Get live rooms (paginated)
   */
  async getLiveRooms(limit: number, offset: number): Promise<Room[]> {
    const text = `
      SELECT id, host_agent_id, type, status, objective, spawn_fee, jam_room_id, viewer_count, participant_count, completion_level, created_at, started_at, ended_at, updated_at
      FROM room
      WHERE status = 'live'
      ORDER BY viewer_count DESC, created_at DESC
      LIMIT $1 OFFSET $2
    `;

    const rows = await query<RoomRow>(text, [limit, offset]);

    logger.debug("Fetched live rooms", {
      count: rows.length,
      limit,
      offset,
    });

    return rows.map((row) => this.mapRowToRoom(row));
  }

  /**
   * Get trending rooms
   */
  async getTrendingRooms(hours: number, limit: number): Promise<Room[]> {
    const text = `
      SELECT id, host_agent_id, type, status, objective, spawn_fee, jam_room_id, viewer_count, participant_count, completion_level, created_at, started_at, ended_at, updated_at
      FROM room
      WHERE status IN ('live', 'completed')
        AND created_at > NOW() - INTERVAL '${hours} hours'
      ORDER BY viewer_count DESC, created_at DESC
      LIMIT $1
    `;

    const rows = await query<RoomRow>(text, [limit]);

    logger.debug("Fetched trending rooms", {
      count: rows.length,
      hours,
    });

    return rows.map((row) => this.mapRowToRoom(row));
  }

  /**
   * Update room status
   */
  async updateStatus(roomId: string, status: RoomStatus): Promise<void> {
    const text = `
      UPDATE room
      SET status = $1, started_at = CASE WHEN $1 = 'live' THEN NOW() ELSE started_at END, ended_at = CASE WHEN $1 IN ('completed', 'cancelled', 'failed') THEN NOW() ELSE ended_at END, updated_at = NOW()
      WHERE id = $2
    `;

    await query(text, [status, roomId]);

    logger.info("Room status updated", {
      roomId,
      status,
    });
  }

  /**
   * Update viewer count
   */
  async updateViewerCount(roomId: string, count: number): Promise<void> {
    const text = `
      UPDATE room
      SET viewer_count = $1, updated_at = NOW()
      WHERE id = $2
    `;

    await query(text, [count, roomId]);
  }

  /**
   * Update Jam room details after creation
   *
   * @param roomId - ClawZz room ID
   * @param details - Jam room ID and URL
   */
  async updateJamDetails(
    roomId: string,
    details: {
      jam_room_id: string;
      jam_room_url: string;
    }
  ): Promise<void> {
    const text = `
      UPDATE room
      SET jam_room_id = $1, updated_at = NOW()
      WHERE id = $2
    `;

    await query(text, [details.jam_room_id, roomId]);

    logger.info("Jam room details updated", {
      roomId,
      jamRoomId: details.jam_room_id,
      url: details.jam_room_url,
    });
  }

  /**
   * Update spawn fee payment ID
   *
   * Links a room to its payment record for spawn fee charging
   *
   * @param roomId - ClawZz room ID
   * @param paymentId - Payment ID from x402
   */
  async updateSpawnFeePaymentId(roomId: string, paymentId: string): Promise<void> {
    const text = `
      UPDATE room
      SET spawn_fee_payment_id = $1, updated_at = NOW()
      WHERE id = $2
    `;

    await query(text, [paymentId, roomId]);

    logger.info("Spawn fee payment ID linked to room", {
      roomId,
      paymentId,
    });
  }

  /**
   * Update turn count and completion metrics
   *
   * @param roomId - Room ID
   * @param turnCount - New turn count
   * @returns Updated room
   */
  async updateTurn(roomId: string, turnCount: number): Promise<Room> {
    const text = `
      UPDATE room
      SET turn_count = $1, last_turn_at = NOW(), updated_at = NOW()
      WHERE id = $2
      RETURNING id, host_agent_id, type, status, objective, spawn_fee, jam_room_id, spawn_fee_payment_id, viewer_count, participant_count, completion_level, created_at, started_at, ended_at, updated_at
    `;

    const row = await queryOne<RoomRow>(text, [turnCount, roomId]);

    if (!row) {
      throw new Error("Failed to update turn count");
    }

    return this.mapRowToRoom(row);
  }

  /**
   * Update room completion percentage
   *
   * @param roomId - Room ID
   * @param completionPercentage - 0-100
   */
  async updateCompletionPercentage(
    roomId: string,
    completionPercentage: number
  ): Promise<void> {
    const text = `
      UPDATE room
      SET completion_percentage = $1, updated_at = NOW()
      WHERE id = $2
    `;

    await query(text, [completionPercentage, roomId]);

    logger.debug("Room completion updated", {
      roomId,
      completionPercentage,
    });
  }

  /**
   * Add participant to room
   */
  async addParticipant(
    roomId: string,
    agentId: string,
    role: string = "speaker"
  ): Promise<void> {
    const text = `
      INSERT INTO room_participant (room_id, agent_id, role, status, joined_at)
      VALUES ($1, $2, $3, 'joined', NOW())
      ON CONFLICT (room_id, agent_id) DO UPDATE
      SET status = 'joined', joined_at = NOW()
    `;

    await query(text, [roomId, agentId, role]);

    logger.info("Participant added to room", {
      roomId,
      agentId,
      role,
    });
  }

  /**
   * Map database row to Room
   */
  private mapRowToRoom(row: RoomRow): Room {
    return {
      id: row.id,
      hostAgentId: row.host_agent_id,
      type: row.type as any,
      status: row.status as RoomStatus,
      objective: row.objective,
      spawnFee: row.spawn_fee,
      jamRoomId: row.jam_room_id || undefined,
      spawnFeePaymentId: row.spawn_fee_payment_id || undefined,
      viewerCount: row.viewer_count,
      participantCount: row.participant_count,
      completionLevel: row.completion_level as any,
      createdAt: new Date(row.created_at),
      startedAt: row.started_at ? new Date(row.started_at) : undefined,
      endedAt: row.ended_at ? new Date(row.ended_at) : undefined,
    };
  }
}

export const roomRepository = new RoomRepository();
