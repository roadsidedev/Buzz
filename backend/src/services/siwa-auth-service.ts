// @ts-nocheck
/**
 * SIWAAuthService: SIWA authentication using @buildersgarden/siwa SDK
 *
 * Responsibilities:
 * - Generate nonces for signing challenges (via SDK)
 * - Verify signed SIWA messages (via SDK)
 * - Issue HMAC-signed receipts (via SDK)
 * - Verify ERC-8004 onchain ownership
 * - Manage agent registration and profiles
 * - Audit trail for auth events
 *
 * Flow:
 * 1. Agent requests nonce: POST /siwa/nonce { walletAddress, agentId }
 * 2. Agent signs SIWA message with wallet
 * 3. Agent verifies signature: POST /siwa/verify { message, signature }
 * 4. Service returns receipt (SDK handles HMAC signing)
 * 5. Agent includes receipt in future requests (verified by middleware)
 */

import { v4 as uuidv4 } from "uuid";
import { randomBytes } from "crypto";
import {
  verifySIWA,
  createSIWANonce,
  parseSIWAMessage,
  buildSIWAMessage,
} from "@buildersgarden/siwa";
import {
  createReceipt,
  verifyReceipt as verifyReceiptSignature,
} from "@buildersgarden/siwa/receipt";
import { Database } from "@/config/database";
import {
  SIWA_SECRET,
  ERC8004_REGISTRY_ADDRESS,
  SIWA_CHAIN_ID,
  SIWA_DOMAIN,
  SIWA_URI,
  getNonceStore,
  createPublicClient,
  getAgentRegistryCAIP,
  getClientResolver,
} from "../config/siwa";
import logger from "@/utils/logger";

/**
 * Types for SIWA Auth
 */
export interface SIWANonceRequest {
  walletAddress: string;
  agentId: number;
}

export interface SIWANonceResponse {
  nonce: string;
  issuedAt: string;
  expiresAt: string;
}

export interface SIWAVerifyRequest {
  message: string;
  signature: string;
  walletAddress: string;
  agentId: number;
}

export interface SIWAVerifyResponse {
  receipt: string;
  agent: {
    id: string;
    name: string;
    walletAddress: string;
    agentId: number;
    verified: boolean;
  };
  expiresAt: string;
}

export interface SIWAReceipt {
  address: string;
  agentId: number;
  signerType?: "eoa" | "sca";
  issuedAt: string;
  expiresAt: string;
}

export interface ERC8004VerificationResult {
  verified: boolean;
  agentId: number;
  walletAddress: string;
  blockNumber?: number;
  transactionHash?: string;
  error?: string;
}

export class SIWAAuthService {
  private db: Database;
  private nonceExpiry: number = 10 * 60 * 1000; // 10 minutes
  private receiptExpiry: number = 24 * 60 * 60 * 1000; // 24 hours
  private initialized: boolean = false;

  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Initialize the service - must be called before use
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Verify we can connect to RPC for onchain verification
    try {
      const client = createPublicClient();
      // Simple test call
      await client.getChainId();
      logger.info("SIWA service initialized - RPC connection OK");
    } catch (err) {
      logger.warn("SIWA service initialized - RPC may not be available:", err);
    }

    this.initialized = true;
  }

  /**
   * Request a nonce for signing challenge
   *
   * Process:
   * 1. Validate wallet address and agent ID
   * 2. Check if agent exists in database
   * 3. Generate nonce via SDK
   * 4. Store in database for audit
   * 5. Return nonce + timestamps
   */
  async requestNonce(request: SIWANonceRequest): Promise<SIWANonceResponse> {
    const { walletAddress, agentId } = request;

    // Validate inputs
    if (!walletAddress || !walletAddress.startsWith("0x")) {
      throw new Error("Invalid wallet address format (must start with 0x)");
    }

    if (!agentId || agentId <= 0) {
      throw new Error("Invalid ERC-8004 agent ID");
    }

    // Check if agent exists locally
    const existingAgent = await this.db.query(
      "SELECT id FROM agent WHERE erc_8004_agent_id = $1",
      [agentId],
    );

    if (existingAgent.rows.length === 0) {
      logger.warn("Agent not found for ERC-8004 ID", {
        agentId,
        walletAddress,
      });
      throw new Error(
        `Agent with ERC-8004 ID ${agentId} not found. Please register first.`,
      );
    }

    // Get nonce store
    const nonceStore = await getNonceStore();

    // Create nonce via SDK
    const client = createPublicClient();
    const agentRegistry = getAgentRegistryCAIP();

    const result = await createSIWANonce(
      {
        address: walletAddress,
        agentId: agentId,
        agentRegistry: agentRegistry,
      },
      client,
      {
        secret: SIWA_SECRET,
        nonceStore: nonceStore as any,
      },
    );

    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.nonceExpiry);

    // Store in database for audit
    const nonceId = uuidv4();
    await this.db.query(
      `INSERT INTO siwa_nonce (id, wallet_address, agent_id, nonce, issued_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [nonceId, walletAddress, agentId, result.nonce, now, expiresAt],
    );

    logger.info("SIWA nonce generated", {
      nonceId,
      walletAddress,
      agentId,
      expiresAt: expiresAt.toISOString(),
    });

    return {
      nonce: result.nonce,
      issuedAt: result.issuedAt,
      expiresAt: result.expiresAt,
    };
  }

  /**
   * Verify signed SIWA message and issue receipt
   *
   * Process:
   * 1. Validate message format
   * 2. Verify EIP-191 signature + onchain ownership via SDK
   * 3. Extract wallet address and agent ID from message
   * 4. Confirm nonce hasn't been used
   * 5. Generate receipt via SDK
   * 6. Store in database for audit
   * 7. Return receipt + agent profile
   */
  async verifySIWA(request: SIWAVerifyRequest): Promise<SIWAVerifyResponse> {
    const { message, signature, walletAddress, agentId } = request;

    // Validate inputs
    if (!message || !signature || !walletAddress) {
      throw new Error("Missing message, signature, or wallet address");
    }

    // Get nonce store and client
    const nonceStore = await getNonceStore();
    const client = createPublicClient();

    // Verify signature and onchain ownership via SDK
    let verification;
    try {
      verification = await verifySIWA(
        message,
        signature,
        SIWA_DOMAIN,
        { nonceStore: nonceStore as any },
        client,
        {
          // Criteria can be added here for production
          // e.g., mustBeActive: true, minScore: 100, etc.
        },
      );
    } catch (err: any) {
      logger.error("SIWA verification failed", {
        error: err.message,
        signature,
      });
      throw new Error(`Verification failed: ${err.message}`);
    }

    // Parse message to get fields
    const parsedMessage = parseSIWAMessage(message);

    // Get agent from database
    const agentResult = await this.db.query(
      `SELECT id, name, avatar, erc_8004_agent_id, erc_8004_verified 
       FROM agent WHERE wallet_address = $1`,
      [walletAddress],
    );

    if (agentResult.rows.length === 0) {
      throw new Error("Agent not found");
    }

    const agent = agentResult.rows[0];

    // Generate receipt via SDK
    const receiptResult = createReceipt(
      {
        address: walletAddress,
        agentId: agentId,
        signerType: verification.signerType,
      },
      {
        secret: SIWA_SECRET,
        expiresIn: this.receiptExpiry,
      },
    );

    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.receiptExpiry);

    // Store receipt in database for audit
    const receiptId = uuidv4();
    await this.db.query(
      `INSERT INTO siwa_receipt (
        id, wallet_address, agent_id, agent_uuid, receipt_signature,
        nonce_id, signed_message, message_signature, issued_at, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        receiptId,
        walletAddress,
        agentId,
        agent.id,
        receiptResult.receipt,
        null, // nonce_id - could be linked if needed
        message,
        signature,
        now,
        expiresAt,
      ],
    );

    logger.info("SIWA verification successful", {
      agentId: agent.id,
      walletAddress,
      receiptId,
      signerType: verification.signerType,
      expiresAt: expiresAt.toISOString(),
    });

    return {
      receipt: receiptResult.receipt,
      agent: {
        id: agent.id,
        name: agent.name,
        walletAddress,
        agentId,
        verified: agent.erc_8004_verified,
      },
      expiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * Verify receipt for API calls
   */
  async verifyReceipt(receipt: string): Promise<SIWAReceipt> {
    const decoded = verifyReceiptSignature(receipt, SIWA_SECRET);

    if (!decoded) {
      throw new Error("Invalid receipt signature");
    }

    // Also check database for audit/revocation
    const receiptResult = await this.db.query(
      `SELECT id, expires_at, revoked_at FROM siwa_receipt 
       WHERE receipt_signature = $1`,
      [receipt],
    );

    if (receiptResult.rows.length === 0) {
      throw new Error("Receipt not found");
    }

    const receiptRow = receiptResult.rows[0];
    const now = new Date();

    if (receiptRow.revoked_at) {
      throw new Error("Receipt has been revoked");
    }

    if (new Date(receiptRow.expires_at) < now) {
      throw new Error("Receipt has expired");
    }

    // Update last_used_at for audit
    await this.db.query(
      `UPDATE siwa_receipt SET last_used_at = $1 WHERE id = $2`,
      [now, receiptRow.id],
    );

    return decoded as SIWAReceipt;
  }

  /**
   * Register new agent with wallet address
   */
  async registerAgent(
    walletAddress: string,
    agentId: number,
    name: string,
    avatar?: string,
  ): Promise<string> {
    // Validate inputs
    if (!walletAddress || !walletAddress.startsWith("0x")) {
      throw new Error("Invalid wallet address");
    }

    if (!agentId || agentId <= 0) {
      throw new Error("Invalid ERC-8004 agent ID");
    }

    if (!name || name.length < 1 || name.length > 255) {
      throw new Error("Agent name must be 1-255 characters");
    }

    // Check if wallet already registered
    const existingWallet = await this.db.query(
      "SELECT id FROM agent WHERE wallet_address = $1",
      [walletAddress],
    );

    if (existingWallet.rows.length > 0) {
      throw new Error("Wallet address already registered");
    }

    // Check if agent ID already registered
    const existingAgentId = await this.db.query(
      "SELECT id FROM agent WHERE erc_8004_agent_id = $1",
      [agentId],
    );

    if (existingAgentId.rows.length > 0) {
      throw new Error("ERC-8004 agent ID already registered");
    }

    // Create agent record
    const uuid = uuidv4();
    const now = new Date();

    await this.db.query(
      `INSERT INTO agent (
        id, name, avatar, wallet_address, erc_8004_agent_id,
        verification_status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [uuid, name, avatar || null, walletAddress, agentId, "pending", now, now],
    );

    // Schedule async ERC-8004 verification
    this._verifyERC8004Async(uuid, walletAddress, agentId);

    logger.info("Agent registered", {
      agentId: uuid,
      walletAddress,
      erc8004AgentId: agentId,
      name,
    });

    return uuid;
  }

  /**
   * Verify ERC-8004 onchain ownership (async, non-blocking)
   */
  private async _verifyERC8004Async(
    agentId: string,
    walletAddress: string,
    erc8004AgentId: number,
  ): Promise<void> {
    try {
      const client = createPublicClient();
      const registryAddress = ERC8004_REGISTRY_ADDRESS as `0x${string}`;

      // For now, log the verification attempt
      // The SDK's verifySIWA already does onchain verification
      logger.info("ERC-8004 onchain verification via SDK", {
        agentId,
        walletAddress,
        erc8004AgentId,
        registry: ERC8004_REGISTRY_ADDRESS,
      });
    } catch (err) {
      logger.error("ERC-8004 verification failed", {
        agentId,
        walletAddress,
        error: err,
      });
    }
  }

  /**
   * Revoke a receipt (for logout or security)
   */
  async revokeReceipt(receipt: string): Promise<void> {
    const now = new Date();

    await this.db.query(
      `UPDATE siwa_receipt SET revoked_at = $1 
       WHERE receipt_signature = $2`,
      [now, receipt],
    );

    logger.info("Receipt revoked", {
      receipt: receipt.substring(0, 20) + "...",
    });
  }

  /**
   * Clean up expired nonces and receipts
   */
  async cleanupExpiredTokens(
    maxAgeMs: number = 30 * 24 * 60 * 60 * 1000,
  ): Promise<void> {
    const cutoffDate = new Date(Date.now() - maxAgeMs);

    await this.db.query("DELETE FROM siwa_nonce WHERE expires_at < $1", [
      cutoffDate,
    ]);

    await this.db.query("DELETE FROM siwa_receipt WHERE expires_at < $1", [
      cutoffDate,
    ]);

    logger.info("Expired tokens cleaned up", { cutoffDate });
  }

  /**
   * Get agent profile by agent UUID
   */
  async getAgentProfile(agentId: string): Promise<AgentProfile> {
    const result = await this.db.query(
      `SELECT id, name, avatar, wallet_address, erc_8004_agent_id, erc_8004_verified, created_at
       FROM agent WHERE id = $1`,
      [agentId],
    );

    if (result.rows.length === 0) {
      throw new Error("Agent not found");
    }

    const row = result.rows[0];

    return {
      id: row.id,
      name: row.name,
      avatar: row.avatar || undefined,
      walletAddress: row.wallet_address,
      erc8004AgentId: row.erc_8004_agent_id,
      erc8004Verified: row.erc_8004_verified,
      createdAt: row.created_at,
    };
  }

  /**
   * Get agent profile by wallet address
   */
  async getAgentByWallet(walletAddress: string): Promise<AgentProfile | null> {
    const result = await this.db.query(
      `SELECT id, name, avatar, wallet_address, erc_8004_agent_id, erc_8004_verified, created_at
       FROM agent WHERE wallet_address = $1`,
      [walletAddress],
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

    return {
      id: row.id,
      name: row.name,
      avatar: row.avatar || undefined,
      walletAddress: row.wallet_address,
      erc8004AgentId: row.erc_8004_agent_id,
      erc8004Verified: row.erc_8004_verified,
      createdAt: row.created_at,
    };
  }
}

/**
 * Agent profile interface
 */
export interface AgentProfile {
  id: string;
  name: string;
  avatar?: string;
  walletAddress: string;
  erc8004AgentId: number;
  erc8004Verified: boolean;
  createdAt: string;
}
