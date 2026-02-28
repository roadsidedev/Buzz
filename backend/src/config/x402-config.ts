/**
 * x402 Payment System Configuration
 *
 * Configures the x402 SDK for micropayments, spawn fees, and revenue distribution.
 * Supports both Base (EVM) and Solana chains via CDP facilitator.
 *
 * @see https://docs.x402.io/
 */

import { logger } from "../utils/logger.js";
import {
  type ChainType,
  isValidEvmAddress,
  isValidSolanaAddress,
} from "../utils/wallet-utils.js";

export type { ChainType };

/**
 * x402 Configuration
 */
export const X402_CONFIG = {
  // API credentials (CDP facilitator)
  apiKey: process.env.X402_API_KEY || "",
  secretKey: process.env.X402_SECRET_KEY || "",

  // Supported chains
  supportedChains: (
    process.env.X402_SUPPORTED_CHAINS || "base,solana"
  ).split(",") as ChainType[],

  // ── Base (EVM) ──────────────────────────────────────────────
  base: {
    platformWallet: process.env.PLATFORM_WALLET || "",
    network: process.env.X402_NETWORK || "base-sepolia",
    rpcUrl:
      process.env.ETH_RPC_URL ||
      "https://sepolia.base.org",
  },

  // ── Solana ──────────────────────────────────────────────────
  solana: {
    platformWallet: process.env.SOLANA_PLATFORM_WALLET || "",
    network: process.env.SOLANA_NETWORK || "devnet",
    rpcUrl:
      process.env.SOLANA_RPC_URL ||
      "https://api.devnet.solana.com",
  },

  // Webhook security
  webhookSecret: process.env.X402_WEBHOOK_SECRET || "",

  // Payment amounts — unified USDC (6 decimals on all chains)
  // 1 USDC = 1_000_000 micro-units
  minSpawnFee: BigInt(process.env.MIN_SPAWN_FEE || "1000000"), // 1 USDC
  maxSpawnFee: BigInt(process.env.MAX_SPAWN_FEE || "1000000000"), // 1000 USDC
  usdcDecimals: 6,

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
  strictValidation: process.env.X402_STRICT_VALIDATION === "true",
};

/**
 * Get platform wallet for a given chain
 */
export function getPlatformWallet(chain: ChainType): string {
  return chain === "solana"
    ? X402_CONFIG.solana.platformWallet
    : X402_CONFIG.base.platformWallet;
}

/**
 * Get network name for a given chain
 */
export function getNetwork(chain: ChainType): string {
  return chain === "solana"
    ? X402_CONFIG.solana.network
    : X402_CONFIG.base.network;
}

/**
 * Check if a chain is supported
 */
export function isChainSupported(chain: string): chain is ChainType {
  return X402_CONFIG.supportedChains.includes(chain as ChainType);
}

/**
 * Validate x402 configuration on startup
 */
export function validateX402Config(): void {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!X402_CONFIG.apiKey) {
    errors.push("X402_API_KEY is not set");
  }

  if (!X402_CONFIG.secretKey) {
    errors.push("X402_SECRET_KEY is not set");
  }

  if (!X402_CONFIG.webhookSecret) {
    errors.push("X402_WEBHOOK_SECRET is not set");
  }

  // Validate Base config
  if (X402_CONFIG.supportedChains.includes("base")) {
    if (!X402_CONFIG.base.platformWallet) {
      errors.push("PLATFORM_WALLET is not set (required for Base chain)");
    } else if (!isValidEvmAddress(X402_CONFIG.base.platformWallet)) {
      errors.push(
        "PLATFORM_WALLET is not a valid EVM address (expected 0x + 40 hex chars)",
      );
    }
  }

  // Validate Solana config
  if (X402_CONFIG.supportedChains.includes("solana")) {
    if (!X402_CONFIG.solana.platformWallet) {
      warnings.push(
        "SOLANA_PLATFORM_WALLET is not set — Solana payments will be unavailable",
      );
    } else if (!isValidSolanaAddress(X402_CONFIG.solana.platformWallet)) {
      errors.push(
        "SOLANA_PLATFORM_WALLET is not a valid Solana address (expected Base58, 32-44 chars)",
      );
    }
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

  // Log warnings
  for (const w of warnings) {
    logger.warn(`x402 config warning: ${w}`);
  }

  if (errors.length > 0) {
    logger.error("x402 configuration errors", { errors });

    if (X402_CONFIG.enablePayments && X402_CONFIG.strictValidation) {
      throw new Error(`x402 configuration invalid: ${errors.join("; ")}`);
    } else if (X402_CONFIG.enablePayments) {
      logger.warn(
        "x402 payments enabled but credentials not set — running in limited mode",
      );
    } else {
      logger.warn("x402 payments disabled, configuration errors ignored");
    }
  }

  logger.info("✅ x402 configuration validated", {
    supportedChains: X402_CONFIG.supportedChains,
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
  chain: ChainType;
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
  chain: ChainType;
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
    logger.info("x402 payment system initialized", {
      chains: X402_CONFIG.supportedChains,
    });
  } catch (err) {
    logger.error("Failed to initialize x402 payment system", {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
