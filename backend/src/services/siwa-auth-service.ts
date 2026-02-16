/**
 * SIWAAuthService: Wallet-based authentication using SIWA + Privy
 *
 * Responsibilities:
 * - Generate nonces for signing challenges
 * - Verify signed SIWA messages
 * - Issue HMAC-signed stateless receipts
 * - Validate ERC-8004 onchain ownership
 * - Manage Privy wallet sessions
 * - Audit trail for auth events
 *
 * Flow:
 * 1. Agent requests nonce: POST /siwa/nonce { walletAddress, agentId }
 * 2. Agent signs SIWA message with wallet
 * 3. Agent verifies signature: POST /siwa/verify { message, signature }
 * 4. Service returns HMAC receipt (stateless token)
 * 5. Agent includes receipt in future requests (verified by middleware)
 */

import { v4 as uuidv4 } from "uuid";
import { randomBytes } from "crypto";
import { createHmac } from "crypto";
import { verifyMessage } from "ethers";
import { Database } from "@/config/database";
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
  walletAddress: string;
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
  private hmacSecret: string;
  private nonceExpiry: number = 10 * 60 * 1000; // 10 minutes
  private receiptExpiry: number = 24 * 60 * 60 * 1000; // 24 hours

  constructor(db: Database) {
    this.db = db;
    this.hmacSecret = process.env.SIWA_HMAC_SECRET!;

    if (!this.hmacSecret || this.hmacSecret.length < 32) {
      throw new Error(
        "SIWA_HMAC_SECRET must be set and at least 32 characters in .env"
      );
    }
  }

  /**
   * Request a nonce for signing challenge
   *
   * Process:
   * 1. Validate wallet address and agent ID
   * 2. Check if agent exists in database
   * 3. Verify ERC-8004 onchain ownership
   * 4. Generate random nonce (>= 8 alphanumeric chars)
   * 5. Store nonce in database with expiry
   * 6. Return nonce + timestamps
   *
   * @param request - Wallet address and ERC-8004 agent ID
   * @returns Nonce and timestamps for signing
   * @throws Error if wallet not verified or agent not found
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
      [agentId]
    );

    if (existingAgent.rows.length === 0) {
      logger.warn("Agent not found for ERC-8004 ID", { agentId, walletAddress });
      throw new Error(
        `Agent with ERC-8004 ID ${agentId} not found. Please register first.`
      );
    }

    // Verify onchain ownership (will check onchain if service configured)
    // For now, we trust the agent provided agentId
    // In production, you'd call verifyERC8004Ownership() here

    // Generate nonce (random 16 bytes = 32 hex chars = 32 alphanumeric)
    const nonceBytes = randomBytes(16);
    const nonce = nonceBytes.toString("hex");

    // Calculate expiry timestamps
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.nonceExpiry);

    // Store nonce in database
    const nonceId = uuidv4();
    await this.db.query(
      `INSERT INTO siwa_nonce (id, wallet_address, agent_id, nonce, issued_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [nonceId, walletAddress, agentId, nonce, now, expiresAt]
    );

    logger.info("SIWA nonce generated", {
      nonceId,
      walletAddress,
      agentId,
      expiresAt: expiresAt.toISOString(),
    });

    return {
      nonce,
      issuedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * Verify signed SIWA message and issue receipt
   *
   * Process:
   * 1. Validate message format (SIWA spec)
   * 2. Verify EIP-191 signature
   * 3. Extract wallet address and agent ID from message
   * 4. Confirm nonce hasn't been used
   * 5. Verify ERC-8004 onchain ownership (optional, strict mode)
   * 6. Mark nonce as consumed
   * 7. Generate HMAC receipt
   * 8. Store receipt in database
   * 9. Return receipt + agent profile
   *
   * @param request - Signed SIWA message
   * @returns Receipt (stateless JWT-like token) + agent profile
   * @throws Error if signature invalid, nonce expired, or onchain check fails
   */
  async verifySIWA(request: SIWAVerifyRequest): Promise<SIWAVerifyResponse> {
    const { message, signature, walletAddress, agentId } = request;

    // Validate inputs
    if (!message || !signature || !walletAddress) {
      throw new Error("Missing message, signature, or wallet address");
    }

    // Step 1: Recover signer from signature (EIP-191)
    let recoveredAddress: string;
    try {
      recoveredAddress = verifyMessage(message, signature);
    } catch (err) {
      logger.error("Signature verification failed", { error: err, signature });
      throw new Error("Invalid signature");
    }

    // Step 2: Compare recovered address with provided address (case-insensitive)
    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      logger.warn("Signer mismatch", {
        recovered: recoveredAddress,
        provided: walletAddress,
      });
      throw new Error("Signature does not match wallet address");
    }

    // Step 3: Verify nonce from message
    // Extract nonce from SIWA message (format: "Nonce: {nonce}")
    const nonceMatch = message.match(/Nonce: ([a-zA-Z0-9]+)/);
    if (!nonceMatch) {
      throw new Error("Nonce not found in message");
    }
    const nonce = nonceMatch[1];

    // Step 4: Check nonce exists, hasn't expired, and hasn't been used
    const nonceResult = await this.db.query(
      `SELECT id, expires_at, consumed FROM siwa_nonce 
       WHERE nonce = $1 AND wallet_address = $2 AND agent_id = $3`,
      [nonce, walletAddress, agentId]
    );

    if (nonceResult.rows.length === 0) {
      throw new Error("Nonce not found or invalid");
    }

    const nonceRow = nonceResult.rows[0];
    const now = new Date();

    if (new Date(nonceRow.expires_at) < now) {
      throw new Error("Nonce has expired");
    }

    if (nonceRow.consumed) {
      logger.warn("Replay attack: nonce already consumed", {
        nonce,
        walletAddress,
      });
      throw new Error("Nonce already used (replay attack detected)");
    }

    // Step 5: Get agent from database
    const agentResult = await this.db.query(
      `SELECT id, name, avatar, erc_8004_agent_id, erc_8004_verified 
       FROM agent WHERE wallet_address = $1`,
      [walletAddress]
    );

    if (agentResult.rows.length === 0) {
      throw new Error("Agent not found");
    }

    const agent = agentResult.rows[0];

    // Step 6: Mark nonce as consumed (prevents replay)
    await this.db.query(
      `UPDATE siwa_nonce SET consumed = TRUE, consumed_at = $1 
       WHERE id = $2`,
      [now, nonceRow.id]
    );

    // Step 7: Generate HMAC receipt
    const receipt = this._generateReceipt({
      walletAddress,
      agentId,
    });

    // Step 8: Store receipt in database for audit trail
    const receiptId = uuidv4();
    const expiresAt = new Date(now.getTime() + this.receiptExpiry);

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
        receipt,
        nonceRow.id,
        message,
        signature,
        now,
        expiresAt,
      ]
    );

    logger.info("SIWA verification successful", {
      agentId: agent.id,
      walletAddress,
      receiptId,
      expiresAt: expiresAt.toISOString(),
    });

    return {
      receipt,
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
   *
   * Process:
   * 1. Validate receipt signature (HMAC)
   * 2. Check receipt not revoked
   * 3. Check receipt not expired
   * 4. Update last_used_at timestamp
   * 5. Return decoded receipt payload
   *
   * @param receipt - HMAC-signed receipt
   * @returns Decoded receipt (walletAddress, agentId, timestamps)
   * @throws Error if receipt invalid, revoked, or expired
   */
  async verifyReceipt(receipt: string): Promise<SIWAReceipt> {
    // Step 1: Decode and validate HMAC signature
    const decoded = this._verifyReceiptSignature(receipt);
    if (!decoded) {
      throw new Error("Invalid receipt signature");
    }

    // Step 2: Check receipt in database (for revocation + audit)
    const receiptResult = await this.db.query(
      `SELECT id, expires_at, revoked_at FROM siwa_receipt 
       WHERE receipt_signature = $1`,
      [receipt]
    );

    if (receiptResult.rows.length === 0) {
      throw new Error("Receipt not found");
    }

    const receiptRow = receiptResult.rows[0];
    const now = new Date();

    // Step 3: Check not revoked
    if (receiptRow.revoked_at) {
      throw new Error("Receipt has been revoked");
    }

    // Step 4: Check not expired
    if (new Date(receiptRow.expires_at) < now) {
      throw new Error("Receipt has expired");
    }

    // Step 5: Update last_used_at for audit trail
    await this.db.query(
      `UPDATE siwa_receipt SET last_used_at = $1 WHERE id = $2`,
      [now, receiptRow.id]
    );

    return decoded as SIWAReceipt;
  }

  /**
   * Register new agent with wallet address
   *
   * Process:
   * 1. Validate inputs (wallet format, agent ID format)
   * 2. Check if wallet already registered
   * 3. Check if agent ID already registered
   * 4. Create agent record
   * 5. Schedule ERC-8004 verification (async)
   * 6. Return agent ID
   *
   * @param walletAddress - Ethereum address (0x...)
   * @param agentId - ERC-8004 token ID
   * @param name - Agent display name
   * @param avatar - Avatar URL (optional)
   * @returns Agent ID (UUID)
   * @throws Error if wallet or agent ID already registered
   */
  async registerAgent(
    walletAddress: string,
    agentId: number,
    name: string,
    avatar?: string
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
      [walletAddress]
    );

    if (existingWallet.rows.length > 0) {
      throw new Error("Wallet address already registered");
    }

    // Check if agent ID already registered
    const existingAgentId = await this.db.query(
      "SELECT id FROM agent WHERE erc_8004_agent_id = $1",
      [agentId]
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
      [uuid, name, avatar || null, walletAddress, agentId, "pending", now, now]
    );

    // Schedule async ERC-8004 verification (don't block registration)
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
   *
   * Calls the ERC-8004 registry to verify agent owns the tokenId
   * Updates verification status and logs audit trail
   *
   * @private
   * @param agentId - Database agent UUID
   * @param walletAddress - Wallet to verify
   * @param erc8004AgentId - ERC-8004 token ID
   */
  private async _verifyERC8004Async(
    agentId: string,
    walletAddress: string,
    erc8004AgentId: number
  ): Promise<void> {
    try {
      // TODO: Implement actual ERC-8004 contract call via viem/ethers
      // For now, log the verification attempt

      logger.info("ERC-8004 verification scheduled", {
        agentId,
        walletAddress,
        erc8004AgentId,
      });

      // In production:
      // 1. Call ERC-8004 registry contract
      // 2. Check: ownerOf(erc8004AgentId) == walletAddress
      // 3. Update agent.erc_8004_verified = true
      // 4. Log in erc8004_verification_log table
    } catch (err) {
      logger.error("ERC-8004 verification failed", {
        agentId,
        walletAddress,
        error: err,
      });
    }
  }

  /**
   * Generate HMAC-signed receipt (stateless token)
   *
   * Format: base64(payload) . base64(hmac)
   * Payload includes: walletAddress, agentId, issuedAt, expiresAt
   *
   * @private
   * @param payload - Receipt data
   * @returns HMAC-signed receipt string
   */
  private _generateReceipt(payload: Omit<SIWAReceipt, "issuedAt" | "expiresAt">): string {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.receiptExpiry);

    const fullPayload = {
      ...payload,
      issuedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    const payloadJson = JSON.stringify(fullPayload);
    const payloadBase64 = Buffer.from(payloadJson).toString("base64");

    // Generate HMAC(SHA256)
    const hmac = createHmac("sha256", this.hmacSecret);
    hmac.update(payloadBase64);
    const hmacHex = hmac.digest("hex");

    // Format: payload.signature
    return `${payloadBase64}.${hmacHex}`;
  }

  /**
   * Verify HMAC-signed receipt
   *
   * @private
   * @param receipt - Receipt string (payload.signature)
   * @returns Decoded payload if valid, null if invalid
   */
  private _verifyReceiptSignature(receipt: string): SIWAReceipt | null {
    try {
      const [payloadBase64, providedHmac] = receipt.split(".");

      if (!payloadBase64 || !providedHmac) {
        return null;
      }

      // Verify HMAC
      const hmac = createHmac("sha256", this.hmacSecret);
      hmac.update(payloadBase64);
      const expectedHmac = hmac.digest("hex");

      if (providedHmac !== expectedHmac) {
        return null;
      }

      // Decode payload
      const payloadJson = Buffer.from(payloadBase64, "base64").toString("utf8");
      return JSON.parse(payloadJson) as SIWAReceipt;
    } catch (err) {
      return null;
    }
  }

  /**
   * Revoke a receipt (for logout or security)
   *
   * @param receipt - Receipt to revoke
   */
  async revokeReceipt(receipt: string): Promise<void> {
    const now = new Date();

    await this.db.query(
      `UPDATE siwa_receipt SET revoked_at = $1 
       WHERE receipt_signature = $2`,
      [now, receipt]
    );

    logger.info("Receipt revoked", { receipt: receipt.substring(0, 20) + "..." });
  }

  /**
   * Clean up expired nonces and receipts (run periodically)
   *
   * @param maxAgeMs - Delete records older than this (default: 30 days)
   */
  async cleanupExpiredTokens(maxAgeMs: number = 30 * 24 * 60 * 60 * 1000): Promise<void> {
    const cutoffDate = new Date(Date.now() - maxAgeMs);

    // Delete expired nonces
    await this.db.query(
      "DELETE FROM siwa_nonce WHERE expires_at < $1",
      [cutoffDate]
    );

    // Delete expired receipts
    await this.db.query(
      "DELETE FROM siwa_receipt WHERE expires_at < $1",
      [cutoffDate]
    );

    logger.info("Expired tokens cleaned up", { cutoffDate });
  }

  /**
   * Get agent profile by agent UUID
   *
   * @param agentId - Agent UUID
   * @returns Agent profile with wallet and ERC-8004 info
   * @throws Error if agent not found
   */
  async getAgentProfile(agentId: string): Promise<AgentProfile> {
    const result = await this.db.query(
      `SELECT id, name, avatar, wallet_address, erc_8004_agent_id, erc_8004_verified, created_at
       FROM agent WHERE id = $1`,
      [agentId]
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
   *
   * @param walletAddress - Ethereum wallet address
   * @returns Agent profile with wallet and ERC-8004 info, or null if not found
   */
  async getAgentByWallet(walletAddress: string): Promise<AgentProfile | null> {
    const result = await this.db.query(
      `SELECT id, name, avatar, wallet_address, erc_8004_agent_id, erc_8004_verified, created_at
       FROM agent WHERE wallet_address = $1`,
      [walletAddress]
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
