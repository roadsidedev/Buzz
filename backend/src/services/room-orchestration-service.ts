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
import { paymentService } from "./payment-service.js";

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
   * Discovers live rooms, manages them, and runs startup reconciliation
   * to fix any rooms stuck in invalid states from a previous crash.
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn("Room orchestration already running");
      return;
    }

    this.isRunning = true;

    logger.info("Starting room orchestration service");

    // Run startup reconciliation to fix stuck rooms
    await this._reconcileStuckRooms();

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
   * Startup reconciliation: fix rooms stuck in invalid states from a previous crash.
   *
   * Handles:
   * - 'live' rooms with stale heartbeat (>60s) → transition to 'ended'
   * - 'ended' rooms with recording_url → transition to 'closed' with recording_available
   * - 'pending' rooms older than 10 minutes → transition to 'failed'
   */
  private async _reconcileStuckRooms(): Promise<void> {
    try {
      logger.info("Running startup reconciliation for stuck rooms");

      // 1. Stale live rooms: host disconnected during a previous server run
      const staleLive = await roomRepository.getRoomsWithStaleHeartbeat(60);
      for (const room of staleLive) {
        logger.info("Reconcile: ending stale live room", { roomId: room.id });
        await roomRepository.updateStatus(room.id, "ended");
        if (room.recordingUrl) {
          await roomRepository.setRecordingAvailable(room.id);
        }
      }

      // 2. Ended rooms with recording: mark as closed
      const endedWithRecording = await roomRepository.getRoomsWithStaleHeartbeat(99999999);
      // Use direct query instead — find rooms with status 'ended' that have recording_url
      try {
        const { query: dbQuery } = await import("../config/database.js");
        const stuckClosed = await dbQuery<{ id: string }>(`
          SELECT id FROM room
          WHERE status = 'ended' AND recording_url IS NOT NULL AND recording_available = FALSE
        `);
        for (const row of stuckClosed) {
          logger.info("Reconcile: closing ended room with recording", { roomId: row.id });
          await roomRepository.setRecordingAvailable(row.id);
        }
      } catch { /* schema may not have columns yet */ }

      // 3. Old pending rooms: mark as failed (stuck with no Jam initialization)
      try {
        const { query: dbQuery } = await import("../config/database.js");
        const stuckPending = await dbQuery<{ id: string }>(`
          SELECT id FROM room
          WHERE status = 'pending'
            AND created_at < NOW() - INTERVAL '10 minutes'
        `);
        for (const row of stuckPending) {
          logger.info("Reconcile: failing stuck pending room", { roomId: row.id });
          await roomRepository.updateStatus(row.id, "failed" as RoomStatus);
        }
      } catch { /* schema may not have columns yet */ }

      logger.info("Startup reconciliation complete", {
        staleLiveCount: staleLive.length,
      });
    } catch (err) {
      logger.error("Startup reconciliation failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      // Non-fatal — don't block server startup
    }
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

      // 3. CHECK FOR STALE HEARTBEATS — auto-end rooms where host disconnected
      try {
        const staleRooms = await roomRepository.getRoomsWithStaleHeartbeat(60);
        for (const room of staleRooms) {
          logger.info("Auto-ending room with stale heartbeat", {
            roomId: room.id,
            lastSeenAt: room.lastSeenAt,
          });
          await this.stopRoom(room.id);
          await roomRepository.updateStatus(room.id, "ended");

          // If recording available, transition to closed
          if (room.recordingUrl) {
            await roomRepository.setRecordingAvailable(room.id);
          }

          // Notify connected clients
          try {
            const { getIO } = await import("../server.js");
            getIO().to(`room:${room.id}`).emit("room:ended", {
              roomId: room.id,
              reason: "Host disconnected",
              timestamp: new Date().toISOString(),
            });
          } catch { /* non-fatal */ }
        }
      } catch (staleErr) {
        logger.warn("Failed to check stale heartbeats", {
          error: staleErr instanceof Error ? staleErr.message : String(staleErr),
        });
      }

      // 4. CLEAN UP COMPLETED/CANCELLED ROOMS
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

          await this._handleRoomTimeout(roomId);
          return;
        }
      }

      // 3. CHECK OUTPUT CONTRACT
      const completion = await outputContractService.checkCompletion(roomId);

      // 4. UPDATE PROGRESS
      const currentPct = this.activeRooms.get(roomId)?.completionPercentage ?? 0;
      if (completion.completionPercentage !== currentPct) {
        // Persist to database
        await roomRepository.updateCompletionPercentage(
          roomId,
          completion.completionPercentage,
        );

        // Update in-memory tracking
        const activeRoom = this.activeRooms.get(roomId);
        if (activeRoom) {
          activeRoom.completionPercentage = completion.completionPercentage;
        }

        // Emit progress event via WebSocket
        try {
          const { getIO } = await import("../server.js");
          const io = getIO();
          io.to(`room:${roomId}`).emit("room:progress", {
            roomId,
            completionPercentage: completion.completionPercentage,
            completionLevel: completion.completionLevel,
            timestamp: new Date().toISOString(),
          });
        } catch (wsErr) {
          logger.warn("Failed to emit room:progress event", { roomId });
        }
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
   * Called when room meets output contract.
   * Transitions: live → ended, then ended → closed if recording available.
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

      // 4. UPDATE ROOM STATUS TO ENDED
      await roomRepository.updateStatus(roomId, "ended");

      // 5. IF RECORDING IS ALREADY AVAILABLE, TRANSITION TO CLOSED
      try {
        const updatedRoom = await roomRepository.getById(roomId);
        if (updatedRoom?.recordingUrl) {
          await roomRepository.setRecordingAvailable(roomId);
          logger.info("Room has recording — transitioned to closed", { roomId });
        }
      } catch (recErr) {
        logger.warn("Failed to check recording for closed transition", {
          roomId,
          error: recErr instanceof Error ? recErr.message : String(recErr),
        });
      }

      // 6. EMIT ROOM COMPLETED EVENT via WebSocket
      try {
        const { getIO } = await import("../server.js");
        const io = getIO();

        const completedRoom = await roomRepository.getById(roomId);
        const allMessages = await messageRepository.getByRoom(roomId);
        const transcript = allMessages.filter(
          (m) => m.status === "played" || m.status === "selected",
        );

        io.to(`room:${roomId}`).emit("room:completed", {
          roomId,
          completionLevel,
          totalTurns: completedRoom?.turnCount ?? 0,
          transcript: transcript.map((m) => ({
            messageId: m.id,
            agentId: m.agentId,
            text: m.text,
            score: m.score ?? null,
            audioUrl: m.audioUrl ?? null,
            playedAt: m.playedAt?.toISOString() ?? null,
          })),
          timestamp: new Date().toISOString(),
        });

        logger.info("room:completed event emitted", { roomId, completionLevel });
      } catch (wsErr) {
        logger.error("Failed to emit room:completed event", {
          roomId,
          error: wsErr instanceof Error ? wsErr.message : String(wsErr),
        });
        // Non-fatal — room is already closed
      }

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
   * Called when room exceeds time limit without progress.
   * Transitions room to 'ended' (not 'failed') since the session itself ended
   * cleanly — it just didn't produce output. Refund is still issued.
   */
  private async _handleRoomTimeout(roomId: string): Promise<void> {
    try {
      logger.warn("Handling room timeout", { roomId });

      // 1. STOP ORCHESTRATION
      await this.stopRoom(roomId);

      // 2. UPDATE ROOM STATUS TO ENDED
      await roomRepository.updateStatus(roomId, "ended");

      // 3. ISSUE REFUND via payment service (uses spawn fee payment ID)
      try {
        const room = await roomRepository.getById(roomId);
        if (room?.spawnFeePaymentId) {
          await paymentService.refundPayment(
            room.spawnFeePaymentId,
            "Room timed out before any turns completed",
          );
          logger.info("Spawn fee refunded on timeout", {
            roomId,
            paymentId: room.spawnFeePaymentId,
          });
        }
      } catch (refundErr) {
        logger.error("Failed to issue refund on timeout", {
          roomId,
          error: refundErr instanceof Error ? refundErr.message : String(refundErr),
        });
        // Non-fatal — room is already marked ended
      }

      // 4. NOTIFY CONNECTED CLIENTS via WebSocket
      try {
        const { getIO } = await import("../server.js");
        const io = getIO();
        io.to(`room:${roomId}`).emit("room:timeout", {
          roomId,
          reason: "No agent activity within the allowed timeframe",
          timeoutSeconds: ROOM_TIMEOUT_SECONDS,
          refundIssued: true,
          timestamp: new Date().toISOString(),
        });
        logger.info("room:timeout event emitted", { roomId });
      } catch (wsErr) {
        logger.error("Failed to emit room:timeout event", { roomId });
      }

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
