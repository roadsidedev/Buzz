/**
 * x402 Payment System Configuration
 *
 * Configures the x402 SDK for micropayments, spawn fees, and revenue distribution.
 *
 * Phase 2 (Day 4): Payment Integration
 *
 * @see https://docs.x402.io/
 */

import { logger } from "../utils/logger.js";

/**
 * x402 Configuration
 */
export const X402_CONFIG = {
  // API credentials
  apiKey: process.env.X402_API_KEY || "",
  secretKey: process.env.X402_SECRET_KEY || "",

  // Wallet addresses
  platformWallet: process.env.PLATFORM_WALLET || "",

  // Webhook security
  webhookSecret: process.env.X402_WEBHOOK_SECRET || "",

  // Network
  network: process.env.X402_NETWORK || "sepolia", // sepolia for testnet
  rpcUrl: process.env.ETH_RPC_URL || "https://sepolia.infura.io/v3/",

  // Payment amounts (in smallest unit, e.g., wei)
  minSpawnFee: BigInt(process.env.MIN_SPAWN_FEE || "1000000000000000000"), // 1 token
  maxSpawnFee: BigInt(process.env.MAX_SPAWN_FEE || "1000000000000000000000"), // 1000 tokens

  // Revenue splits (percentages that sum to 100)
  revenueSplit: {
    host: 0.5, // 50% to room host
    participants: 0.4, // 40% shared among participants
    platform: 0.1, // 10% to platform
  },

  // Timeouts and retries
  paymentTimeoutMs: 30 * 1000, // 30 seconds to confirm payment
  maxRetries: 3,
  retryDelayMs: 5000, // 5 seconds between retries

  // Feature flags
  enablePayments: process.env.ENABLE_PAYMENTS !== "false",
  enableWebhooks: process.env.ENABLE_WEBHOOKS !== "false",
};

/**
 * Validate x402 configuration on startup
 */
export function validateX402Config(): void {
  const errors: string[] = [];

  if (!X402_CONFIG.apiKey) {
    errors.push("X402_API_KEY is not set");
  }

  if (!X402_CONFIG.secretKey) {
    errors.push("X402_SECRET_KEY is not set");
  }

  if (
    !X402_CONFIG.platformWallet ||
    !X402_CONFIG.platformWallet.startsWith("0x")
  ) {
    errors.push("PLATFORM_WALLET is not set or invalid");
  }

  if (!X402_CONFIG.webhookSecret) {
    errors.push("X402_WEBHOOK_SECRET is not set");
  }

  // Check revenue splits sum to 100%
  const totalSplit =
    X402_CONFIG.revenueSplit.host +
    X402_CONFIG.revenueSplit.participants +
    X402_CONFIG.revenueSplit.platform;

  if (Math.abs(totalSplit - 1.0) > 0.001) {
    errors.push(
      `Revenue splits do not sum to 100% (got ${(totalSplit * 100).toFixed(1)}%)`,
    );
  }

  if (errors.length > 0) {
    logger.error("x402 configuration errors", { errors });

    if (X402_CONFIG.enablePayments) {
      throw new Error(`x402 configuration invalid: ${errors.join("; ")}`);
    } else {
      logger.warn("x402 payments disabled, configuration errors ignored");
    }
  }

  logger.info("✅ x402 configuration validated", {
    network: X402_CONFIG.network,
    enablePayments: X402_CONFIG.enablePayments,
    enableWebhooks: X402_CONFIG.enableWebhooks,
    revenueSplit: `${(X402_CONFIG.revenueSplit.host * 100).toFixed(0)}/${(X402_CONFIG.revenueSplit.participants * 100).toFixed(0)}/${(X402_CONFIG.revenueSplit.platform * 100).toFixed(0)}`,
  });
}

/**
 * Payment status enum
 */
export enum PaymentStatus {
  PENDING = "pending",
  CONFIRMING = "confirming",
  CONFIRMED = "confirmed",
  FAILED = "failed",
  FAILED_INSUFFICIENT_FUNDS = "failed_insufficient_funds",
  FAILED_RATE_LIMIT = "failed_rate_limit",
  FAILED_OTHER = "failed_other",
  REFUNDED = "refunded",
}

/**
 * Payment type enum
 */
export enum PaymentType {
  SPAWN_FEE = "spawn_fee",
  HOST_PAYOUT = "host_payout",
  PARTICIPANT_PAYOUT = "participant_payout",
  PLATFORM_REVENUE = "platform_revenue",
  REFUND = "refund",
}

/**
 * Payment record interface
 */
export interface PaymentRecord {
  id: string;
  agentId: string;
  roomId?: string;
  walletAddress?: string;
  amount: bigint;
  type: PaymentType;
  status: PaymentStatus;
  txHash?: string;
  blockNumber?: number;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  confirmedAt?: Date;
}

/**
 * x402 transaction interface
 */
export interface X402Transaction {
  hash: string;
  from: string;
  to: string;
  amount: bigint;
  status: "pending" | "confirmed" | "failed";
  blockNumber?: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

/**
 * x402 error types
 */
export class X402Error extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, any>,
  ) {
    super(message);
    this.name = "X402Error";
  }
}

/**
 * Initialize and validate x402 on startup
 */
export function initializeX402(): void {
  try {
    validateX402Config();
    logger.info("x402 payment system initialized");
  } catch (err) {
    logger.error("Failed to initialize x402 payment system", {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
