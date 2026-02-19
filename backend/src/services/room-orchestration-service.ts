// @ts-nocheck
/**
 * Room Orchestration Service
 *
 * Main orchestration loop that manages all live rooms:
 * - Monitors active rooms
 * - Runs turn selection every 3 seconds
 * - Checks completion every 10 seconds
 * - Closes rooms when contracts fulfilled
 * - Triggers payment distribution (Day 8)
 *
 * Part of Day 7: Task 9 - Main Orchestration Loop
 */

import type { Room, RoomStatus } from "@common/types/index";
import { roomRepository, messageRepository } from "../repositories/index.js";
import { turnManagementService } from "./turn-management-service.js";
import { outputContractService } from "./output-contract-service.js";
import { agentStatisticsService } from "./agent-statistics-service.js";
import { revenueDistributionService } from "./revenue-distribution-service.js";
import { logger } from "../utils/logger.js";

// ===================================================================
// Configuration
// ===================================================================

const COMPLETION_CHECK_INTERVAL =
  parseInt(process.env.COMPLETION_CHECK_INTERVAL_SECONDS || "10", 10) * 1000;

const ORCHESTRA_CHECK_INTERVAL =
  parseInt(process.env.ORCHESTRA_CHECK_INTERVAL_SECONDS || "5", 10) * 1000; // Check for new live rooms

const ROOM_TIMEOUT_SECONDS = parseInt(
  process.env.ROOM_TIMEOUT_SECONDS || "600",
  10,
); // 10 minutes

// ===================================================================
// Type Definitions
// ===================================================================

interface ActiveRoom {
  roomId: string;
  turnManagementActive: boolean;
  completionCheckTimerId?: NodeJS.Timeout;
  lastCompletionCheck?: Date;
  completionPercentage: number;
}

// ===================================================================
// Room Orchestration Service
// ===================================================================

export class RoomOrchestrationService {
  private activeRooms = new Map<string, ActiveRoom>();
  private orchestratorTimerId?: NodeJS.Timeout;
  private isRunning = false;

  /**
   * Start the main orchestration loop
   *
   * Discovers live rooms and manages them
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn("Room orchestration already running");
      return;
    }

    this.isRunning = true;

    logger.info("Starting room orchestration service");

    // Start discovery loop (check for new live rooms every 5s)
    this.orchestratorTimerId = setInterval(
      () =>
        this._discoverAndManageRooms().catch((err) => {
          logger.error("Error in orchestrator loop", {
            error: err instanceof Error ? err.message : String(err),
          });
        }),
      ORCHESTRA_CHECK_INTERVAL,
    );

    // Immediate check
    await this._discoverAndManageRooms();
  }

  /**
   * Stop the main orchestration loop
   *
   * Gracefully shuts down all room timers
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info("Stopping room orchestration service");

    // Clear main loop timer
    if (this.orchestratorTimerId) {
      clearInterval(this.orchestratorTimerId);
    }

    // Stop all room management
    for (const [roomId, room] of this.activeRooms.entries()) {
      await this.stopRoom(roomId);
    }

    this.isRunning = false;
    logger.info("Room orchestration stopped");
  }

  /**
   * Start management for a specific room
   *
   * Sets up turn management and completion checking
   */
  async startRoom(roomId: string): Promise<void> {
    // Check if already managing
    if (this.activeRooms.has(roomId)) {
      return;
    }

    logger.info("Starting orchestration for room", { roomId });

    try {
      // 1. START TURN MANAGEMENT
      await turnManagementService.startTurnManagement(roomId);

      // 2. SET UP COMPLETION CHECK LOOP
      const completionCheckId = setInterval(
        () =>
          this._checkCompletion(roomId).catch((err) => {
            logger.error("Error checking completion", {
              roomId,
              error: err instanceof Error ? err.message : String(err),
            });
          }),
        COMPLETION_CHECK_INTERVAL,
      );

      // 3. ADD TO ACTIVE ROOMS
      const room: ActiveRoom = {
        roomId,
        turnManagementActive: true,
        completionCheckTimerId: completionCheckId,
        completionPercentage: 0,
      };

      this.activeRooms.set(roomId, room);

      logger.info("Room orchestration started", {
        roomId,
        completionCheckInterval: COMPLETION_CHECK_INTERVAL / 1000,
      });
    } catch (err) {
      logger.error("Failed to start room orchestration", {
        roomId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  /**
   * Stop management for a specific room
   *
   * Cleans up timers and stops turn management
   */
  async stopRoom(roomId: string): Promise<void> {
    const room = this.activeRooms.get(roomId);
    if (!room) {
      return;
    }

    logger.info("Stopping orchestration for room", { roomId });

    // 1. CLEAR COMPLETION CHECK TIMER
    if (room.completionCheckTimerId) {
      clearInterval(room.completionCheckTimerId);
    }

    // 2. STOP TURN MANAGEMENT
    if (room.turnManagementActive) {
      turnManagementService.stopTurnManagement(roomId);
    }

    // 3. REMOVE FROM ACTIVE ROOMS
    this.activeRooms.delete(roomId);

    logger.info("Room orchestration stopped", { roomId });
  }

  /**
   * Get status of a room
   */
  getRoomStatus(roomId: string): ActiveRoom | undefined {
    return this.activeRooms.get(roomId);
  }

  /**
   * Get all active rooms
   */
  getActiveRooms(): string[] {
    return Array.from(this.activeRooms.keys());
  }

  /**
   * Internal: Discover and manage live rooms
   *
   * Called every 5 seconds to:
   * 1. Find live rooms not yet managed
   * 2. Start orchestration for new rooms
   * 3. Stop orchestration for completed rooms
   */
  private async _discoverAndManageRooms(): Promise<void> {
    try {
      // 1. GET ALL LIVE ROOMS
      const liveRooms = await roomRepository.getLiveRooms(1000, 0);

      // 2. START ORCHESTRATION FOR NEW ROOMS
      for (const room of liveRooms) {
        if (!this.activeRooms.has(room.id)) {
          try {
            await this.startRoom(room.id);
          } catch (err) {
            logger.warn("Failed to start room orchestration", {
              roomId: room.id,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }

      // 3. CLEAN UP COMPLETED/CANCELLED ROOMS
      const activeRoomIds = Array.from(this.activeRooms.keys());
      for (const roomId of activeRoomIds) {
        const room = await roomRepository.getById(roomId);
        if (!room) {
          await this.stopRoom(roomId);
          continue;
        }

        // If room no longer live, stop orchestration
        if (room.status !== "live") {
          await this.stopRoom(roomId);
        }
      }

      logger.debug("Discovery cycle complete", {
        liveRoomsCount: liveRooms.length,
        activeRoomsCount: this.activeRooms.size,
      });
    } catch (err) {
      logger.error("Error in discovery cycle", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Internal: Check room completion status
   *
   * Called every 10 seconds per room
   */
  private async _checkCompletion(roomId: string): Promise<void> {
    try {
      // 1. GET ROOM
      const room = await roomRepository.getById(roomId);
      if (!room) {
        await this.stopRoom(roomId);
        return;
      }

      // 2. CHECK TIMEOUT (no activity)
      if (room.startedAt) {
        const elapsed = Date.now() - room.startedAt.getTime();
        const timeoutMs = ROOM_TIMEOUT_SECONDS * 1000;

        if (elapsed > timeoutMs && room.turnCount === 0) {
          logger.warn("Room timeout: no turns completed", {
            roomId,
            elapsedSeconds: elapsed / 1000,
            timeoutSeconds: ROOM_TIMEOUT_SECONDS,
          });

          // TODO: Handle timeout (refund, close room, notify)
          // await this._handleRoomTimeout(roomId);
          return;
        }
      }

      // 3. CHECK OUTPUT CONTRACT
      const completion = await outputContractService.checkCompletion(roomId);

      // 4. UPDATE PROGRESS
      if (
        completion.completionPercentage !==
        (this.activeRooms.get(roomId)?.completionPercentage || 0)
      ) {
        await roomRepository.updateCompletionPercentage(
          roomId,
          completion.completionPercentage,
        );

        // TODO: Emit WebSocket event
        // emitRoomCompletion(io, roomId, completion);
      }

      // 5. CHECK IF COMPLETE
      if (completion.suggestedAction === "close" && completion.minimumMet) {
        logger.info("Room meets completion criteria", {
          roomId,
          completionLevel: completion.completionLevel,
          percentage: completion.completionPercentage,
        });

        await this._closeRoom(roomId, completion.completionLevel);
      }
    } catch (err) {
      logger.error("Error checking completion", {
        roomId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Internal: Close a room and trigger payment distribution
   *
   * Called when room meets output contract
   */
  private async _closeRoom(
    roomId: string,
    completionLevel: "minimum" | "standard" | "exceptional",
  ): Promise<void> {
    try {
      logger.info("Closing room", {
        roomId,
        completionLevel,
      });

      // 1. STOP ORCHESTRATION
      await this.stopRoom(roomId);

      // 2. UPDATE AGENT STATISTICS
      try {
        const stats = await agentStatisticsService.updateRoomStatistics(roomId);
        logger.info("Agent statistics updated", {
          roomId,
          agentCount: stats.length,
        });
      } catch (err) {
        logger.error("Failed to update agent statistics", {
          roomId,
          error: err instanceof Error ? err.message : String(err),
        });
        // Continue despite stats error
      }

      // 3. TRIGGER REVENUE DISTRIBUTION
      try {
        // TODO: Get actual total revenue from spawn fee + subscriber payments
        // For MVP, assume spawn fee is the only revenue
        const room = await roomRepository.getById(roomId);
        if (room && room.spawnFee > 0) {
          // Convert spawn fee to bigint (assuming it's in cents, multiply by 10^8 for wei)
          const totalRevenue = BigInt(room.spawnFee) * BigInt(10 ** 8);

          const distribution =
            await revenueDistributionService.distributeRevenue(
              roomId,
              totalRevenue,
            );

          logger.info("Revenue distributed", {
            roomId,
            hostAmount: distribution.hostAmount.toString(),
            participantAmount: distribution.participantAmount.toString(),
            platformAmount: distribution.platformAmount.toString(),
          });
        }
      } catch (err) {
        logger.error("Failed to distribute revenue", {
          roomId,
          error: err instanceof Error ? err.message : String(err),
        });
        // Continue despite payment error
      }

      // 4. UPDATE ROOM STATUS
      await roomRepository.updateStatus(roomId, "completed");

      // 5. TODO: EMIT ROOM COMPLETED EVENT
      // const room = await roomRepository.getById(roomId);
      // const messages = await messageRepository.getByRoom(roomId);
      // emitRoomCompleted(io, roomId, {
      //   roomId,
      //   completionLevel,
      //   totalTurns: room?.turnCount || 0,
      //   transcript: messages.filter(m => m.status === 'played'),
      // });

      logger.info("Room closed successfully", {
        roomId,
        completionLevel,
      });
    } catch (err) {
      logger.error("Error closing room", {
        roomId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Internal: Handle room timeout
   *
   * Called when room exceeds time limit without progress
   */
  private async _handleRoomTimeout(roomId: string): Promise<void> {
    try {
      logger.warn("Handling room timeout", { roomId });

      // 1. STOP ORCHESTRATION
      await this.stopRoom(roomId);

      // 2. UPDATE ROOM STATUS
      await roomRepository.updateStatus(roomId, "failed");

      // 3. TODO: ISSUE REFUND
      // await paymentService.issueRefund(roomId);

      // 4. TODO: NOTIFY AGENTS
      // emitRoomTimeout(io, roomId);

      logger.info("Room timeout handled", { roomId });
    } catch (err) {
      logger.error("Error handling room timeout", {
        roomId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

/**
 * Singleton instance
 */
export const roomOrchestrationService = new RoomOrchestrationService();
