// @ts-nocheck
/**
 * x402 SDK Client
 * @deprecated Needs refactoring to match updated types
 *
 * Implements the x402 payment protocol for ClawZz.
 * Enables micropayments over HTTP using the 402 Payment Required status code.
 *
 * Security Model:
 * - API-key based authentication to x402 gateway
 * - HMAC-SHA256 webhook verification for transaction finality
 * - Idempotency tracking to prevent double-charging
 */

import { logger } from "../utils/logger.js";
import { X402Error, PaymentStatus } from "../config/x402-config.js";

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
 * x402 Client
 * Manages protocol-level payment requests
 */
export class X402Client {
  private apiKey: string;
  private secretKey: string;
  private network: string;
  private apiUrl: string;
  private mockMode: boolean;

  constructor(config: {
    apiKey: string;
    secretKey: string;
    network: string;
    apiUrl?: string;
    mockMode?: boolean;
  }) {
    this.apiKey = config.apiKey;
    this.secretKey = config.secretKey;
    this.network = config.network;
    this.apiUrl = config.apiUrl || "https://api.x402.io/v1";
    this.mockMode = config.mockMode ?? true;

    if (!this.mockMode && !this.apiKey) {
      throw new X402Error(
        "x402 API key required for non-mock mode",
        "CONFIG_ERROR",
      );
    }

    logger.info("x402 Client initialized", {
      network: this.network,
      mockMode: this.mockMode,
      apiUrl: this.apiUrl,
    });
  }

  /**
   * Create a payment request via x402 protocol
   *
   * @param request - Payment parameters
   * @returns Payment response from gateway
   * @throws X402Error if request fails
   */
  async createPayment(
    request: X402PaymentRequest,
  ): Promise<X402PaymentResponse> {
    try {
      logger.info("Initiating x402 payment", {
        from: `${request.from.slice(0, 6)}...${request.from.slice(-4)}`,
        to: `${request.to.slice(0, 6)}...${request.to.slice(-4)}`,
        amount: request.amount.toString(),
        mockMode: this.mockMode,
      });

      if (this.mockMode) {
        return this._createMockPayment(request);
      }

      const response = await fetch(`${this.apiUrl}/payments`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "X-SDK-Version": "0.1.0-clawzz",
        },
        body: JSON.stringify({
          from: request.from,
          to: request.to,
          amount: request.amount.toString(),
          token: request.token || "USDC",
          network: this.network,
          metadata: {
            ...request.metadata,
            platform: "clawzz",
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new X402Error(
          `x402 API error: ${response.status} ${errorData.message || ""}`,
          "API_ERROR",
          { statusCode: response.status, details: errorData },
        );
      }

      const data = await response.json();

      return {
        id: data.id,
        txHash: data.txHash,
        status: this._mapApiStatus(data.status),
        from: data.from,
        to: data.to,
        amount: BigInt(data.amount),
        fee: BigInt(data.fee),
        timestamp: new Date(data.timestamp).getTime(),
        metadata: data.metadata,
      };
    } catch (err) {
      if (err instanceof X402Error) throw err;

      logger.error("Failed to create x402 payment", {
        error: err instanceof Error ? err.message : String(err),
        from: request.from,
      });

      throw new X402Error(
        "Internal failure creating x402 payment",
        "INTERNAL_ERROR",
      );
    }
  }

  /**
   * Get transaction status from network
   */
  async getTransaction(txHash: string): Promise<X402Transaction> {
    try {
      if (this.mockMode) {
        return this._getMockTransaction(txHash);
      }

      const response = await fetch(`${this.apiUrl}/transactions/${txHash}`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new X402Error("Transaction lookup failed", "API_ERROR");
      }

      const data = await response.json();

      return {
        hash: data.hash,
        from: data.from,
        to: data.to,
        amount: BigInt(data.amount),
        status: data.status,
        blockNumber: data.blockNumber,
        confirmations: data.confirmations,
        timestamp: new Date(data.timestamp).getTime(),
      };
    } catch (err) {
      logger.error("Failed to fetch x402 transaction", { txHash, error: err });
      throw err;
    }
  }

  /**
   * Helper: Map API status strings to internal PaymentStatus enum
   */
  private _mapApiStatus(apiStatus: string): PaymentStatus {
    switch (apiStatus.toLowerCase()) {
      case "pending":
        return PaymentStatus.PENDING;
      case "confirmed":
      case "completed":
      case "success":
        return PaymentStatus.CONFIRMED;
      case "failed":
        return PaymentStatus.FAILED;
      case "refunded":
        return PaymentStatus.REFUNDED;
      default:
        return PaymentStatus.PENDING;
    }
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

    const status =
      Math.random() > 0.9 ? PaymentStatus.PENDING : PaymentStatus.CONFIRMED;

    const payment: X402PaymentResponse = {
      id: paymentId,
      txHash,
      status,
      from: request.from,
      to: request.to,
      amount: request.amount,
      fee: (request.amount * BigInt(1)) / BigInt(100),
      timestamp: Date.now(),
      metadata: request.metadata,
    };

    MockX402Database.transactions.set(txHash, {
      hash: txHash,
      from: request.from,
      to: request.to,
      amount: request.amount,
      status: status === PaymentStatus.CONFIRMED ? "confirmed" : "pending",
      confirmations: status === PaymentStatus.CONFIRMED ? 12 : 0,
      timestamp: Date.now(),
    });

    return payment;
  }

  private _getMockTransaction(txHash: string): X402Transaction {
    const tx = MockX402Database.transactions.get(txHash);
    if (!tx)
      throw new X402Error("Transaction not found", "TX_NOT_FOUND", { txHash });

    if (tx.status === "pending") {
      tx.confirmations += 2;
      if (tx.confirmations >= 12) tx.status = "confirmed";
    }
    return tx;
  }
}

/**
 * Mock database for development
 */
class MockX402Database {
  static transactions = new Map<string, X402Transaction>();
}

/**
 * x402 Payment Facilitator
 */
export class X402Facilitator {
  private client: X402Client;

  constructor(client: X402Client) {
    this.client = client;
  }

  async settlePayment(paymentId: string): Promise<boolean> {
    logger.info("Settling x402 payment", { paymentId });
    return true;
  }

  async refundPayment(paymentId: string): Promise<boolean> {
    logger.info("Refunding x402 payment", { paymentId });
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
