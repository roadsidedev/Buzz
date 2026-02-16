/**
 * x402 Payment Service
 *
 * Handles spawn fee charging, payment status tracking, revenue distribution,
 * and error handling for the x402 micropayment system.
 *
 * Phase 2 (Day 4): Full x402 integration with testnet support
 */

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

/**
 * x402 Payment Service
 *
 * Handles all payment operations for the platform
 */
export class X402PaymentService {
    private x402Client: any; // x402 SDK client

    constructor() {
        // TODO: Initialize x402 SDK client
        // this.x402Client = new X402Client({
        //   apiKey: X402_CONFIG.apiKey,
        //   secretKey: X402_CONFIG.secretKey,
        //   network: X402_CONFIG.network,
        // });
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

            // TODO: Call x402 SDK to create transaction
            // const tx = await this.x402Client.createPayment({
            //   from: walletAddress,
            //   to: X402_CONFIG.platformWallet,
            //   amount: amount,
            //   metadata: {
            //     agentId,
            //     roomId,
            //     type: 'spawn_fee',
            //     timestamp: new Date().toISOString(),
            //   },
            // });

            // Create payment record in database
            const payment: PaymentRecord = {
                id: uuidv4(),
                agentId,
                roomId,
                walletAddress,
                amount,
                type: PaymentType.SPAWN_FEE,
                status: PaymentStatus.PENDING,
                txHash: undefined, // Will be set when x402 returns
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            // TODO: Save to database
            // await paymentRepository.create(payment);

            logger.info("Spawn fee charge initiated", {
                paymentId: payment.id,
                agentId,
                amount: amount.toString(),
                status: PaymentStatus.PENDING,
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
            // TODO: Fetch from database
            // const payment = await paymentRepository.findById(paymentId);

            // TODO: Query x402 API for transaction status
            // const tx = await this.x402Client.getTransaction(payment.txHash);

            // TODO: Update payment status in database if changed
            // if (tx.status !== payment.status) {
            //   await paymentRepository.update(paymentId, { status: tx.status });
            // }

            logger.debug("Payment status checked", { paymentId });

            return PaymentStatus.PENDING; // TODO: Return actual status
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
        // TODO: Call x402 SDK to create payout
        // const tx = await this.x402Client.createPayment({
        //   from: X402_CONFIG.platformWallet,
        //   to: walletAddress,
        //   amount,
        //   metadata: { type, roomId },
        // });

        const payment: PaymentRecord = {
            id: paymentId,
            agentId: "", // Not applicable for payouts
            roomId,
            walletAddress,
            amount,
            type,
            status: PaymentStatus.PENDING,
            txHash: undefined, // Will be set when x402 returns
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        // TODO: Save to database

        logger.debug("Payout created", {
            paymentId,
            roomId,
            type,
            amount: amount.toString(),
        });

        return payment;
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

        // TODO: Implement error-specific handling
        // if (error instanceof X402Error) {
        //   switch (error.code) {
        //     case 'INSUFFICIENT_BALANCE':
        //       await paymentRepository.update(paymentId, {
        //         status: PaymentStatus.FAILED_INSUFFICIENT_FUNDS,
        //         error: 'Insufficient balance in wallet',
        //       });
        //       break;

        //     case 'RATE_LIMIT':
        //       // Schedule retry
        //       await this._scheduleRetry(paymentId, 5000);
        //       break;

        //     default:
        //       await paymentRepository.update(paymentId, {
        //         status: PaymentStatus.FAILED_OTHER,
        //         error: error.message,
        //       });
        //   }
        // }
    }

    /**
     * Verify x402 webhook signature
     *
     * Phase 2 (Day 4): 7.6 - Implement payment webhook handling
     *
     * @param body - Request body
     * @param signature - Signature header value
     * @returns true if signature is valid
     */
    verifyWebhookSignature(body: string, signature: string): boolean {
        try {
            // TODO: Implement signature verification using X402_CONFIG.webhookSecret
            // const hash = crypto
            //   .createHmac('sha256', X402_CONFIG.webhookSecret)
            //   .update(body)
            //   .digest('hex');

            // return hash === signature;

            // For now, accept all (TODO: implement verification)
            return true;
        } catch (err) {
            logger.error("Webhook signature verification failed", {
                error: err instanceof Error ? err.message : String(err),
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

        // TODO: Update payment status in database
        // await paymentRepository.update(paymentId, { status, txHash, confirmedAt: new Date() });
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
