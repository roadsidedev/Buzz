/**
 * Room Repository
 * Data access layer for room queries
 */

import type { Room, RoomStatus } from "@common/types/index";
import { query, queryOne } from "../config/database.js";
import { logger } from "../utils/logger.js";

interface RoomRow {
  id: string;
  host_agent_id: string;
  type: string;
  status: string;
  title: string | null;
  objective: string;
  spawn_fee: number;
  jam_room_id: string | null;
  jam_room_url: string | null;
  spawn_fee_payment_id: string | null;
  viewer_count: number;
  participant_count: number;
  completion_level: string;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  updated_at: string;
  scheduled_for: string | null;
  recording_enabled: boolean;
  recording_url: string | null;
  recording_started_at: string | null;
  recording_ended_at: string | null;
  [key: string]: unknown;
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
    title: string;
    type: string;
    status: string;
    objective: string;
    spawn_fee: number;
    scheduled_for?: Date;
    recording_enabled?: boolean;
  }): Promise<Room> {
    const text = `
      INSERT INTO room (id, host_agent_id, title, type, status, objective, spawn_fee, viewer_count, participant_count, completion_level, visibility, recording_enabled, created_at, updated_at, last_seen_at, scheduled_for)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 1, 'minimum', 'public', $8, NOW(), NOW(), NOW(), $9)
      RETURNING id, host_agent_id, title, type, status, objective, spawn_fee, jam_room_id, jam_room_url, spawn_fee_payment_id, viewer_count, participant_count, completion_level, recording_enabled, recording_url, recording_started_at, recording_ended_at, created_at, started_at, ended_at, updated_at, scheduled_for
    `;

    const row = await queryOne<RoomRow>(text, [
      room.id,
      room.host_agent_id,
      room.title,
      room.type,
      room.status,
      room.objective,
      room.spawn_fee,
      room.recording_enabled !== false, // default true
      room.scheduled_for || null,
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
      SELECT id, host_agent_id, type, status, title, objective, spawn_fee, jam_room_id, jam_room_url, spawn_fee_payment_id, viewer_count, participant_count, completion_level, recording_enabled, recording_url, recording_started_at, recording_ended_at, created_at, started_at, ended_at, updated_at, scheduled_for
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
   * Delete room by ID (hard delete)
   */
  async deleteRoom(id: string): Promise<void> {
    const text = `
      DELETE FROM room
      WHERE id = $1
    `;

    await query(text, [id]);

    logger.info("Room deleted from database", { roomId: id });
  }

  /**
   * Get live rooms (paginated)
   *
   * @param limit - Max results per page
   * @param offset - Pagination offset
   * @param type - Optional room type filter
   * @returns Array of live rooms ordered by viewer count
   */
  async getLiveRooms(
    limit: number,
    offset: number,
    type?: string,
  ): Promise<Room[]> {
    let text = `
      SELECT id, host_agent_id, type, status, title, objective, spawn_fee, jam_room_id, jam_room_url, spawn_fee_payment_id, viewer_count, participant_count, completion_level, recording_enabled, recording_url, recording_started_at, recording_ended_at, created_at, started_at, ended_at, updated_at, scheduled_for
      FROM room
      WHERE status = 'live'
    `;

    const params: any[] = [];

    if (type) {
      text += ` AND type = $${params.length + 1}`;
      params.push(type);
    }

    text += `
      ORDER BY viewer_count DESC, created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);

    const rows = await query<RoomRow>(text, params);

    logger.debug("Fetched live rooms", {
      count: rows.length,
      limit,
      offset,
      type,
    });

    return rows.map((row) => this.mapRowToRoom(row));
  }

  /**
   * Get total count of live rooms
   *
   * @param type - Optional room type filter for count
   * @returns Total count of rooms matching criteria
   */
  async getLiveRoomCount(type?: string): Promise<number> {
    let text = `
      SELECT COUNT(*) as count
      FROM room
      WHERE status = 'live'
    `;

    const params: any[] = [];

    if (type) {
      text += ` AND type = $${params.length + 1}`;
      params.push(type);
    }

    const row = await queryOne<{ count: string }>(text, params);

    const count = row ? parseInt(row.count, 10) : 0;

    logger.debug("Counted live rooms", { count, type });

    return count;
  }

  /**
   * Count all rooms ever created by a given host agent (any status).
   * Used for trial period enforcement — first N rooms are spawn-fee-free.
   */
  async countByHostAgent(agentId: string): Promise<number> {
    const row = await queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count FROM room WHERE host_agent_id = $1`,
      [agentId],
    );
    return row ? parseInt(row.count, 10) : 0;
  }

  /**
   * Get discoverable rooms (live only with active heartbeat) for public listing.
   *
   * Only rooms where the host has sent a heartbeat within the last 60 seconds
   * are included. Pending rooms are excluded — they are not discoverable until
   * audio is initialized and the host is connected.
   *
   * @param limit - Max results per page
   * @param offset - Pagination offset
   * @param type - Optional room type filter
   * @returns Array of discoverable rooms
   */
  async getDiscoverableRooms(
    limit: number,
    offset: number,
    type?: string,
  ): Promise<Room[]> {
    let text = `
      SELECT id, host_agent_id, type, status, title, objective, spawn_fee, jam_room_id, jam_room_url, spawn_fee_payment_id, viewer_count, participant_count, completion_level, recording_enabled, recording_url, recording_started_at, recording_ended_at, created_at, started_at, ended_at, updated_at, scheduled_for
      FROM room
      WHERE status = 'live'
        AND last_seen_at > NOW() - INTERVAL '60 seconds'
    `;

    const params: any[] = [];

    if (type) {
      text += ` AND type = $${params.length + 1}`;
      params.push(type);
    }

    text += `
      ORDER BY viewer_count DESC, created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);

    const rows = await query<RoomRow>(text, params);

    logger.debug("Fetched discoverable rooms", {
      count: rows.length,
      limit,
      offset,
      type,
    });

    return rows.map((row) => this.mapRowToRoom(row));
  }

  /**
   * Get total count of discoverable rooms (live with active heartbeat)
   *
   * @param type - Optional room type filter for count
   * @returns Total count of rooms matching criteria
   */
  async getDiscoverableRoomCount(type?: string): Promise<number> {
    let text = `
      SELECT COUNT(*) as count
      FROM room
      WHERE status = 'live'
        AND last_seen_at > NOW() - INTERVAL '60 seconds'
    `;

    const params: any[] = [];

    if (type) {
      text += ` AND type = $${params.length + 1}`;
      params.push(type);
    }

    const row = await queryOne<{ count: string }>(text, params);

    const count = row ? parseInt(row.count, 10) : 0;

    logger.debug("Counted discoverable rooms", { count, type });

    return count;
  }

  /**
   * Get trending rooms with optional type filtering
   *
   * @param hours - Timeframe in hours
   * @param limit - Max results
   * @param type - Optional room type filter
   * @returns Array of trending rooms
   */
  async getTrendingRooms(
    hours: number,
    limit: number,
    type?: string,
  ): Promise<Room[]> {
    const params: any[] = [hours];

    let text = `
      SELECT id, host_agent_id, type, status, title, objective, spawn_fee, jam_room_id, jam_room_url, spawn_fee_payment_id, viewer_count, participant_count, completion_level, recording_enabled, recording_url, recording_started_at, recording_ended_at, created_at, started_at, ended_at, updated_at, scheduled_for
      FROM room
      WHERE status IN ('live', 'closed')
        AND created_at > NOW() - make_interval(hours => $1)
    `;

    if (type) {
      text += ` AND type = $${params.length + 1}`;
      params.push(type);
    }

    text += `
      ORDER BY viewer_count DESC, created_at DESC
      LIMIT $${params.length + 1}
    `;

    params.push(limit);

    const rows = await query<RoomRow>(text, params);

    logger.debug("Fetched trending rooms", {
      count: rows.length,
      hours,
      type,
    });

    return rows.map((row) => this.mapRowToRoom(row));
  }

  /**
   * Get scheduled upcoming rooms
   *
   * @param limit - Max results
   * @param offset - Offset
   * @returns Array of upcoming scheduled rooms
   */
  async getUpcomingRooms(
    limit: number,
    offset: number,
  ): Promise<Room[]> {
    const text = `
      SELECT id, host_agent_id, type, status, title, objective, spawn_fee, jam_room_id, jam_room_url, spawn_fee_payment_id, viewer_count, participant_count, completion_level, recording_enabled, recording_url, recording_started_at, recording_ended_at, created_at, started_at, ended_at, updated_at, scheduled_for
      FROM room
      WHERE status = 'scheduled' AND scheduled_for > NOW()
      ORDER BY scheduled_for ASC
      LIMIT $1 OFFSET $2
    `;

    const rows = await query<RoomRow>(text, [limit, offset]);
    return rows.map((row) => this.mapRowToRoom(row));
  }

  /**
   * Get scheduled rooms whose time has arrived and are ready to be pending/live.
   */
  async getReadyScheduledRooms(): Promise<Room[]> {
    const text = `
      SELECT id, host_agent_id, type, status, title, objective, spawn_fee, jam_room_id, jam_room_url, spawn_fee_payment_id, viewer_count, participant_count, completion_level, recording_enabled, recording_url, recording_started_at, recording_ended_at, created_at, started_at, ended_at, updated_at, scheduled_for
      FROM room
      WHERE status = 'scheduled' AND scheduled_for <= NOW()
    `;

    const rows = await query<RoomRow>(text);
    return rows.map((row) => this.mapRowToRoom(row));
  }

  /**
   * Update room status
   */
  async updateStatus(roomId: string, status: RoomStatus): Promise<void> {
    // Inline status as a validated SQL literal — bypasses PostgreSQL parameter
    // type-inference ambiguity with enum columns ($1 gets locked to room_status,
    // which then conflicts with text CASE comparisons).
    const s = String(status).replace(/'/g, "''"); // no-op for valid RoomStatus values

    // Build conditional timestamp assignments in JS to avoid CASE/enum issues.
    const setStartedAt = status === "live" ? ", started_at = NOW()" : "";
    const setEndedAt =
      status === "ended" || status === "completed" || status === "cancelled" || status === "failed"
        ? ", ended_at = NOW()"
        : "";

    const text = `
      UPDATE room
      SET status = '${s}'${setStartedAt}${setEndedAt}, updated_at = NOW()
      WHERE id = $1
    `;

    await query(text, [roomId]);

    logger.info("Room status updated", { roomId, status });
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
   * @param roomId - Beely room ID
   * @param details - Jam room ID and URL
   */
  async updateJamDetails(
    roomId: string,
    details: {
      jam_room_id: string;
      jam_room_url: string;
    },
  ): Promise<void> {
    const text = `
      UPDATE room
      SET jam_room_id = $1, jam_room_url = $2, updated_at = NOW()
      WHERE id = $3
    `;

    await query(text, [details.jam_room_id, details.jam_room_url, roomId]);

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
   * @param roomId - Beely room ID
   * @param paymentId - Payment ID from x402
   */
  async updateSpawnFeePaymentId(
    roomId: string,
    paymentId: string,
  ): Promise<void> {
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
      RETURNING id, host_agent_id, type, status, title, objective, spawn_fee, jam_room_id, jam_room_url, spawn_fee_payment_id, viewer_count, participant_count, completion_level, recording_enabled, recording_url, recording_started_at, recording_ended_at, created_at, started_at, ended_at, updated_at, scheduled_for
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
    completionPercentage: number,
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
    role: string = "speaker",
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
   * Get participant status in room
   *
   * Verifies if agent is in room and their status
   *
   * @param roomId - Room ID
   * @param agentId - Agent ID
   * @returns Participant info or null if not found
   */
  async getParticipant(
    roomId: string,
    agentId: string,
  ): Promise<{
    agentId: string;
    role: "host" | "speaker" | "listener";
    status: "joined" | "left" | "idle";
    joinedAt: Date;
  } | null> {
    const text = `
      SELECT agent_id, role, status, joined_at
      FROM room_participant
      WHERE room_id = $1 AND agent_id = $2
    `;

    const row = await queryOne<{
      agent_id: string;
      role: "host" | "speaker" | "listener";
      status: "joined" | "left" | "idle";
      joined_at: string;
    }>(text, [roomId, agentId]);

    if (!row) {
      return null;
    }

    return {
      agentId: row.agent_id,
      role: row.role,
      status: row.status,
      joinedAt: new Date(row.joined_at),
    };
  }

  /**
   * Remove participant from room
   *
   * Marks participant as left (soft delete)
   *
   * @param roomId - Room ID
   * @param agentId - Agent ID
   */
  async removeParticipant(roomId: string, agentId: string): Promise<void> {
    const text = `
      UPDATE room_participant
      SET status = 'left'
      WHERE room_id = $1 AND agent_id = $2
    `;

    await query(text, [roomId, agentId]);

    logger.info("Participant removed from room", { roomId, agentId });
  }

  /**
   * Get all participants for a room
   *
   * @param roomId - Room ID
   * @returns Array of participants (all statuses)
   */
  async getParticipants(roomId: string): Promise<Array<{
    agent_id: string;
    role: string;
    status: string;
    joined_at: string;
  }>> {
    const text = `
      SELECT agent_id, role, status, joined_at
      FROM room_participant
      WHERE room_id = $1
      ORDER BY joined_at ASC
    `;

    const rows = await query<{
      agent_id: string;
      role: string;
      status: string;
      joined_at: string;
    }>(text, [roomId]);

    return rows;
  }

  /**
   * Save recording URL and timestamps after upload completes
   */
  async updateRecordingUrl(
    roomId: string,
    recordingUrl: string,
    startedAt?: Date,
    endedAt?: Date,
  ): Promise<void> {
    const text = `
      UPDATE room
      SET recording_url = $1,
          recording_started_at = $2,
          recording_ended_at = $3,
          updated_at = NOW()
      WHERE id = $4
    `;

    await query(text, [recordingUrl, startedAt || null, endedAt || null, roomId]);

    logger.info("Room recording URL saved", { roomId, recordingUrl });
  }

  /**
   * Mark recording as available and transition room from 'ended' to 'closed'.
   *
   * Called after a recording has been uploaded and is ready for replay.
   * This is the signal that makes a room eligible for the "recently ended"
   * and "episodes" discovery feeds.
   *
   * @param roomId - Room ID
   */
  async setRecordingAvailable(roomId: string): Promise<void> {
    const text = `
      UPDATE room
      SET recording_available = TRUE,
          status = 'closed',
          updated_at = NOW()
      WHERE id = $1 AND status = 'ended'
    `;

    await query(text, [roomId]);

    logger.info("Room recording marked available", { roomId });
  }

  /**
   * Update host heartbeat timestamp for a room.
   *
   * Called by the agent WebSocket every ~30s while the host is connected.
   * The orchestration service checks this to auto-end rooms where the host
   * has gone stale (no heartbeat for >60s).
   *
   * @param roomId - Room ID
   */
  async updateHeartbeat(roomId: string): Promise<void> {
    const text = `
      UPDATE room
      SET last_seen_at = NOW(), updated_at = NOW()
      WHERE id = $1
    `;

    await query(text, [roomId]);
  }

  /**
   * Get rooms that are marked 'live' but whose host heartbeat is stale.
   *
   * A room is considered stale if `last_seen_at` is older than `staleSeconds`
   * from now. These rooms should be transitioned to 'ended' automatically.
   *
   * @param staleSeconds - Seconds since last heartbeat before considered stale (default 60)
   * @returns Array of rooms with stale heartbeats
   */
  async getRoomsWithStaleHeartbeat(staleSeconds: number = 60): Promise<Room[]> {
    const text = `
      SELECT id, host_agent_id, type, status, title, objective, spawn_fee,
             jam_room_id, jam_room_url, spawn_fee_payment_id, viewer_count,
             participant_count, completion_level, recording_enabled,
             recording_url, recording_started_at, recording_ended_at,
             created_at, started_at, ended_at, updated_at, scheduled_for
      FROM room
      WHERE status = 'live'
        AND last_seen_at < NOW() - make_interval(secs => $1)
    `;

    const rows = await query<RoomRow>(text, [staleSeconds]);

    logger.debug("Found rooms with stale heartbeat", {
      count: rows.length,
      staleSeconds,
    });

    return rows.map((row) => this.mapRowToRoom(row));
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
      title: row.title || undefined,
      objective: row.objective,
      spawnFee: row.spawn_fee,
      jamRoomId: row.jam_room_id || undefined,
      jamRoomUrl: row.jam_room_url || undefined,
      spawnFeePaymentId: row.spawn_fee_payment_id || undefined,
      viewerCount: row.viewer_count,
      participantCount: row.participant_count,
      completionLevel: row.completion_level as any,
      createdAt: new Date(row.created_at),
      startedAt: row.started_at ? new Date(row.started_at) : undefined,
      endedAt: row.ended_at ? new Date(row.ended_at) : undefined,
      scheduledFor: row.scheduled_for ? new Date(row.scheduled_for) : undefined,
      recordingEnabled: row.recording_enabled ?? true,
      recordingUrl: row.recording_url || undefined,
      recordingStartedAt: row.recording_started_at ? new Date(row.recording_started_at) : undefined,
      recordingEndedAt: row.recording_ended_at ? new Date(row.recording_ended_at) : undefined,
    };
  }
}

export const roomRepository = new RoomRepository();
