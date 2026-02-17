/**
 * x402 Payment Service
 *
 * Handles spawn fee charging, payment status tracking, revenue distribution,
 * and error handling for the x402 micropayment system.
 *
 * Phase 2 (Day 4): Full x402 integration with testnet support
 * Phase 2 (Security): Webhook signature verification implemented
 * Phase 2 (Complete): Full x402 SDK integration with payment processing
 */

import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import {
  X402_CONFIG,
  PaymentStatus,
  PaymentType,
  X402Error,
  type PaymentRecord,
  type X402Transaction,
} from "../config/x402-config.js";
import { logger } from "../utils/logger.js";
import { ValidationError } from "../utils/errors.js";
import { query } from "../config/database.js";
import { X402Client, type X402PaymentRequest } from "./x402-client.js";

/**
 * x402 Payment Service
 *
 * Handles all payment operations for the platform
 */
export class X402PaymentService {
  private x402Client: X402Client;
  private isInitialized: boolean = false;

  constructor() {
    // Initialize x402 SDK client
    this.x402Client = new X402Client({
      apiKey: X402_CONFIG.apiKey,
      secretKey: X402_CONFIG.secretKey,
      network: X402_CONFIG.network,
      mockMode: !X402_CONFIG.apiKey || process.env.X402_MOCK_MODE === "true",
    });

    this.isInitialized = true;

    logger.info("X402PaymentService initialized", {
      network: X402_CONFIG.network,
      mockMode: !X402_CONFIG.apiKey || process.env.X402_MOCK_MODE === "true",
    });
  }

  /**
   * Charge a spawn fee for room creation
   *
   * Phase 2 (Day 4): 7.2 - Implement spawn fee collection
   *
   * @param agentId - Agent ID
   * @param walletAddress - Agent's wallet address
   * @param roomId - Room ID (optional at charge time)
   * @returns Payment record with pending status
   */
  async chargeSpawnFee(
    agentId: string,
    walletAddress: string,
    roomId?: string,
  ): Promise<PaymentRecord> {
    // Validate inputs
    if (!agentId || !walletAddress) {
      throw new ValidationError("Missing agentId or walletAddress", {
        agentId,
        walletAddress: walletAddress ? "***" : undefined,
      });
    }

    if (!walletAddress.startsWith("0x") || walletAddress.length !== 42) {
      throw new ValidationError("Invalid wallet address format", {
        walletAddress: "***",
        expected: "0x followed by 40 hex characters",
      });
    }

    const amount = X402_CONFIG.minSpawnFee;

    try {
      // Log payment initiation
      logger.info("Initiating spawn fee charge", {
        agentId,
        walletAddress: `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
        amount: amount.toString(),
        roomId,
      });

      // Call x402 SDK to create transaction
      const x402Request: X402PaymentRequest = {
        from: walletAddress,
        to: X402_CONFIG.platformWallet,
        amount: amount,
        metadata: {
          agentId,
          roomId,
          type: "spawn_fee",
          timestamp: new Date().toISOString(),
        },
      };

      const x402Response = await this.x402Client.createPayment(x402Request);

      // Create payment record in database
      const payment: PaymentRecord = {
        id: x402Response.id,
        agentId,
        roomId,
        walletAddress,
        amount,
        type: PaymentType.SPAWN_FEE,
        status: x402Response.status as PaymentStatus,
        txHash: x402Response.txHash,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Save to database
      await this._savePaymentToDatabase(payment);

      logger.info("Spawn fee charge initiated", {
        paymentId: payment.id,
        agentId,
        amount: amount.toString(),
        status: payment.status,
        txHash: payment.txHash,
      });

      return payment;
    } catch (err) {
      const error =
        err instanceof X402Error
          ? err
          : new X402Error("Failed to charge spawn fee", "SPAWN_FEE_ERROR", {
              agentId,
              walletAddress: "***",
            });

      logger.error("Spawn fee charge failed", {
        agentId,
        error: error.message,
        code: error.code,
      });

      throw error;
    }
  }

  /**
   * Check payment status and update if necessary
   *
   * Phase 2 (Day 4): 7.3 - Implement payment status tracking
   *
   * @param paymentId - Payment ID
   * @param txHash - Transaction hash (optional, for lookup)
   * @returns Updated payment status
   */
  async checkPaymentStatus(
    paymentId: string,
    txHash?: string,
  ): Promise<PaymentStatus> {
    try {
      // Fetch from database
      const payment = await this._getPaymentFromDatabase(paymentId);

      if (!payment) {
        throw new X402Error("Payment not found", "PAYMENT_NOT_FOUND", {
          paymentId,
        });
      }

      // If already confirmed or failed, return cached status
      if (
        payment.status === PaymentStatus.CONFIRMED ||
        payment.status === PaymentStatus.FAILED ||
        payment.status === PaymentStatus.FAILED_INSUFFICIENT_FUNDS
      ) {
        return payment.status;
      }

      // Query x402 API for transaction status
      const effectiveTxHash = txHash || payment.txHash;
      if (!effectiveTxHash) {
        logger.warn("No transaction hash available for status check", {
          paymentId,
        });
        return payment.status;
      }

      const tx = await this.x402Client.getTransaction(effectiveTxHash);

      // Map x402 status to our PaymentStatus
      let newStatus = payment.status;
      if (tx.status === "confirmed") {
        newStatus = PaymentStatus.CONFIRMED;
      } else if (tx.status === "failed") {
        newStatus = PaymentStatus.FAILED;
      } else if (tx.confirmations > 0) {
        newStatus = PaymentStatus.CONFIRMING;
      }

      // Update payment status in database if changed
      if (newStatus !== payment.status) {
        await this._updatePaymentStatus(paymentId, newStatus, {
          confirmations: tx.confirmations,
          confirmedAt:
            newStatus === PaymentStatus.CONFIRMED ? new Date() : undefined,
        });

        logger.info("Payment status updated", {
          paymentId,
          oldStatus: payment.status,
          newStatus,
          confirmations: tx.confirmations,
        });
      }

      return newStatus;
    } catch (err) {
      logger.error("Failed to check payment status", {
        paymentId,
        error: err instanceof Error ? err.message : String(err),
      });

      throw new X402Error(
        "Failed to check payment status",
        "STATUS_CHECK_ERROR",
        { paymentId },
      );
    }
  }

  /**
   * Distribute revenue after room completion
   *
   * Phase 2 (Day 4): 7.4 - Implement revenue distribution
   *
   * Revenue split:
   * - Host: 50%
   * - Participants: 40% (shared equally)
   * - Platform: 10%
   *
   * @param roomId - Room ID
   * @param hostWallet - Host wallet address
   * @param participantWallets - Participant wallet addresses
   * @param totalRevenue - Total revenue to distribute (in smallest unit)
   * @returns Array of payout payment records
   */
  async distributeRevenue(
    roomId: string,
    hostWallet: string,
    participantWallets: string[],
    totalRevenue: bigint,
  ): Promise<PaymentRecord[]> {
    if (!hostWallet || !hostWallet.startsWith("0x")) {
      throw new ValidationError("Invalid host wallet address", {
        hostWallet: "***",
      });
    }

    if (totalRevenue <= 0n) {
      throw new ValidationError("Total revenue must be positive", {
        totalRevenue: totalRevenue.toString(),
      });
    }

    const payouts: PaymentRecord[] = [];

    try {
      logger.info("Starting revenue distribution", {
        roomId,
        totalRevenue: totalRevenue.toString(),
        participants: participantWallets.length,
      });

      // Calculate splits
      const hostShare = (totalRevenue * BigInt(50)) / BigInt(100);
      const participantShare = (totalRevenue * BigInt(40)) / BigInt(100);
      const platformShare = (totalRevenue * BigInt(10)) / BigInt(100);

      // Verify calculation (allow for rounding)
      const totalDistributed = hostShare + participantShare + platformShare;
      if (totalDistributed !== totalRevenue) {
        logger.warn("Revenue distribution rounding", {
          expected: totalRevenue.toString(),
          actual: totalDistributed.toString(),
          difference: (totalRevenue - totalDistributed).toString(),
        });
      }

      // Host payout (50%)
      const hostPayout = await this._createPayout(
        uuidv4(),
        roomId,
        hostWallet,
        hostShare,
        PaymentType.HOST_PAYOUT,
      );
      payouts.push(hostPayout);

      // Participant payouts (40%, split equally)
      if (participantWallets.length > 0) {
        const perParticipantShare =
          participantShare / BigInt(participantWallets.length);

        for (const wallet of participantWallets) {
          const participantPayout = await this._createPayout(
            uuidv4(),
            roomId,
            wallet,
            perParticipantShare,
            PaymentType.PARTICIPANT_PAYOUT,
          );
          payouts.push(participantPayout);
        }
      }

      // Platform revenue (10%)
      const platformPayout = await this._createPayout(
        uuidv4(),
        roomId,
        X402_CONFIG.platformWallet,
        platformShare,
        PaymentType.PLATFORM_REVENUE,
      );
      payouts.push(platformPayout);

      logger.info("Revenue distribution completed", {
        roomId,
        payouts: payouts.length,
        hostShare: hostShare.toString(),
        participantShare: participantShare.toString(),
        platformShare: platformShare.toString(),
      });

      return payouts;
    } catch (err) {
      logger.error("Revenue distribution failed", {
        roomId,
        error: err instanceof Error ? err.message : String(err),
      });

      throw new X402Error(
        "Failed to distribute revenue",
        "DISTRIBUTION_ERROR",
        { roomId },
      );
    }
  }

  /**
   * Create a payout transaction
   *
   * @private
   */
  private async _createPayout(
    paymentId: string,
    roomId: string,
    walletAddress: string,
    amount: bigint,
    type: PaymentType,
  ): Promise<PaymentRecord> {
    // Call x402 SDK to create payout
    const x402Request: X402PaymentRequest = {
      from: X402_CONFIG.platformWallet,
      to: walletAddress,
      amount,
      metadata: {
        type,
        roomId,
        isPayout: true,
        timestamp: new Date().toISOString(),
      },
    };

    const x402Response = await this.x402Client.createPayment(x402Request);

    const payment: PaymentRecord = {
      id: paymentId,
      agentId: "", // Not applicable for payouts
      roomId,
      walletAddress,
      amount,
      type,
      status: x402Response.status as PaymentStatus,
      txHash: x402Response.txHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Save to database
    await this._savePaymentToDatabase(payment);

    logger.debug("Payout created", {
      paymentId,
      roomId,
      type,
      amount: amount.toString(),
      txHash: payment.txHash,
    });

    return payment;
  }

  // ===================================================================
  // Database Helper Methods
  // ===================================================================

  /**
   * Save payment to database
   */
  private async _savePaymentToDatabase(payment: PaymentRecord): Promise<void> {
    const sql = `
      INSERT INTO payment (
        id, agent_id, room_id, wallet_address, amount, type, 
        status, tx_hash, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        tx_hash = EXCLUDED.tx_hash,
        updated_at = EXCLUDED.updated_at
    `;

    await query(sql, [
      payment.id,
      payment.agentId || null,
      payment.roomId || null,
      payment.walletAddress,
      payment.amount.toString(),
      payment.type,
      payment.status,
      payment.txHash || null,
      payment.createdAt,
      payment.updatedAt,
    ]);
  }

  /**
   * Get payment from database
   */
  private async _getPaymentFromDatabase(
    paymentId: string,
  ): Promise<PaymentRecord | null> {
    const sql = `
      SELECT * FROM payment WHERE id = $1
    `;

    const results = await query(sql, [paymentId]);

    if (results.length === 0) {
      return null;
    }

    const row = results[0];
    return {
      id: row.id,
      agentId: row.agent_id || "",
      roomId: row.room_id || undefined,
      walletAddress: row.wallet_address,
      amount: BigInt(row.amount),
      type: row.type as PaymentType,
      status: row.status as PaymentStatus,
      txHash: row.tx_hash || undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      confirmedAt: row.confirmed_at ? new Date(row.confirmed_at) : undefined,
    };
  }

  /**
   * Update payment status
   */
  private async _updatePaymentStatus(
    paymentId: string,
    status: PaymentStatus,
    metadata?: { confirmations?: number; confirmedAt?: Date },
  ): Promise<void> {
    const sql = `
      UPDATE payment 
      SET status = $1, 
          updated_at = NOW(),
          confirmed_at = COALESCE($2, confirmed_at)
      WHERE id = $3
    `;

    await query(sql, [status, metadata?.confirmedAt || null, paymentId]);
  }

  /**
   * Handle payment errors with appropriate recovery
   *
   * Phase 2 (Day 4): 7.5 - Add payment error handling
   *
   * @param error - Error from x402 SDK
   * @param paymentId - Payment ID
   */
  async handlePaymentError(error: Error, paymentId: string): Promise<void> {
    logger.error("Payment error occurred", {
      paymentId,
      error: error.message,
      type: error.constructor.name,
    });

    // Implement error-specific handling
    if (error instanceof X402Error) {
      switch (error.code) {
        case "INSUFFICIENT_BALANCE":
          await this._updatePaymentStatus(
            paymentId,
            PaymentStatus.FAILED_INSUFFICIENT_FUNDS,
          );
          logger.warn("Payment failed: Insufficient balance", { paymentId });
          break;

        case "RATE_LIMIT":
          // Schedule retry - for now just log
          logger.warn("Payment rate limited, retry scheduled", { paymentId });
          // In production, would use a job queue like Bull
          setTimeout(() => {
            this.checkPaymentStatus(paymentId).catch((err) => {
              logger.error("Retry check failed", {
                paymentId,
                error: err.message,
              });
            });
          }, 5000);
          break;

        default:
          await this._updatePaymentStatus(
            paymentId,
            PaymentStatus.FAILED_OTHER,
          );
          logger.error("Payment failed with error", {
            paymentId,
            code: error.code,
          });
      }
    } else {
      // Generic error handling
      await this._updatePaymentStatus(paymentId, PaymentStatus.FAILED_OTHER);
    }
  }

  /**
   * Verify x402 webhook signature using HMAC-SHA256
   *
   * SECURITY CRITICAL: Prevents forged payment webhooks
   * All webhook requests must include a valid signature in the
   * X-x402-Signature header computed from the request body
   *
   * @param body - Raw request body (must be exact bytes received)
   * @param signature - Signature from X-x402-Signature header (hex format)
   * @returns true if signature is valid
   * @throws X402Error if webhook secret not configured
   */
  verifyWebhookSignature(body: string, signature: string): boolean {
    try {
      // Check if webhooks are enabled
      if (!X402_CONFIG.enableWebhooks) {
        logger.warn("Webhook verification skipped: webhooks disabled");
        return false;
      }

      // Verify webhook secret is configured
      if (!X402_CONFIG.webhookSecret) {
        logger.error(
          "Webhook verification failed: X402_WEBHOOK_SECRET not configured",
        );
        throw new X402Error(
          "Webhook secret not configured",
          "WEBHOOK_SECRET_MISSING",
          { action: "configure X402_WEBHOOK_SECRET environment variable" },
        );
      }

      // Validate inputs
      if (!body) {
        logger.error("Webhook verification failed: empty body");
        return false;
      }

      if (!signature) {
        logger.error("Webhook verification failed: missing signature header");
        return false;
      }

      // Compute HMAC-SHA256 signature
      const expectedSignature = crypto
        .createHmac("sha256", X402_CONFIG.webhookSecret)
        .update(body, "utf8")
        .digest("hex");

      // Use timing-safe comparison to prevent timing attacks
      const signatureBuffer = Buffer.from(signature, "hex");
      const expectedBuffer = Buffer.from(expectedSignature, "hex");

      // Validate signature format (must be valid hex)
      if (
        signatureBuffer.length === 0 ||
        signatureBuffer.toString("hex") !== signature.toLowerCase()
      ) {
        logger.error("Webhook verification failed: invalid signature format");
        return false;
      }

      // Constant-time comparison to prevent timing attacks
      if (signatureBuffer.length !== expectedBuffer.length) {
        logger.error("Webhook verification failed: signature length mismatch", {
          receivedLength: signature.length,
          expectedLength: expectedSignature.length,
        });
        return false;
      }

      const isValid = crypto.timingSafeEqual(signatureBuffer, expectedBuffer);

      if (!isValid) {
        logger.error("Webhook verification failed: signature mismatch", {
          signaturePrefix: signature.slice(0, 16) + "...",
          bodyLength: body.length,
        });
      } else {
        logger.debug("Webhook signature verified successfully");
      }

      return isValid;
    } catch (err) {
      if (err instanceof X402Error) {
        throw err;
      }
      logger.error("Webhook signature verification failed", {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      return false;
    }
  }

  /**
   * Process webhook from x402
   *
   * @param paymentId - Payment ID
   * @param status - New status from webhook
   */
  async processWebhookPayment(
    paymentId: string,
    status: PaymentStatus,
    txHash?: string,
  ): Promise<void> {
    logger.info("Processing payment webhook", {
      paymentId,
      status,
      txHash: txHash ? `${txHash.slice(0, 10)}...` : undefined,
    });

    try {
      // Update payment status in database
      await this._updatePaymentStatus(paymentId, status, {
        confirmedAt:
          status === PaymentStatus.CONFIRMED ? new Date() : undefined,
      });

      // Also update tx_hash if provided
      if (txHash) {
        await query(`UPDATE payment SET tx_hash = $1 WHERE id = $2`, [
          txHash,
          paymentId,
        ]);
      }

      logger.info("Payment webhook processed successfully", {
        paymentId,
        status,
      });
    } catch (err) {
      logger.error("Failed to process payment webhook", {
        paymentId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw new X402Error(
        "Failed to process webhook",
        "WEBHOOK_PROCESSING_ERROR",
        { paymentId },
      );
    }
  }

  /**
   * Verify a payment is complete
   * Convenience method for checking if spawn fee is paid
   */
  async verifyPaymentComplete(paymentId: string): Promise<boolean> {
    try {
      const status = await this.checkPaymentStatus(paymentId);
      return status === PaymentStatus.CONFIRMED;
    } catch (err) {
      logger.error("Payment verification failed", { paymentId, error: err });
      return false;
    }
  }

  /**
   * Get payment history for an agent
   */
  async getAgentPaymentHistory(agentId: string): Promise<PaymentRecord[]> {
    const sql = `
      SELECT * FROM payment 
      WHERE agent_id = $1 
      ORDER BY created_at DESC
    `;

    const results = await query(sql, [agentId]);

    return results.map((row) => ({
      id: row.id,
      agentId: row.agent_id || "",
      roomId: row.room_id || undefined,
      walletAddress: row.wallet_address,
      amount: BigInt(row.amount),
      type: row.type as PaymentType,
      status: row.status as PaymentStatus,
      txHash: row.tx_hash || undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      confirmedAt: row.confirmed_at ? new Date(row.confirmed_at) : undefined,
    }));
  }

  /**
   * Get total revenue for a room
   */
  async getRoomRevenue(roomId: string): Promise<bigint> {
    const sql = `
      SELECT COALESCE(SUM(amount), 0) as total
      FROM payment 
      WHERE room_id = $1 AND status = $2 AND type = $3
    `;

    const results = await query(sql, [
      roomId,
      PaymentStatus.CONFIRMED,
      PaymentType.SPAWN_FEE,
    ]);
    return BigInt(results[0]?.total || 0);
  }
}

// Singleton instance
let serviceInstance: X402PaymentService | null = null;

/**
 * Get or create singleton instance
 */
export function getX402PaymentService(): X402PaymentService {
  if (!serviceInstance) {
    serviceInstance = new X402PaymentService();
  }
  return serviceInstance;
}
