/**
 * Room State Store
 *
 * Port of orchestrator/src/services/room_state_manager.py
 *
 * Persists room orchestration state in Redis using the EXACT same key names
 * as the Python service so that any in-flight keys written before the cut-over
 * are still readable by this module.
 *
 * Key schema (wire-compatible with Python):
 *   room_state:{roomId}          → JSON blob (RoomStateData)  TTL 48h
 *   room_index                   → sorted set of active room IDs
 *   room_participants:{roomId}   → hash of participant data
 *   room_messages:{roomId}       → hash of message data
 */

import type { RedisClientType } from "redis";
import type { RoomStateData } from "./types.js";
import { logger } from "../../utils/logger.js";

// ─── Key helpers ──────────────────────────────────────────────────────────────

const ROOM_STATE_KEY = (id: string) => `room_state:${id}`;
const ROOM_INDEX_KEY = "room_index";
const ROOM_PARTICIPANTS_KEY = (id: string) => `room_participants:${id}`;
const ROOM_MESSAGES_KEY = (id: string) => `room_messages:${id}`;

const DEFAULT_TTL_SECONDS = 48 * 60 * 60; // 48 hours

// ─── RoomStateStore ───────────────────────────────────────────────────────────

export class RoomStateStore {
  constructor(private readonly redis: RedisClientType | null) {}

  async createRoom(state: RoomStateData): Promise<void> {
    if (!this.redis) return;
    try {
      const key = ROOM_STATE_KEY(state.roomId);
      await this.redis.setEx(key, DEFAULT_TTL_SECONDS, JSON.stringify(this._serialize(state)));
      // Add to room index with timestamp score for ordering
      await this.redis.zAdd(ROOM_INDEX_KEY, { score: Date.now(), value: state.roomId });
      logger.debug("Room state created in Redis", { roomId: state.roomId });
    } catch (err) {
      logger.error("Failed to create room state in Redis", {
        roomId: state.roomId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async getRoom(roomId: string): Promise<RoomStateData | null> {
    if (!this.redis) return null;
    try {
      const raw = await this.redis.get(ROOM_STATE_KEY(roomId));
      if (!raw) return null;
      return this._deserialize(JSON.parse(raw));
    } catch (err) {
      logger.warn("Failed to get room state from Redis", {
        roomId,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  async updateRoom(state: RoomStateData): Promise<void> {
    if (!this.redis) return;
    try {
      const key = ROOM_STATE_KEY(state.roomId);
      // Preserve remaining TTL on update
      const ttl = await this.redis.ttl(key);
      const effectiveTtl = ttl > 0 ? ttl : DEFAULT_TTL_SECONDS;
      await this.redis.setEx(key, effectiveTtl, JSON.stringify(this._serialize(state)));
    } catch (err) {
      logger.warn("Failed to update room state in Redis", {
        roomId: state.roomId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async deleteRoom(roomId: string): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.del(ROOM_STATE_KEY(roomId));
      await this.redis.zRem(ROOM_INDEX_KEY, roomId);
    } catch (err) {
      logger.warn("Failed to delete room state from Redis", { roomId });
    }
  }

  async getAllActiveRoomIds(): Promise<string[]> {
    if (!this.redis) return [];
    try {
      return await this.redis.zRange(ROOM_INDEX_KEY, 0, -1);
    } catch {
      return [];
    }
  }

  async storeParticipant(roomId: string, agentId: string, data: object): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.hSet(ROOM_PARTICIPANTS_KEY(roomId), agentId, JSON.stringify(data));
      await this.redis.expire(ROOM_PARTICIPANTS_KEY(roomId), DEFAULT_TTL_SECONDS);
    } catch (err) {
      logger.warn("Failed to store participant in Redis", { roomId, agentId });
    }
  }

  async storeMessage(roomId: string, messageId: string, data: object): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.hSet(ROOM_MESSAGES_KEY(roomId), messageId, JSON.stringify(data));
      await this.redis.expire(ROOM_MESSAGES_KEY(roomId), DEFAULT_TTL_SECONDS);
    } catch (err) {
      logger.warn("Failed to store message in Redis", { roomId, messageId });
    }
  }

  // ─── Serialisation (wire-compatible with Python _serialize_room_state) ──────
  //
  // Python produces a top-level object with shape:
  //   { room: { id, host_agent_id, room_type, ... }, message_queue, turn_history,
  //     last_speaker_id, transcript, contract_satisfaction }
  //
  // We match that shape exactly to allow zero-downtime migration.

  private _serialize(state: RoomStateData): Record<string, unknown> {
    // Convert transcript entries to snake_case for Python wire compatibility.
    const snakeTranscript = state.transcript.map((t) => ({
      turn: t.turn,
      agent_id: t.agentId,
      message_id: t.messageId,
      text: t.text,
      score: t.score,
      timestamp: t.timestamp,
    }));

    return {
      room: {
        id: state.roomId,
        host_agent_id: state.hostAgentId,
        room_type: state.roomType,
        status: state.status,
        objective: state.roomObjective,
        type_config: state.typeConfig,
        turn_count: state.turnCount,
        completion_level: state.completionLevel,
        started_at: state.startedAt,
        completed_at: state.completedAt,
      },
      message_queue: state.messageQueue,
      // turn_history mirrors transcript — both must be snake_case for Python compatibility.
      turn_history: snakeTranscript,
      last_speaker_id: state.lastSpeakerId,
      transcript: snakeTranscript,
      contract_satisfaction: state.contractSatisfaction,
    };
  }

  private _deserialize(raw: Record<string, unknown>): RoomStateData {
    const room = (raw.room ?? {}) as Record<string, unknown>;
    const transcript = ((raw.transcript ?? []) as Array<Record<string, unknown>>).map((t) => ({
      turn: t.turn as number,
      agentId: (t.agent_id ?? t.agentId) as string,
      messageId: (t.message_id ?? t.messageId) as string,
      text: t.text as string,
      score: t.score as number,
      timestamp: t.timestamp as string,
    }));

    return {
      roomId: (room.id ?? "") as string,
      hostAgentId: (room.host_agent_id ?? "") as string,
      roomType: (room.room_type ?? "custom") as string,
      status: (room.status ?? "pending") as string,
      roomObjective: (room.objective ?? "") as string,
      typeConfig: (room.type_config ?? {}) as Record<string, unknown>,
      turnCount: (room.turn_count ?? 0) as number,
      completionLevel: (room.completion_level ?? "minimum") as RoomStateData["completionLevel"],
      lastSpeakerId: (raw.last_speaker_id ?? null) as string | null,
      messageQueue: (raw.message_queue ?? []) as string[],
      transcript,
      contractSatisfaction: (raw.contract_satisfaction ?? 0) as number,
      startedAt: (room.started_at ?? null) as string | null,
      completedAt: (room.completed_at ?? null) as string | null,
    };
  }
}
