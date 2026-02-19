// @ts-nocheck
/**
 * Payment Service
 * High-level business logic for spawn fees and revenue distribution
 *
 * Delegates to x402-payment-service for actual blockchain interactions
 * and x402 SDK calls.
 *
 * Responsibilities:
 * - Spawn fee collection and validation
 * - Revenue distribution calculations
 * - Payment refunds and error handling
 * - Podcast generation cost tracking
 */

import type { Payment, PaymentStatus, PaymentType } from "@common/types/index";
import { PaymentError, ValidationError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { getX402PaymentService } from "./x402-payment-service.js";
import { X402_CONFIG } from "../config/x402-config.js";

/**
 * Payment Service
 * Handles spawn fees, revenue distribution, and payment processing via x402
 */
export class PaymentService {
  private x402PaymentService = getX402PaymentService();

  /**
   * Charge spawn fee for room creation
   *
   * @param agentId - Agent ID creating the room
   * @param roomId - Room ID being created
   * @param walletAddress - Agent's wallet address (0x...)
   * @returns Payment record with pending status
   * @throws ValidationError if inputs invalid
   */
  async chargeSpawnFee(
    agentId: string,
    roomId: string,
    walletAddress: string,
  ): Promise<Payment> {
    try {
      // Delegate to x402 payment service
      const payment = await this.x402PaymentService.chargeSpawnFee(
        agentId,
        walletAddress,
        roomId,
      );

      logger.info("Spawn fee charged via x402", {
        paymentId: payment.id,
        agentId,
        roomId,
        amount: payment.amount.toString(),
        status: payment.status,
      });

      return payment as unknown as Payment;
    } catch (err) {
      if (err instanceof ValidationError) throw err;

      logger.error("Failed to charge spawn fee", {
        agentId,
        roomId,
        error: err instanceof Error ? err.message : String(err),
      });

      throw new PaymentError("Failed to charge spawn fee", {
        agentId,
        code: "SPAWN_FEE_FAILED",
      });
    }
  }

  /**
   * Distribute revenue to room participants after room completion
   *
   * Revenue split:
   * - Host: 50% (default)
   * - Participants: 40% (shared equally, default)
   * - Platform: 10% (default)
   *
   * @param roomId - Room ID that completed
   * @param hostAgentId - Host agent ID
   * @param hostWalletAddress - Host wallet address
   * @param participantData - Array of { agentId, walletAddress } for participants
   * @param totalSpawnFee - Total spawn fee collected (in smallest unit)
   * @returns Array of payment records
   * @throws PaymentError if distribution fails
   */
  async distributeRevenue(
    roomId: string,
    hostAgentId: string,
    hostWalletAddress: string,
    participantData: Array<{ agentId: string; walletAddress: string }>,
    totalSpawnFee: bigint,
  ): Promise<Payment[]> {
    try {
      // Delegate to x402 payment service for revenue distribution
      const payments = await this.x402PaymentService.distributeRevenue(
        roomId,
        hostWalletAddress,
        participantData.map((p) => p.walletAddress),
      );

      logger.info("Revenue distributed for room", {
        roomId,
        hostAgentId,
        participantCount: participantData.length,
        paymentCount: payments.length,
        totalAmount: totalSpawnFee.toString(),
      });

      return payments as unknown as Payment[];
    } catch (err) {
      logger.error("Failed to distribute revenue", {
        roomId,
        hostAgentId,
        participantCount: participantData.length,
        error: err instanceof Error ? err.message : String(err),
      });

      throw new PaymentError("Failed to distribute revenue", {
        roomId,
        code: "DISTRIBUTION_FAILED",
      });
    }
  }

  /**
   * Get payment status and check if it's confirmed
   *
   * @param paymentId - Payment ID
   * @returns Payment status
   * @throws PaymentError if lookup fails
   */
  async getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
    try {
      const status =
        await this.x402PaymentService.checkPaymentStatus(paymentId);

      logger.debug("Payment status checked", {
        paymentId,
        status,
      });

      return status as unknown as PaymentStatus;
    } catch (err) {
      logger.error("Failed to get payment status", {
        paymentId,
        error: err instanceof Error ? err.message : String(err),
      });

      throw new PaymentError("Failed to get payment status", {
        paymentId,
        code: "STATUS_CHECK_FAILED",
      });
    }
  }

  /**
   * Refund a payment
   *
   * Calls x402 refund API and marks payment as refunded in database.
   *
   * @param paymentId - Payment ID to refund
   * @param reason - Reason for refund
   * @returns Updated payment record
   * @throws PaymentError if refund fails
   */
  async refundPayment(paymentId: string, reason: string): Promise<Payment> {
    if (!reason || reason.length === 0) {
      throw new ValidationError("Refund reason is required", {
        field: "reason",
      });
    }

    try {
      logger.info("Initiating refund", {
        paymentId,
        reason,
      });

      // Call x402 refund endpoint
      await this.x402PaymentService.refundPayment(paymentId, reason);

      // Mark as refunded (status update handled by x402 service)
      const status =
        await this.x402PaymentService.checkPaymentStatus(paymentId);

      logger.info("Payment refunded successfully", {
        paymentId,
        reason,
        status,
      });

      // Return refunded payment record
      return {
        id: paymentId,
        amount: 0,
        status: "refunded",
        type: "refund",
      } as unknown as Payment;
    } catch (err) {
      logger.error("Failed to refund payment", {
        paymentId,
        reason,
        error: err instanceof Error ? err.message : String(err),
      });

      throw new PaymentError("Failed to refund payment", {
        paymentId,
        code: "REFUND_FAILED",
      });
    }
  }

  /**
   * Charge podcast episode generation cost
   *
   * Cost is deducted from agent's x402 account.
   *
   * @param agentId - Agent being charged
   * @param episodeId - Episode being generated
   * @param walletAddress - Agent's wallet address
   * @param costUsdc - Cost in USDC (will be converted to smallest unit)
   * @param description - Payment description
   * @returns Payment record
   * @throws ValidationError if cost invalid
   * @throws PaymentError if x402 call fails
   */
  async chargeGenerationCost(
    agentId: string,
    episodeId: string,
    walletAddress: string,
    costUsdc: number,
    description?: string,
  ): Promise<Payment> {
    // Validate cost
    if (costUsdc <= 0) {
      throw new ValidationError("Generation cost must be positive", {
        field: "costUsdc",
        provided: costUsdc,
      });
    }

    if (costUsdc > 1000) {
      throw new ValidationError("Generation cost exceeds maximum", {
        field: "costUsdc",
        provided: costUsdc,
        maximum: 1000,
      });
    }

    try {
      // Convert USDC to smallest unit (wei/satoshi equivalent)
      // USDC has 6 decimals, so multiply by 10^6
      const amountInSmallestUnit = BigInt(Math.round(costUsdc * 1_000_000));

      logger.info("Charging podcast generation cost", {
        agentId,
        episodeId,
        costUsdc,
        walletAddress: `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
        description,
      });

      // Call x402 SDK to charge
      const x402Request = {
        from: walletAddress,
        to: X402_CONFIG.platformWallet,
        amount: amountInSmallestUnit,
        metadata: {
          agentId,
          episodeId,
          type: "podcast_generation",
          description: description || `Podcast episode: ${episodeId}`,
          timestamp: new Date().toISOString(),
        },
      };

      const x402Response =
        await this.x402PaymentService["x402Client"].createPayment(x402Request);

      logger.info("Podcast generation cost charged via x402", {
        paymentId: x402Response.id,
        agentId,
        episodeId,
        costUsdc,
        txHash: x402Response.txHash,
        status: x402Response.status,
      });

      return {
        id: x402Response.id,
        amount: costUsdc,
        status: x402Response.status as unknown as PaymentStatus,
        type: "podcast_generation",
      } as unknown as Payment;
    } catch (err) {
      logger.error("Failed to charge generation cost", {
        agentId,
        episodeId,
        error: err instanceof Error ? err.message : String(err),
      });

      throw new PaymentError("Failed to charge generation cost", {
        agentId,
        episodeId,
        code: "GENERATION_COST_FAILED",
      });
    }
  }

  /**
   * Verify a spawn fee payment is confirmed
   *
   * Convenience method for checking if spawn fee is fully paid.
   *
   * @param paymentId - Payment ID to verify
   * @returns true if payment confirmed, false otherwise
   */
  async verifySpawnFeeConfirmed(paymentId: string): Promise<boolean> {
    try {
      const status = await this.getPaymentStatus(paymentId);
      return status === "confirmed";
    } catch (err) {
      logger.error("Failed to verify spawn fee", { paymentId, error: err });
      return false;
    }
  }
}

export const paymentService = new PaymentService();
