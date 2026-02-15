/**
 * Room Service
 * Business logic for room creation and management
 */

import type { Room, CreateRoomRequest, RoomStatus } from "../../common/types/index.js";
import type { AgentTokenPayload } from "../../common/types/index.js";
import { ValidationError, NotFoundError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { roomRepository } from "../repositories/index.js";

const MIN_SPAWN_FEE = 25; // $0.25 in cents
const MAX_SPAWN_FEE = 10000; // $100 in cents

interface CreateRoomInput extends CreateRoomRequest {
  hostAgentId: string;
  hostAgentName: string;
}

/**
 * Room Service
 * Handles room creation, state management, and lifecycle
 */
export class RoomService {
  /**
   * Create a new room
   */
  async createRoom(input: CreateRoomInput): Promise<Room> {
    // Validate spawn fee
    if (input.spawnFee < MIN_SPAWN_FEE) {
      throw new ValidationError("Spawn fee is too low", {
        field: "spawnFee",
        provided: input.spawnFee,
        minimum: MIN_SPAWN_FEE,
        code: "SPAWN_FEE_TOO_LOW",
      });
    }

    if (input.spawnFee > MAX_SPAWN_FEE) {
      throw new ValidationError("Spawn fee exceeds maximum", {
        field: "spawnFee",
        provided: input.spawnFee,
        maximum: MAX_SPAWN_FEE,
        code: "SPAWN_FEE_TOO_HIGH",
      });
    }

    // Validate objective
    if (!input.objective || input.objective.length < 10) {
      throw new ValidationError("Objective is too short", {
        field: "objective",
        minimum: 10,
      });
    }

    if (input.objective.length > 500) {
      throw new ValidationError("Objective is too long", {
        field: "objective",
        maximum: 500,
      });
    }

    // Create room in database
    const room = await roomRepository.create({
      id: crypto.randomUUID(),
      host_agent_id: input.hostAgentId,
      type: input.type,
      status: "pending",
      objective: input.objective,
      spawn_fee: input.spawnFee,
    });

    logger.info("Room created", {
      roomId: room.id,
      hostAgent: input.hostAgentName,
      type: input.type,
      spawnFee: input.spawnFee,
    });

    // TODO: Charge spawn fee via x402
    // TODO: Create Jam room
    // TODO: Update room status to 'live' once ready

    return room;
  }

  /**
   * Get room by ID
   */
  async getRoomById(roomId: string): Promise<Room> {
    const room = await roomRepository.getById(roomId);

    if (!room) {
      throw new NotFoundError("room", roomId);
    }

    logger.debug("Room fetched", { roomId });

    return room;
  }

  /**
   * Get live rooms for discovery
   */
  async getLiveRooms(limit: number = 20, offset: number = 0): Promise<Room[]> {
    const rooms = await roomRepository.getLiveRooms(limit, offset);

    logger.debug("Fetching live rooms", { limit, offset, count: rooms.length });

    return rooms;
  }

  /**
   * Get trending rooms
   */
  async getTrendingRooms(
    hours: number = 24,
    limit: number = 10
  ): Promise<Room[]> {
    const rooms = await roomRepository.getTrendingRooms(hours, limit);

    logger.debug("Fetching trending rooms", { hours, limit, count: rooms.length });

    return rooms;
  }

  /**
   * Add participant to room
   */
  async addParticipant(
    roomId: string,
    agentId: string
  ): Promise<void> {
    // Verify room exists
    await this.getRoomById(roomId);

    // Add participant to database
    await roomRepository.addParticipant(roomId, agentId, "speaker");

    logger.info("Agent joined room", { roomId, agentId });
  }

  /**
   * Update room status
   */
  async updateRoomStatus(roomId: string, status: RoomStatus): Promise<void> {
    // Verify room exists
    await this.getRoomById(roomId);

    // Update database
    await roomRepository.updateStatus(roomId, status);

    logger.info("Room status updated", { roomId, status });
  }

  /**
   * Close room
   */
  async closeRoom(roomId: string): Promise<void> {
    // Verify room exists
    await this.getRoomById(roomId);

    // Update status
    await this.updateRoomStatus(roomId, "completed");

    // TODO: End room on Jam side
    // TODO: Distribute revenue to host and participants

    logger.info("Room closed", { roomId });
  }
}

export const roomService = new RoomService();
