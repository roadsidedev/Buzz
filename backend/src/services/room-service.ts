/**
 * Room Service
 * Business logic for room creation and management
 *
 * Integrates:
 * - ERC-8004 agent identity verification
 * - x402 payment processing
 * - Jam room creation and lifecycle
 */

import type { Room, CreateRoomRequest, RoomStatus } from "../../common/types/index.js";
import type { AgentTokenPayload } from "../../common/types/index.js";
import { ValidationError, NotFoundError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { roomRepository } from "../repositories/index.js";
import { getJamService } from "./jam-service.js";
import { getX402PaymentService } from "./x402-payment-service.js";
import type { ERC8004VerificationService } from "./erc8004-verification-service.js";

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
  private erc8004Service: ERC8004VerificationService | null = null;

  constructor(erc8004Service?: ERC8004VerificationService) {
    this.erc8004Service = erc8004Service || null;
  }

  /**
   * Set ERC-8004 verification service (dependency injection)
   */
  setERC8004Service(service: ERC8004VerificationService): void {
    this.erc8004Service = service;
  }

  /**
   * Create a new room
   *
   * Process:
   * 1. Verify host agent is registered on-chain (ERC-8004)
   * 2. Validate spawn fee and room objective
   * 3. Create room record in database
   * 4. Create Jam audio room
   * 5. Return room details
   *
   * @param input - Room creation request with host info
   * @returns Created room
   * @throws ValidationError if validation fails
   * @throws Error if ERC-8004 verification or Jam creation fails
   */
  async createRoom(input: CreateRoomInput): Promise<Room> {
    // 1. VERIFY HOST AGENT IDENTITY (ERC-8004)
    if (this.erc8004Service) {
      try {
        const isVerified = await this.erc8004Service.isAgentOwner(
          input.hostAgentId,
          input.hostAgentId, // Wallet address (placeholder - should come from auth context)
        );

        if (!isVerified) {
          throw new ValidationError("Host agent not verified on ERC-8004", {
            field: "hostAgentId",
            agentId: input.hostAgentId,
            code: "AGENT_NOT_VERIFIED",
          });
        }

        logger.info("Host agent verified on ERC-8004", {
          agentId: input.hostAgentId,
        });
      } catch (err) {
        logger.error("ERC-8004 verification failed", {
          agentId: input.hostAgentId,
          error: err instanceof Error ? err.message : String(err),
        });
        throw new ValidationError("Failed to verify agent identity", {
          code: "VERIFICATION_ERROR",
        });
      }
    }

    // 2. VALIDATE SPAWN FEE
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

    // 3. VALIDATE OBJECTIVE
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

    // 4. CREATE ROOM IN DATABASE
    const roomId = crypto.randomUUID();
    const room = await roomRepository.create({
      id: roomId,
      host_agent_id: input.hostAgentId,
      type: input.type,
      status: "pending",
      objective: input.objective,
      spawn_fee: input.spawnFee,
    });

    logger.info("Room created in database", {
      roomId: room.id,
      hostAgent: input.hostAgentName,
      type: input.type,
      spawnFee: input.spawnFee,
    });

    // 5. CREATE JAM AUDIO ROOM
    try {
      const jamService = getJamService();
      const jamRoom = await jamService.createRoom(roomId, {
        title: `${input.hostAgentName}'s ${input.type} room`,
        description: input.objective,
        hostId: input.hostAgentId,
        roomType: input.type as "debate" | "coding" | "trading" | "research",
        maxParticipants: 50,
        metadata: {
          objective: input.objective,
          spawnFee: input.spawnFee,
        },
      });

      // Update room with Jam details
      await roomRepository.updateJamDetails(roomId, {
        jam_room_id: jamRoom.roomId,
        jam_room_url: jamRoom.roomUrl,
      });

      logger.info("Jam audio room created", {
        roomId,
        jamRoomId: jamRoom.roomId,
        url: jamRoom.roomUrl,
      });
    } catch (err) {
      logger.error("Failed to create Jam room", {
        roomId,
        error: err instanceof Error ? err.message : String(err),
      });
      // Continue - room exists but without Jam
      // TODO: Implement retry logic or fallback
    }

    // 6. CHARGE SPAWN FEE VIA x402
    try {
      const x402Service = getX402PaymentService();
      const payment = await x402Service.chargeSpawnFee(
        input.hostAgentId,
        input.hostAgentId, // TODO: Get actual wallet address from auth context
        roomId,
      );

      // Link payment to room
      await roomRepository.updateSpawnFeePaymentId(roomId, payment.id);

      logger.info("Spawn fee charge initiated", {
        roomId,
        paymentId: payment.id,
        amount: input.spawnFee,
      });

      // Room will remain in 'pending' status until webhook confirms payment
      // At that time, status will be updated to 'live'
    } catch (err) {
      logger.error("Failed to charge spawn fee", {
        roomId,
        error: err instanceof Error ? err.message : String(err),
      });
      // Continue - room created but payment failed
      // TODO: Implement refund logic and room cleanup
    }

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

// Singleton instance - initialized without ERC8004
// Can be updated with dependency injection via setERC8004Service()
export const roomService = new RoomService();
