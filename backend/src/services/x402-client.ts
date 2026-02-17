/**
 * x402 SDK Client Mock
 *
 * Simulates the x402 payment protocol for development and testing.
 * In production, this would be replaced with the actual @coinbase/x402 SDK.
 *
 * x402 Protocol Overview:
 * - Uses HTTP 402 Payment Required status code
 * - Enables micropayments over HTTP
 * - Supports ERC-20 tokens (USDC, etc.)
 * - Automatic payment negotiation
 */

import { logger } from "../utils/logger.js";
import { X402Error, PaymentStatus } from "./x402-config.js";

export interface X402PaymentRequest {
  from: string; // Payer wallet address
  to: string; // Payee wallet address
  amount: bigint; // Amount in smallest unit (e.g., wei)
  token?: string; // Token contract address (defaults to USDC)
  metadata?: Record<string, unknown>;
}

export interface X402PaymentResponse {
  id: string; // Payment ID
  txHash: string; // Transaction hash
  status: PaymentStatus;
  from: string;
  to: string;
  amount: bigint;
  fee: bigint;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface X402Transaction {
  hash: string;
  from: string;
  to: string;
  amount: bigint;
  status: "pending" | "confirmed" | "failed";
  blockNumber?: number;
  confirmations: number;
  timestamp: number;
}

/**
 * Mock x402 Client
 * Simulates the x402 SDK for development
 */
export class X402Client {
  private apiKey: string;
  private network: string;
  private mockMode: boolean;

  constructor(config: {
    apiKey: string;
    secretKey: string;
    network: string;
    mockMode?: boolean;
  }) {
    this.apiKey = config.apiKey;
    this.network = config.network;
    this.mockMode = config.mockMode ?? true; // Default to mock for safety

    logger.info("x402 Client initialized", {
      network: this.network,
      mockMode: this.mockMode,
      hasApiKey: !!this.apiKey,
    });
  }

  /**
   * Create a payment request
   * In mock mode, simulates transaction immediately
   */
  async createPayment(
    request: X402PaymentRequest,
  ): Promise<X402PaymentResponse> {
    try {
      logger.info("Creating x402 payment", {
        from: `${request.from.slice(0, 6)}...${request.from.slice(-4)}`,
        to: `${request.to.slice(0, 6)}...${request.to.slice(-4)}`,
        amount: request.amount.toString(),
        mockMode: this.mockMode,
      });

      if (this.mockMode) {
        // Simulate payment in mock mode
        return this._createMockPayment(request);
      }

      // Real x402 API call would go here
      // const response = await fetch(`${X402_API_URL}/payments`, {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Bearer ${this.apiKey}`,
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify(request),
      // });

      throw new X402Error(
        "Real x402 API not implemented - use mock mode",
        "NOT_IMPLEMENTED",
      );
    } catch (err) {
      logger.error("Failed to create x402 payment", {
        error: err instanceof Error ? err.message : String(err),
        from: request.from,
        to: request.to,
      });
      throw err;
    }
  }

  /**
   * Get transaction status
   */
  async getTransaction(txHash: string): Promise<X402Transaction> {
    try {
      logger.debug("Fetching x402 transaction", { txHash });

      if (this.mockMode) {
        return this._getMockTransaction(txHash);
      }

      // Real API call would go here
      throw new X402Error(
        "Real x402 API not implemented - use mock mode",
        "NOT_IMPLEMENTED",
      );
    } catch (err) {
      logger.error("Failed to fetch x402 transaction", {
        txHash,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  /**
   * Verify a payment is complete
   */
  async verifyPayment(txHash: string): Promise<boolean> {
    try {
      const tx = await this.getTransaction(txHash);
      return tx.status === "confirmed" && tx.confirmations >= 1;
    } catch {
      return false;
    }
  }

  /**
   * Get wallet balance
   */
  async getBalance(walletAddress: string): Promise<bigint> {
    if (this.mockMode) {
      // Return mock balance
      return BigInt("1000000000000000000000"); // 1000 tokens
    }

    throw new X402Error(
      "Real x402 API not implemented - use mock mode",
      "NOT_IMPLEMENTED",
    );
  }

  /**
   * Create mock payment for development/testing
   */
  private _createMockPayment(request: X402PaymentRequest): X402PaymentResponse {
    const paymentId = `pay-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const txHash = `0x${Array(64)
      .fill(0)
      .map(() => Math.floor(Math.random() * 16).toString(16))
      .join("")}`;

    // Simulate 10% chance of pending (for testing status updates)
    const status =
      Math.random() > 0.9 ? PaymentStatus.PENDING : PaymentStatus.CONFIRMED;

    const payment: X402PaymentResponse = {
      id: paymentId,
      txHash,
      status,
      from: request.from,
      to: request.to,
      amount: request.amount,
      fee: (request.amount * BigInt(1)) / BigInt(100), // 1% fee
      timestamp: Date.now(),
      metadata: request.metadata,
    };

    // Store in mock database
    MockX402Database.transactions.set(txHash, {
      hash: txHash,
      from: request.from,
      to: request.to,
      amount: request.amount,
      status: status === PaymentStatus.CONFIRMED ? "confirmed" : "pending",
      confirmations: status === PaymentStatus.CONFIRMED ? 12 : 0,
      timestamp: Date.now(),
    });

    logger.info("Mock payment created", {
      paymentId,
      txHash: `${txHash.slice(0, 10)}...`,
      status,
      amount: request.amount.toString(),
    });

    return payment;
  }

  /**
   * Get mock transaction
   */
  private _getMockTransaction(txHash: string): X402Transaction {
    const tx = MockX402Database.transactions.get(txHash);

    if (!tx) {
      throw new X402Error("Transaction not found", "TX_NOT_FOUND", { txHash });
    }

    // Simulate progress for pending transactions
    if (tx.status === "pending") {
      tx.confirmations += Math.floor(Math.random() * 3);
      if (tx.confirmations >= 12) {
        tx.status = "confirmed";
      }
    }

    return tx;
  }
}

/**
 * Mock database for development
 */
class MockX402Database {
  static transactions = new Map<string, X402Transaction>();
  static payments = new Map<string, X402PaymentResponse>();

  static clear() {
    this.transactions.clear();
    this.payments.clear();
  }
}

/**
 * x402 Payment Facilitator
 * Handles payment settlement and escrow
 */
export class X402Facilitator {
  private client: X402Client;

  constructor(client: X402Client) {
    this.client = client;
  }

  /**
   * Settle a payment from escrow
   */
  async settlePayment(paymentId: string): Promise<boolean> {
    logger.info("Settling x402 payment", { paymentId });
    // In real implementation, this would release funds from escrow
    return true;
  }

  /**
   * Refund a payment
   */
  async refundPayment(paymentId: string): Promise<boolean> {
    logger.info("Refunding x402 payment", { paymentId });
    // In real implementation, this would return funds to payer
    return true;
  }
}

/**
 * Utility functions
 */
export function formatTokenAmount(
  amount: bigint,
  decimals: number = 18,
): string {
  const divisor = BigInt(10) ** BigInt(decimals);
  const integerPart = amount / divisor;
  const fractionalPart = amount % divisor;

  const fractionalStr = fractionalPart.toString().padStart(decimals, "0");
  const trimmedFractional = fractionalStr.replace(/0+$/, "");

  return trimmedFractional
    ? `${integerPart}.${trimmedFractional}`
    : integerPart.toString();
}

export function parseTokenAmount(
  amount: string,
  decimals: number = 18,
): bigint {
  const [integerPart, fractionalPart = ""] = amount.split(".");
  const paddedFractional = (fractionalPart + "0".repeat(decimals)).slice(
    0,
    decimals,
  );

  const integer = BigInt(integerPart);
  const fractional = BigInt(paddedFractional);
  const divisor = BigInt(10) ** BigInt(decimals);

  return integer * divisor + fractional;
}
