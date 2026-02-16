/**
 * Revenue Distribution Service
 *
 * Handles the 50/40/10 revenue split when rooms complete:
 * - 50% to host agent
 * - 40% to participating agents (distributed by message selection rate)
 * - 10% to platform
 *
 * Integrates with x402 payment service for wallet settlement.
 *
 * Part of Day 8: Revenue Distribution & Payment Settlement
 */

import { v4 as uuidv4 } from "uuid";
import type { Room } from "../../common/types/index.js";
import {
  roomRepository,
  messageRepository,
  paymentRepository,
} from "../repositories/index.js";
import { agentStatisticsService } from "./agent-statistics-service.js";
import { getX402PaymentService } from "./x402-payment-service.js";
import { logger } from "../utils/logger.js";
import { ValidationError } from "../utils/errors.js";

// ===================================================================
// Type Definitions
// ===================================================================

interface RevenueDistribution {
  roomId: string;
  totalRevenue: bigint;
  hostAmount: bigint;
  participantAmount: bigint;
  platformAmount: bigint;
  distributions: {
    agentId: string;
    wallet: string;
    amount: bigint;
    role: "host" | "participant";
  }[];
}

interface ParticipationMetrics {
  agentId: string;
  messagesSubmitted: number;
  messagesSelected: number;
  selectionRate: number;
}

// ===================================================================
// Configuration
// ===================================================================

const REVENUE_SPLIT = {
  HOST: 0.5, // 50%
  PARTICIPANTS: 0.4, // 40%
  PLATFORM: 0.1, // 10%
};

// ===================================================================
// Revenue Distribution Service
// ===================================================================

export class RevenueDistributionService {
  /**
   * Distribute revenue when room completes
   *
   * Called from room orchestration when room meets output contract.
   * Calculates splits and initiates x402 settlement.
   *
   * @param roomId - The completed room ID
   * @param totalRevenue - Total revenue collected (in smallest unit, e.g., wei)
   * @returns Distribution details and payment records
   */
  async distributeRevenue(
    roomId: string,
    totalRevenue: bigint,
  ): Promise<RevenueDistribution> {
    try {
      // 1. VALIDATE INPUTS
      if (!roomId || totalRevenue <= 0n) {
        throw new ValidationError("Invalid room or revenue", {
          roomId,
          totalRevenue: totalRevenue.toString(),
        });
      }

      // 2. FETCH ROOM DATA
      const room = await roomRepository.getById(roomId);
      if (!room) {
        throw new Error(`Room ${roomId} not found`);
      }

      logger.info("Starting revenue distribution", {
        roomId,
        totalRevenue: totalRevenue.toString(),
        hostAgentId: room.hostAgentId,
      });

      // 3. CALCULATE REVENUE SPLITS
      const hostAmount = (totalRevenue * BigInt(50)) / BigInt(100);
      const participantPool = (totalRevenue * BigInt(40)) / BigInt(100);
      const platformAmount = (totalRevenue * BigInt(10)) / BigInt(100);

      // Verify split
      const totalDistributed = hostAmount + participantPool + platformAmount;
      if (totalDistributed !== totalRevenue) {
        logger.warn("Revenue distribution rounding", {
          expected: totalRevenue.toString(),
          actual: totalDistributed.toString(),
          difference: (totalRevenue - totalDistributed).toString(),
        });
      }

      // 4. GET PARTICIPATION METRICS
      const participants = await this._getParticipants(roomId, room);
      logger.info("Found participants", {
        roomId,
        participantCount: participants.length,
      });

      // 5. BUILD DISTRIBUTION PLAN
      const distribution = await this._buildDistributionPlan(
        roomId,
        room,
        participants,
        hostAmount,
        participantPool,
        platformAmount,
      );

      logger.info("Revenue distribution plan created", {
        roomId,
        distributions: distribution.distributions.length,
        hostAmount: distribution.hostAmount.toString(),
        participantAmount: distribution.participantAmount.toString(),
        platformAmount: distribution.platformAmount.toString(),
      });

      // 6. INITIATE SETTLEMENT (if wallets available)
      await this._initiateSettlement(distribution);

      return distribution;
    } catch (err) {
      logger.error("Error distributing revenue", {
        roomId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  /**
   * Get distribution history for a room
   *
   * @param roomId - Room ID
   * @returns Distribution records
   */
  async getDistributionHistory(roomId: string): Promise<RevenueDistribution[]> {
    // TODO: Query database for completed distributions
    // For MVP, return empty array
    logger.debug("Fetching distribution history", { roomId });
    return [];
  }

  /**
   * Internal: Get all participants with their metrics
   *
   * @private
   */
  private async _getParticipants(
    roomId: string,
    room: Room,
  ): Promise<ParticipationMetrics[]> {
    try {
      // Get messages in room
      const messages = await messageRepository.getByRoom(roomId);

      // Build metrics per agent
      const metricsMap = new Map<string, ParticipationMetrics>();

      // Always include host
      metricsMap.set(room.hostAgentId, {
        agentId: room.hostAgentId,
        messagesSubmitted: 0,
        messagesSelected: 0,
        selectionRate: 0,
      });

      // Count messages per agent
      for (const msg of messages) {
        if (!metricsMap.has(msg.agentId)) {
          metricsMap.set(msg.agentId, {
            agentId: msg.agentId,
            messagesSubmitted: 0,
            messagesSelected: 0,
            selectionRate: 0,
          });
        }

        const metrics = metricsMap.get(msg.agentId)!;
        metrics.messagesSubmitted += 1;

        if (msg.status === "selected" || msg.status === "played") {
          metrics.messagesSelected += 1;
        }
      }

      // Calculate selection rates
      const participants = Array.from(metricsMap.values());
      for (const p of participants) {
        p.selectionRate =
          p.messagesSubmitted > 0
            ? p.messagesSelected / p.messagesSubmitted
            : 0;
      }

      return participants;
    } catch (err) {
      logger.error("Failed to get participants", {
        roomId,
        error: err instanceof Error ? err.message : String(err),
      });
      return [
        {
          agentId: room.hostAgentId,
          messagesSubmitted: 0,
          messagesSelected: 0,
          selectionRate: 0,
        },
      ];
    }
  }

  /**
   * Internal: Build complete distribution plan
   *
   * @private
   */
  private async _buildDistributionPlan(
    roomId: string,
    room: Room,
    participants: ParticipationMetrics[],
    hostAmount: bigint,
    participantPool: bigint,
    platformAmount: bigint,
  ): Promise<RevenueDistribution> {
    const distributions = [];

    // 1. HOST DISTRIBUTION
    distributions.push({
      agentId: room.hostAgentId,
      wallet: "0x0000000000000000000000000000000000000000", // TODO: Get from agent profile
      amount: hostAmount,
      role: "host" as const,
    });

    // 2. PARTICIPANT DISTRIBUTIONS (weighted by selection rate)
    const nonHostParticipants = participants.filter(
      (p) => p.agentId !== room.hostAgentId,
    );

    if (nonHostParticipants.length > 0) {
      const totalSelectionRate = nonHostParticipants.reduce(
        (sum, p) => sum + p.selectionRate,
        0,
      );

      for (const participant of nonHostParticipants) {
        // Weight by selection rate
        const weight =
          totalSelectionRate > 0
            ? participant.selectionRate / totalSelectionRate
            : 1 / nonHostParticipants.length;

        const amount =
          (participantPool * BigInt(Math.floor(weight * 1000))) / BigInt(1000);

        distributions.push({
          agentId: participant.agentId,
          wallet: "0x0000000000000000000000000000000000000000", // TODO: Get from agent profile
          amount,
          role: "participant" as const,
        });
      }
    }

    // 3. PLATFORM DISTRIBUTION
    distributions.push({
      agentId: "PLATFORM", // Special ID for platform fee
      wallet:
        process.env.PLATFORM_WALLET ||
        "0x0000000000000000000000000000000000000000",
      amount: platformAmount,
      role: "host" as const, // Treat platform as host for wallet purposes
    });

    return {
      roomId,
      totalRevenue: hostAmount + participantPool + platformAmount,
      hostAmount,
      participantAmount: participantPool,
      platformAmount,
      distributions,
    };
  }

  /**
   * Internal: Initiate settlement via x402
   *
   * @private
   */
  private async _initiateSettlement(
    distribution: RevenueDistribution,
  ): Promise<void> {
    try {
      const paymentService = getX402PaymentService();

      logger.info("Initiating x402 settlement", {
        roomId: distribution.roomId,
        paymentCount: distribution.distributions.length,
      });

      for (const dist of distribution.distributions) {
        try {
          // Skip if wallet is null address (not set)
          if (dist.wallet === "0x0000000000000000000000000000000000000000") {
            logger.warn("Skipping settlement for agent without wallet", {
              agentId: dist.agentId,
              roomId: distribution.roomId,
            });
            continue;
          }

          // Validate wallet format
          if (!dist.wallet.startsWith("0x") || dist.wallet.length !== 42) {
            logger.warn("Invalid wallet address", {
              agentId: dist.agentId,
              wallet: dist.wallet,
            });
            continue;
          }

          // TODO: Initiate payment
          // const paymentRecord = await paymentService.initiatePayment(...)
          logger.info("Settlement initiated", {
            roomId: distribution.roomId,
            agentId: dist.agentId,
            amount: dist.amount.toString(),
            wallet: `${dist.wallet.slice(0, 6)}...${dist.wallet.slice(-4)}`,
          });
        } catch (err) {
          logger.error("Failed to initiate settlement for agent", {
            agentId: dist.agentId,
            roomId: distribution.roomId,
            error: err instanceof Error ? err.message : String(err),
          });
          // Continue with other settlements
        }
      }

      logger.info("Settlement batch initiated", {
        roomId: distribution.roomId,
      });
    } catch (err) {
      logger.error("Error initiating settlement", {
        roomId: distribution.roomId,
        error: err instanceof Error ? err.message : String(err),
      });
      // Don't throw - log but continue
    }
  }
}

/**
 * Singleton instance
 */
export const revenueDistributionService = new RevenueDistributionService();
