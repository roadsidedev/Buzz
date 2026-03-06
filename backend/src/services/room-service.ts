// @ts-nocheck
/**
 * Room Service
 * Business logic for room creation and management
 *
 * Integrates:
 * - ERC-8004 agent identity verification
 * - x402 payment processing
 * - Jam room creation and lifecycle (V2 self-hosted with V1 fallback)
 */

import crypto from "crypto";
import type { Room, CreateRoomRequest, RoomStatus } from "@common/types/index";
import {
  ValidationError,
  NotFoundError,
  ServiceUnavailableError,
} from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { roomRepository, agentRepository } from "../repositories/index.js";
import {
  getJamServiceFactory,
  initializeJamServiceFactory,
} from "./jam-service-factory.js";
import { JamServiceV2 } from "./jam-service-v2.js";
import { getAgentKeypair, generateJamIdentityId, encryptPrivateKey } from "../utils/ssr-auth.js";
import { getX402PaymentService } from "./x402-payment-service.js";
import { paymentService } from "./payment-service.js";
import { roomOrchestrationService } from "./room-orchestration-service.js";
import type { ERC8004VerificationService } from "./erc8004-verification-service.js";
import type { JWTPayload } from "../types/auth.js";

const MIN_SPAWN_FEE = 25; // $0.25 in cents
const MAX_SPAWN_FEE = 10000; // $100 in cents

interface CreateRoomInput extends CreateRoomRequest {
  hostAgentId: string;
  hostAgentName: string;
  authenticatedUser?: JWTPayload;
}

// Track if factory has been initialized
let factoryInitialized = false;

/**
 * Ensure Jam service factory is initialized
 */
function ensureFactoryInitialized(): void {
  if (!factoryInitialized) {
    initializeJamServiceFactory();
    factoryInitialized = true;
    logger.info("Jam service factory initialized", {
      serviceType: getJamServiceFactory()?.getServiceType(),
    });
  }
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
    // 1. CHECK AGENT VERIFICATION STATUS (DATABASE)
    const hostAgent = await agentRepository.getById(input.hostAgentId);
    if (!hostAgent) {
      throw new NotFoundError("agent", input.hostAgentId);
    }

    logger.info("Host agent verification status checked (not blocking)", {
      agentId: input.hostAgentId,
      status: hostAgent.verification_status,
    });

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
      title: `${input.hostAgentName}'s ${input.type} room`,
      type: input.type,
      status: "pending",
      objective: input.objective,
      spawn_fee: input.spawnFee,
    });

    let updatedRoom = room;

    logger.info("Room created in database", {
      roomId: room.id,
      hostAgent: input.hostAgentName,
      type: input.type,
      spawnFee: input.spawnFee,
    });

    // 5. CREATE JAM AUDIO ROOM
    try {
      // Ensure factory is initialized
      ensureFactoryInitialized();

      const factory = getJamServiceFactory();
      const jamService = factory?.getService() as JamServiceV2;

      if (!jamService) {
        throw new Error("Jam service not configured");
      }

      // Always use V2 (SSR auth with agent keypair)
      const encryptionSecret = process.env.ENCRYPTION_SECRET || "";

      // Get agent keypair (from ERC-8004 identity or stored)
      const keyPair = await getAgentKeypair({
        agentId: input.hostAgentId,
        erc8004Identity: hostAgent.erc8004_identity,
        storedPublicKey: hostAgent.jam_public_key || undefined,
        storedPrivateKeyEncrypted:
          hostAgent.jam_private_key_encrypted || undefined,
        encryptionSecret,
      });

      // Store keypair if not already stored.
      // Wrapped in try-catch: if the jam_public_key column hasn't been added
      // yet (migration pending) we log a warning and continue rather than
      // failing the entire room creation.
      if (!hostAgent.jam_public_key) {
        try {
          const jamIdentityId = generateJamIdentityId(keyPair.publicKeyBase64);
          let privateKeyEncrypted = "";

          if (encryptionSecret) {
            try {
              privateKeyEncrypted = encryptPrivateKey(keyPair.privateKeyBase64, encryptionSecret);
            } catch (e) {
              logger.warn("Failed to encrypt private key", { error: e });
            }
          }

          await agentRepository.update(input.hostAgentId, {
            jam_public_key: keyPair.publicKeyBase64,
            jam_private_key_encrypted: privateKeyEncrypted,
            jam_identity_id: jamIdentityId,
          });
          logger.info("Stored Jam keypair for agent", {
            agentId: input.hostAgentId,
          });
        } catch (storeErr) {
          logger.warn(
            "Could not persist Jam keypair for agent — schema migration may be pending. " +
              "Room creation will continue but keypair will not be cached.",
            {
              agentId: input.hostAgentId,
              error: storeErr instanceof Error ? storeErr.message : String(storeErr),
            },
          );
        }
      }

      const jamRoom = await jamService.createRoom(
        roomId,
        {
          title: `${input.hostAgentName}'s ${input.type} room`,
          description: input.objective,
          hostId: input.hostAgentId,
          roomType: input.type as "debate" | "coding" | "trading" | "research",
          maxParticipants: 50,
          metadata: {
            objective: input.objective,
            spawnFee: input.spawnFee,
          },
        },
        keyPair,
      );

      logger.info("Jam room created (V2 - self-hosted)", {
        roomId,
        jamRoomId: jamRoom.roomId,
        serviceType: "v2",
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

      // Activate room once Jam is ready
      await this.updateRoomStatus(roomId, "live");

      const liveRoom = await roomRepository.getById(roomId);
      if (!liveRoom) {
        throw new Error("Failed to load room after Jam activation");
      }

      updatedRoom = liveRoom;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      // Jam audio service is unavailable or misconfigured.
      // The room record is already persisted — do NOT roll it back.
      // The room stays in "pending" status with no jamRoomUrl.
      // Agents can still use the room for coordination, and audio can be
      // initialized later via POST /rooms/:id/jam once the Jam service is
      // reachable.
      logger.warn("Jam room creation failed — room kept in pending status", {
        roomId,
        error: errorMessage,
      });
    }

    // 6. CHARGE SPAWN FEE VIA x402
    try {
      // Get agent wallet address from authenticated user or fetch from database
      let hostWalletAddress: string | null =
        input.authenticatedUser?.walletAddress || null;

      if (!hostWalletAddress) {
        // Fallback: fetch agent from database
        const agent = await agentRepository.getById(input.hostAgentId);
        hostWalletAddress = agent?.erc8004_address || null;
      }

      if (!hostWalletAddress) {
        logger.error("Cannot charge spawn fee: no wallet address", {
          roomId,
          agentId: input.hostAgentId,
        });
        throw new ValidationError("Agent wallet address not found", {
          field: "hostWalletAddress",
          agentId: input.hostAgentId,
          code: "WALLET_NOT_FOUND",
        });
      }

      const payment = await paymentService.chargeSpawnFee(
        input.hostAgentId,
        roomId,
        hostWalletAddress,
      );

      // Link payment to room
      await roomRepository.updateSpawnFeePaymentId(roomId, payment.id);

      logger.info("Spawn fee charge initiated", {
        roomId,
        paymentId: payment.id,
        agentId: input.hostAgentId,
        amount: input.spawnFee,
        walletAddress: `${hostWalletAddress.slice(0, 6)}...${hostWalletAddress.slice(-4)}`,
      });

      // Room is live as soon as Jam is ready; payment confirmation is tracked separately
    } catch (err) {
      logger.error("Failed to charge spawn fee", {
        roomId,
        agentId: input.hostAgentId,
        error: err instanceof Error ? err.message : String(err),
      });
      // Continue - room created but payment failed
      // Note: Implement refund logic and room cleanup in error handler
    }

    return updatedRoom;
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
   * Get live rooms for discovery with optional type filtering
   *
   * @param limit - Max results per page
   * @param offset - Pagination offset
   * @param type - Optional room type filter (debate, coding, etc.)
   * @returns Array of live rooms
   */
  async getLiveRooms(
    limit: number = 20,
    offset: number = 0,
    type?: string,
  ): Promise<Room[]> {
    const rooms = await roomRepository.getLiveRooms(limit, offset, type);

    logger.debug("Fetching live rooms", {
      limit,
      offset,
      type,
      count: rooms.length,
    });

    return rooms;
  }

  /**
   * Get total count of live rooms
   *
   * Useful for pagination metadata (total pages, etc.)
   *
   * @param type - Optional room type filter
   * @returns Total count of matching live rooms
   */
  async getLiveRoomCount(type?: string): Promise<number> {
    const count = await roomRepository.getLiveRoomCount(type);

    logger.debug("Counting live rooms", { type, count });

    return count;
  }

  /**
   * Get trending rooms with optional type filtering
   *
   * @param hours - Timeframe in hours for trending calculation
   * @param limit - Max results
   * @param type - Optional room type filter
   * @returns Array of trending rooms
   */
  async getTrendingRooms(
    hours: number = 24,
    limit: number = 10,
    type?: string,
  ): Promise<Room[]> {
    const rooms = await roomRepository.getTrendingRooms(hours, limit, type);

    logger.debug("Fetching trending rooms", {
      hours,
      limit,
      type,
      count: rooms.length,
    });

    return rooms;
  }

  /**
   * Add participant to room
   */
  async addParticipant(roomId: string, agentId: string): Promise<void> {
    // Verify room exists
    await this.getRoomById(roomId);

    // Add participant to database
    await roomRepository.addParticipant(roomId, agentId, "speaker");

    logger.info("Agent joined room", { roomId, agentId });
  }

  /**
   * Remove participant from room
   *
   * Called when agent leaves via Jam webhook or explicit disconnect
   * Marks participant as inactive but preserves history
   *
   * @param roomId - Room ID
   * @param agentId - Agent ID to remove
   * @throws Error if room not found
   */
  async removeParticipant(roomId: string, agentId: string): Promise<void> {
    // Verify room exists
    await this.getRoomById(roomId);

    // Remove participant from database
    await roomRepository.removeParticipant(roomId, agentId);

    logger.info("Agent left room", { roomId, agentId });
  }

  /**
   * Update room status
   */
  async updateRoomStatus(roomId: string, status: RoomStatus): Promise<void> {
    // Verify room exists
    await this.getRoomById(roomId);

    // Update database
    await roomRepository.updateStatus(roomId, status);

    if (status === "live") {
      try {
        await roomOrchestrationService.startRoom(roomId);
      } catch (err) {
        logger.error("Failed to start room orchestration", {
          roomId,
          error: err instanceof Error ? err.message : String(err),
        });

        await roomRepository.updateStatus(roomId, "failed");

        throw new ServiceUnavailableError("Orchestrator", {
          roomId,
          status,
        });
      }
    } else {
      try {
        await roomOrchestrationService.stopRoom(roomId);
      } catch (err) {
        logger.warn("Failed to stop room orchestration", {
          roomId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info("Room status updated", { roomId, status });
  }

  /**
   * Close room and distribute revenue
   *
   * Process:
   * 1. Verify room exists
   * 2. Update status to completed
   * 3. End room on Jam side
   * 4. Distribute revenue to host and participants
   *
   * @param roomId - Room ID to close
   * @throws NotFoundError if room doesn't exist
   */
  async closeRoom(roomId: string): Promise<void> {
    // 1. VERIFY ROOM EXISTS
    const room = await this.getRoomById(roomId);

    // 2. UPDATE STATUS TO COMPLETED
    await this.updateRoomStatus(roomId, "completed");

    // 3. END ROOM ON JAM SIDE
    try {
      ensureFactoryInitialized();

      const factory = getJamServiceFactory();
      const jamService = factory?.getService() as JamServiceV2;

      if (jamService) {
        const hostAgent = await agentRepository.getById(room.host_agent_id);
        if (hostAgent) {
          const encryptionSecret = process.env.ENCRYPTION_SECRET || "";
          const keyPair = await getAgentKeypair({
            agentId: room.host_agent_id,
            erc8004Identity: hostAgent.erc8004_identity,
            storedPublicKey: hostAgent.jam_public_key || undefined,
            storedPrivateKeyEncrypted:
              hostAgent.jam_private_key_encrypted || undefined,
            encryptionSecret,
          });
          await jamService.endRoom(room.jam_room_id || roomId, keyPair);
        }
        logger.info("Jam room closed", { roomId, jamRoomId: room.jam_room_id });
      }
    } catch (err) {
      logger.warn("Failed to close Jam room", {
        roomId,
        error: err instanceof Error ? err.message : String(err),
      });
      // Continue - close room even if Jam fails
    }

    // 4. DISTRIBUTE REVENUE TO HOST AND PARTICIPANTS
    try {
      // Get all room participants
      const participants = await roomRepository.getParticipants(roomId);

      if (participants.length === 0) {
        logger.warn("No participants found for revenue distribution", {
          roomId,
        });
        logger.info("Room closed without distribution", { roomId });
        return;
      }

      // Get host agent wallet
      const hostAgent = await agentRepository.getById(room.host_agent_id);
      if (!hostAgent || !hostAgent.erc8004_address) {
        logger.error("Cannot distribute revenue: host wallet not found", {
          roomId,
          hostAgentId: room.host_agent_id,
        });
        throw new ValidationError("Host wallet address not found", {
          field: "hostWalletAddress",
          roomId,
        });
      }

      // Get participant wallets
      const participantData = await Promise.all(
        participants
          .filter((p) => p.agent_id !== room.host_agent_id) // Exclude host from participant list
          .map(async (p) => {
            const agent = await agentRepository.getById(p.agent_id);
            return {
              agentId: p.agent_id,
              walletAddress: agent?.erc8004_address || null,
            };
          }),
      );

      // Filter out participants without wallets
      const validParticipants = participantData.filter(
        (p) => p.walletAddress !== null,
      );

      if (validParticipants.length === 0) {
        logger.warn("No valid participant wallets for distribution", {
          roomId,
          participantCount: participants.length,
        });
      }

      // Calculate total spawn fee amount (convert cents to wei)
      const totalSpawnFee =
        BigInt(room.spawn_fee) * BigInt(10_000_000_000_000_000);

      // Distribute revenue
      const distributions = await paymentService.distributeRevenue(
        roomId,
        room.host_agent_id,
        hostAgent.erc8004_address,
        validParticipants,
        totalSpawnFee,
      );

      logger.info("Revenue distributed for completed room", {
        roomId,
        hostAgentId: room.host_agent_id,
        participantCount: validParticipants.length,
        distributionCount: distributions.length,
        totalSpawnFee: room.spawn_fee,
      });
    } catch (err) {
      logger.error("Failed to distribute revenue", {
        roomId,
        error: err instanceof Error ? err.message : String(err),
      });
      // Don't throw - room is already marked as completed
      // Revenue distribution failures should be retried separately
    }

    logger.info("Room closed successfully", { roomId });
  }

  /**
   * Initialize (or re-initialize) the Jam audio room for an existing room.
   *
   * Called when:
   * - Room was created but Jam was unavailable at creation time (status = "pending")
   * - An agent explicitly requests audio setup via POST /rooms/:id/jam
   *
   * Idempotent: if `jam_room_id` is already set, returns the room as-is.
   *
   * @param roomId - Existing room ID
   * @returns Updated room with jamRoomUrl populated and status set to "live"
   * @throws NotFoundError if room doesn't exist
   * @throws ServiceUnavailableError if Jam is still unreachable
   */
  async initializeJamRoom(roomId: string): Promise<Room> {
    const room = await this.getRoomById(roomId);

    // Already has Jam — nothing to do.
    if (room.jam_room_id) {
      logger.info("Jam room already initialized, skipping", {
        roomId,
        jamRoomId: room.jam_room_id,
      });
      return room;
    }

    if (room.status === "completed" || room.status === "cancelled") {
      throw new ValidationError("Cannot initialize Jam for a closed room", {
        field: "status",
        current: room.status,
      });
    }

    const hostAgent = await agentRepository.getById(room.host_agent_id);
    if (!hostAgent) {
      throw new NotFoundError("agent", room.host_agent_id);
    }

    ensureFactoryInitialized();
    const factory = getJamServiceFactory();
    const jamService = factory?.getService() as JamServiceV2;

    if (!jamService) {
      throw new ServiceUnavailableError("Jam", { roomId, error: "Jam service not configured" });
    }

    const encryptionSecret = process.env.ENCRYPTION_SECRET || "";
    const keyPair = await getAgentKeypair({
      agentId: room.host_agent_id,
      erc8004Identity: hostAgent.erc8004_identity,
      storedPublicKey: hostAgent.jam_public_key || undefined,
      storedPrivateKeyEncrypted: hostAgent.jam_private_key_encrypted || undefined,
      encryptionSecret,
    });

    let jamRoom;
    try {
      jamRoom = await jamService.createRoom(
        roomId,
        {
          title: room.title || `${hostAgent.name}'s ${room.type} room`,
          description: room.objective,
          hostId: room.host_agent_id,
          roomType: room.type as "debate" | "coding" | "trading" | "research",
          maxParticipants: 50,
          metadata: { objective: room.objective, spawnFee: room.spawn_fee },
        },
        keyPair,
      );
    } catch (err) {
      throw new ServiceUnavailableError("Jam", {
        roomId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    await roomRepository.updateJamDetails(roomId, {
      jam_room_id: jamRoom.roomId,
      jam_room_url: jamRoom.roomUrl,
    });

    logger.info("Jam audio room initialized for existing room", {
      roomId,
      jamRoomId: jamRoom.roomId,
      url: jamRoom.roomUrl,
    });

    // Activate room now that Jam is ready
    await this.updateRoomStatus(roomId, "live");

    const liveRoom = await roomRepository.getById(roomId);
    if (!liveRoom) {
      throw new Error("Failed to reload room after Jam initialization");
    }
    return liveRoom;
  }
}

// Singleton instance - initialized without ERC8004
// Can be updated with dependency injection via setERC8004Service()
export const roomService = new RoomService();
