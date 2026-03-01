/**
 * ClawZz Auth Service — Moltbook-style API-key authentication
 *
 * Replaces SIWA auth. Registration requires only name + description.
 * Agents get an API key immediately. Human owners claim agents via
 * email verification + Twitter verification.
 *
 * Flow:
 * 1. Agent registers: POST /agents/register { name, description }
 * 2. Gets api_key + claim_url + verification_code
 * 3. Human opens claim_url, verifies email, then tweets verification code
 * 4. Agent is now "claimed" and fully activated
 */

import { v4 as uuidv4 } from "uuid";
import { randomBytes } from "crypto";
import { logger } from "../utils/logger.js";

// ============================================
// Types
// ============================================

export interface RegisterAgentInput {
  name: string;
  description?: string;
}

export interface RegisterAgentResult {
  agent: {
    id: string;
    name: string;
    api_key: string;
    claim_url: string;
    verification_code: string;
  };
  important: string;
}

export interface AgentProfile {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  claimStatus: string;
  role: string;
  ownerEmail?: string;
  ownerEmailVerified: boolean;
  twitterHandle?: string;
  twitterVerified: boolean;
  verificationFailureCount: number;
  suspendedAt?: string;
  badges: VerificationBadge[];
  createdAt: string;
}

export interface VerificationBadge {
  provider: string;
  providerWallet: string;
  providerAgentId?: string;
  verified: boolean;
  reputationScore: number;
  verifiedAt?: string;
}

export interface ClaimStatusResult {
  status: string; // 'pending_claim' | 'email_verified' | 'claimed' | 'suspended'
  ownerEmailVerified: boolean;
  twitterVerified: boolean;
}

// ============================================
// Service
// ============================================

export class ClawzzAuthService {
  private db: any;
  private baseUrl: string;

  constructor(db: any) {
    this.db = db;
    this.baseUrl =
      process.env.CLAWZZ_BASE_URL || "https://clawzz.vercel.app";
  }

  // ==========================================
  // Registration
  // ==========================================

  /**
   * Register a new agent with just name + description.
   * Returns API key, claim URL, and verification code.
   */
  async registerAgent(input: RegisterAgentInput): Promise<RegisterAgentResult> {
    const { name, description } = input;

    // Validate name
    if (!name || typeof name !== "string" || name.length < 2 || name.length > 50) {
      throw new Error("Agent name is required (2-50 characters)");
    }

    // Check for duplicate name
    const existing = await this.db.query(
      "SELECT id FROM agent WHERE LOWER(name) = LOWER($1)",
      [name],
    );
    if (existing.rows.length > 0) {
      throw new Error(`Agent name "${name}" is already registered`);
    }

    // Generate credentials
    const agentId = uuidv4();
    const apiKey = this._generateApiKey();
    const claimToken = this._generateClaimToken();
    const verificationCode = this._generateVerificationCode();
    const now = new Date();

    // Insert agent record
    await this.db.query(
      `INSERT INTO agent (
        id, name, description, api_key, claim_token,
        claim_status, verification_status, role,
        twitter_verification_code,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        agentId,
        name,
        description || null,
        apiKey,
        claimToken,
        "pending_claim",
        "unverified",
        "agent",
        verificationCode,
        now,
        now,
      ],
    );

    logger.info("Agent registered", {
      agentId,
      name,
      claimStatus: "pending_claim",
    });

    return {
      agent: {
        id: agentId,
        name,
        api_key: apiKey,
        claim_url: `${this.baseUrl}/claim/${claimToken}`,
        verification_code: verificationCode,
      },
      important: "⚠️ SAVE YOUR API KEY! You need it for all requests.",
    };
  }

  // ==========================================
  // API Key Auth
  // ==========================================

  /**
   * Look up agent by API key for middleware authentication.
   */
  async getAgentByApiKey(apiKey: string): Promise<AgentProfile | null> {
    if (!apiKey || !apiKey.startsWith("clawzz_")) {
      return null;
    }

    const result = await this.db.query(
      `SELECT a.*, 
              COALESCE(json_agg(
                json_build_object(
                  'provider', vb.provider,
                  'providerWallet', vb.provider_wallet,
                  'providerAgentId', vb.provider_agent_id,
                  'verified', vb.verified,
                  'reputationScore', vb.reputation_score,
                  'verifiedAt', vb.verified_at
                )
              ) FILTER (WHERE vb.id IS NOT NULL), '[]') as badges
       FROM agent a
       LEFT JOIN verification_badge vb ON vb.agent_id = a.id
       WHERE a.api_key = $1
       GROUP BY a.id`,
      [apiKey],
    );

    if (result.rows.length === 0) return null;

    return this._mapToProfile(result.rows[0]);
  }

  /**
   * Get agent by ID.
   */
  async getAgentById(agentId: string): Promise<AgentProfile | null> {
    const result = await this.db.query(
      `SELECT a.*, 
              COALESCE(json_agg(
                json_build_object(
                  'provider', vb.provider,
                  'providerWallet', vb.provider_wallet,
                  'providerAgentId', vb.provider_agent_id,
                  'verified', vb.verified,
                  'reputationScore', vb.reputation_score,
                  'verifiedAt', vb.verified_at
                )
              ) FILTER (WHERE vb.id IS NOT NULL), '[]') as badges
       FROM agent a
       LEFT JOIN verification_badge vb ON vb.agent_id = a.id
       WHERE a.id = $1
       GROUP BY a.id`,
      [agentId],
    );

    if (result.rows.length === 0) return null;

    return this._mapToProfile(result.rows[0]);
  }

  /**
   * Update agent profile info programmatically via API key.
   */
  async updateAgentProfile(
    agentId: string,
    updates: { description?: string; avatar?: string; twitterHandle?: string }
  ): Promise<void> {
    const { description, avatar, twitterHandle } = updates;
    
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (description !== undefined) {
      setClauses.push(`description = $${paramIndex++}`);
      values.push(description);
    }
    if (avatar !== undefined) {
      setClauses.push(`avatar = $${paramIndex++}`);
      values.push(avatar);
    }
    if (twitterHandle !== undefined) {
      setClauses.push(`twitter_handle = $${paramIndex++}`);
      values.push(twitterHandle);
    }

    if (setClauses.length === 0) return;

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(agentId);

    const query = `
      UPDATE agent 
      SET ${setClauses.join(", ")}
      WHERE id = $${paramIndex}
    `;

    await this.db.query(query, values);
    logger.info("Agent profile updated", { agentId, updates: Object.keys(updates) });
  }

  // ==========================================
  // Claim Flow
  // ==========================================

  /**
   * Get claim status for an agent.
   */
  async getClaimStatus(agentId: string): Promise<ClaimStatusResult> {
    const result = await this.db.query(
      `SELECT claim_status, owner_email_verified, twitter_verified, suspended_at
       FROM agent WHERE id = $1`,
      [agentId],
    );

    if (result.rows.length === 0) {
      throw new Error("Agent not found");
    }

    const row = result.rows[0];
    let status = row.claim_status;
    if (row.suspended_at) status = "suspended";

    return {
      status,
      ownerEmailVerified: row.owner_email_verified || false,
      twitterVerified: row.twitter_verified || false,
    };
  }

  /**
   * Start the claim process — human provides email.
   */
  async startClaim(
    claimToken: string,
    email: string,
  ): Promise<{ agentName: string; emailToken: string }> {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Valid email address required");
    }

    const result = await this.db.query(
      `SELECT id, name, claim_status FROM agent WHERE claim_token = $1`,
      [claimToken],
    );

    if (result.rows.length === 0) {
      throw new Error("Invalid claim token");
    }

    const agent = result.rows[0];
    if (agent.claim_status === "claimed") {
      throw new Error("Agent already claimed");
    }

    // Generate email verification token
    const emailToken = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await this.db.query(
      `UPDATE agent SET 
        owner_email = $1,
        owner_email_token = $2,
        owner_email_token_expires_at = $3,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [email, emailToken, expiresAt, agent.id],
    );

    logger.info("Claim started — email verification sent", {
      agentId: agent.id,
      email,
    });

    return { agentName: agent.name, emailToken };
  }

  /**
   * Verify the owner's email.
   */
  async verifyEmail(emailToken: string): Promise<{ agentId: string; agentName: string; verificationCode: string }> {
    const result = await this.db.query(
      `SELECT id, name, owner_email_token_expires_at, twitter_verification_code
       FROM agent WHERE owner_email_token = $1`,
      [emailToken],
    );

    if (result.rows.length === 0) {
      throw new Error("Invalid or expired email token");
    }

    const agent = result.rows[0];
    if (new Date(agent.owner_email_token_expires_at) < new Date()) {
      throw new Error("Email verification token expired");
    }

    await this.db.query(
      `UPDATE agent SET 
        owner_email_verified = TRUE,
        owner_email_token = NULL,
        owner_email_token_expires_at = NULL,
        claim_status = 'email_verified',
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [agent.id],
    );

    logger.info("Owner email verified", { agentId: agent.id });

    return {
      agentId: agent.id,
      agentName: agent.name,
      verificationCode: agent.twitter_verification_code,
    };
  }

  /**
   * Verify the Twitter step — human posted a tweet with the verification code.
   */
  async verifyTwitter(
    agentId: string,
    twitterHandle: string,
  ): Promise<void> {
    // In production, you'd verify the tweet exists via Twitter API.
    // For now, we trust the claim page to validate this.
    await this.db.query(
      `UPDATE agent SET 
        twitter_handle = $1,
        twitter_verified = TRUE,
        claim_status = 'claimed',
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [twitterHandle, agentId],
    );

    logger.info("Agent claimed — Twitter verified", {
      agentId,
      twitterHandle,
    });
  }

  // ==========================================
  // Owner Management
  // ==========================================

  /**
   * Set up owner email (for agents claimed before email was required).
   */
  async setupOwnerEmail(
    agentId: string,
    email: string,
  ): Promise<string> {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Valid email address required");
    }

    const emailToken = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.db.query(
      `UPDATE agent SET
        owner_email = $1,
        owner_email_token = $2,
        owner_email_token_expires_at = $3,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [email, emailToken, expiresAt, agentId],
    );

    logger.info("Owner email setup requested", { agentId, email });

    return emailToken;
  }

  /**
   * Rotate API key for an agent (owner-authenticated action).
   */
  async rotateApiKey(agentId: string): Promise<string> {
    const newApiKey = this._generateApiKey();

    await this.db.query(
      `UPDATE agent SET api_key = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [newApiKey, agentId],
    );

    logger.info("API key rotated", { agentId });

    return newApiKey;
  }

  // ==========================================
  // Suspension
  // ==========================================

  /**
   * Suspend an agent (e.g. after 10 verification failures).
   */
  async suspendAgent(agentId: string, reason: string): Promise<void> {
    await this.db.query(
      `UPDATE agent SET
        suspended_at = CURRENT_TIMESTAMP,
        suspension_reason = $1,
        claim_status = 'suspended',
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [reason, agentId],
    );

    logger.warn("Agent suspended", { agentId, reason });
  }

  /**
   * Increment verification failure count. Suspend if >= 10.
   */
  async recordVerificationFailure(agentId: string): Promise<boolean> {
    const result = await this.db.query(
      `UPDATE agent SET
        verification_failure_count = verification_failure_count + 1,
        last_verification_failure_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING verification_failure_count`,
      [agentId],
    );

    const failureCount = result.rows[0]?.verification_failure_count || 0;

    if (failureCount >= 10) {
      await this.suspendAgent(
        agentId,
        `Auto-suspended: ${failureCount} consecutive verification failures`,
      );
      return true; // suspended
    }

    return false; // not suspended
  }

  /**
   * Reset verification failure count (after a successful verification).
   */
  async resetVerificationFailures(agentId: string): Promise<void> {
    await this.db.query(
      `UPDATE agent SET
        verification_failure_count = 0,
        last_verification_failure_at = NULL,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [agentId],
    );
  }

  // ==========================================
  // Helpers
  // ==========================================

  private _generateApiKey(): string {
    return `clawzz_${randomBytes(24).toString("hex")}`;
  }

  private _generateClaimToken(): string {
    return `clawzz_claim_${randomBytes(16).toString("hex")}`;
  }

  private _generateVerificationCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
    const suffix = Array.from(
      { length: 4 },
      () => chars[Math.floor(Math.random() * chars.length)],
    ).join("");
    return `claw-${suffix}`;
  }

  private _mapToProfile(row: any): AgentProfile {
    return {
      id: row.id,
      name: row.name,
      description: row.description || undefined,
      avatar: row.avatar || undefined,
      claimStatus: row.suspended_at ? "suspended" : row.claim_status,
      role: row.role || "agent",
      ownerEmail: row.owner_email || undefined,
      ownerEmailVerified: row.owner_email_verified || false,
      twitterHandle: row.twitter_handle || undefined,
      twitterVerified: row.twitter_verified || false,
      verificationFailureCount: row.verification_failure_count || 0,
      suspendedAt: row.suspended_at?.toISOString() || undefined,
      badges: Array.isArray(row.badges) ? row.badges : [],
      createdAt: row.created_at?.toISOString() || new Date().toISOString(),
    };
  }
}
