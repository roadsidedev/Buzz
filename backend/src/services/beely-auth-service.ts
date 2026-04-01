/**
 * Beely Auth Service — Moltbook-style API-key authentication
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

import { v4 as uuidv4, v5 as uuidv5 } from "uuid";
import { randomBytes, randomInt } from "crypto";
import { logger } from "../utils/logger.js";

// ============================================
// Types
// ============================================

export interface RegisterAgentInput {
  name: string;
  username: string;
  description?: string;
  system_secret?: string; // Optional secret to authorize platform-bot role
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
  username: string;
  name: string;
  description?: string;
  avatar?: string;
  claimStatus: string;
  claimUrl?: string;
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

export class BeelyAuthService {
  private db: any;
  private baseUrl: string;

  constructor(db: any) {
    this.db = db;
    this.baseUrl =
      process.env.BEELY_BASE_URL || "https://beely-live.vercel.app";
  }

  // ==========================================
  // Registration
  // ==========================================

  /**
   * Register a new agent with just name + description.
   * Returns API key, claim URL, and verification code.
   */
  async registerAgent(input: RegisterAgentInput): Promise<RegisterAgentResult> {
    const { name, username, description } = input;

    // Validate username
    if (!username || typeof username !== "string" || !/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      throw new Error("Username must be 3-20 characters long and contain only letters, numbers, and underscores");
    }

    // Validate name
    if (!name || typeof name !== "string" || name.length < 2 || name.length > 50) {
      throw new Error("Agent name is required (2-50 characters)");
    }

    // Check for duplicate username
    const existingUser = await this.db.query(
      "SELECT id, name, api_key, claim_token, twitter_verification_code, description, claim_status, role FROM agent WHERE LOWER(username) = LOWER($1)",
      [username],
    );
    if (existingUser.rows.length > 0) {
      const existing = existingUser.rows[0];
      const isBotRequest =
        description?.toLowerCase().includes("radio runner") ||
        description?.toLowerCase().includes("radiohost");

      const isExistingBot =
        existing.description?.toLowerCase().includes("radio runner") ||
        existing.description?.toLowerCase().includes("radiohost") ||
        existing.name?.toLowerCase().includes("radiohost");

      if (isBotRequest || isExistingBot) {
        const systemSecret = process.env.BEELY_SYSTEM_SECRET;
        const isAuthorizedBot = systemSecret && input.system_secret === systemSecret;

        const needsKeyRotation = !existing.api_key || !existing.api_key.startsWith("beely_");
        const needsClaimFix = isAuthorizedBot && existing.claim_status !== "claimed";

        if (needsKeyRotation || needsClaimFix) {
          const newApiKey = needsKeyRotation ? this._generateApiKey() : existing.api_key;
          await this.db.query(
            `UPDATE agent
             SET api_key      = $1,
                 claim_status = $2,
                 role         = $3,
                 updated_at   = CURRENT_TIMESTAMP
             WHERE id = $4`,
            [
              newApiKey,
              isAuthorizedBot ? "claimed" : existing.claim_status,
              isAuthorizedBot ? "bot"     : existing.role,
              existing.id,
            ],
          );
          logger.info("Rotated stale bot credentials", { agentId: existing.id, username, needsKeyRotation, needsClaimFix });
          return {
            agent: {
              id: existing.id,
              name: existing.name,
              api_key: newApiKey,
              claim_url: `${this.baseUrl}/claim/${existing.claim_token}`,
              verification_code: existing.twitter_verification_code,
            },
            important: "Updated existing agent credentials.",
          };
        }

        logger.info("Reusing existing bot registration", {
          agentId: existing.id,
          username,
          isBotRequest,
          isExistingBot
        });
        return {
          agent: {
            id: existing.id,
            name: existing.name,
            api_key: existing.api_key,
            claim_url: `${this.baseUrl}/claim/${existing.claim_token}`,
            verification_code: existing.twitter_verification_code,
          },
          important: "Reused existing agent credentials.",
        };
      }
      
      logger.warn("Agent registration conflict", { 
        username, 
        providedDescription: description,
        existingId: existing.id,
        existingDescription: existing.description 
      });
      throw new Error(`Username "${username}" is already taken`);
    }

    // Check for duplicate name
    const existingName = await this.db.query(
      "SELECT id FROM agent WHERE LOWER(name) = LOWER($1)",
      [name],
    );
    if (existingName.rows.length > 0) {
      throw new Error(`Agent name "${name}" is already registered`);
    }

    // Generate credentials
    const agentId = uuidv4();
    const apiKey = this._generateApiKey();
    const claimToken = this._generateClaimToken();
    const verificationCode = this._generateVerificationCode();
    const now = new Date();

    // Insert agent record
    const systemSecret = process.env.BEELY_SYSTEM_SECRET;
    const isAuthorizedBot = systemSecret && input.system_secret === systemSecret;

    await this.db.query(
      `INSERT INTO agent (
        id, username, name, description, api_key, claim_token,
        claim_status, verification_status, role,
        twitter_verification_code,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        agentId,
        username,
        name,
        description || null,
        apiKey,
        claimToken,
        isAuthorizedBot ? "claimed" : "pending_claim",
        isAuthorizedBot ? "verified" : "unverified",
        isAuthorizedBot ? "bot" : "agent",
        verificationCode,
        now,
        now,
      ],
    );

    logger.info("Agent registered", {
      agentId,
      username,
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
    if (!apiKey || !apiKey.startsWith("beely_")) {
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
    updates: { name?: string; description?: string; avatar?: string; twitterHandle?: string }
  ): Promise<void> {
    const { name, description, avatar, twitterHandle } = updates;
    
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      values.push(name);
    }
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
    return `beely_${randomBytes(24).toString("hex")}`;
  }

  private _generateClaimToken(): string {
    return `beely_claim_${randomBytes(16).toString("hex")}`;
  }

  private _generateVerificationCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
    const suffix = Array.from(
      { length: 4 },
      () => chars[randomInt(chars.length)],
    ).join("");
    return `claw-${suffix}`;
  }

  /**
   * Sync a human user (from Privy) into the agent table.
   * This ensures they have a record with name and avatar for room display.
   */
  async syncUser(input: {
    id: string; // Privy DID
    username: string;
    name: string;
    avatar?: string;
  }): Promise<string> {
    const { id: privyDid, username, name, avatar } = input;
    
    // Generate a deterministic UUID from the Privy DID to satisfy UUID constraints
    // Namespace: 6ba7b810-9dad-11d1-80b4-00c04fd430c8 (DNS namespace)
    const BEELY_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
    const agentId = uuidv5(privyDid, BEELY_NAMESPACE);
    
    const now = new Date();

    await this.db.query(
      `INSERT INTO agent (
        id, username, name, avatar, claim_status, verification_status, role,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        username = EXCLUDED.username,
        name = EXCLUDED.name,
        avatar = COALESCE(EXCLUDED.avatar, agent.avatar),
        updated_at = EXCLUDED.updated_at`,
      [
        agentId,
        username,
        name,
        avatar || null,
        "claimed",     // Human users are already "claimed" by Privy
        "verified",    // and verified by Privy
        "human",       // Special role for human listeners
        now,
        now,
      ],
    );

    logger.debug("Human user synced to agent table", { agentId, privyDid, username, name });
    
    return agentId;
  }

  private _mapToProfile(row: any): AgentProfile {
    return {
      id: row.id,
      username: row.username,
      name: row.name,
      description: row.description || undefined,
      avatar: row.avatar || undefined,
      claimStatus: row.suspended_at ? "suspended" : row.claim_status,
      claimUrl: row.claim_token ? `${this.baseUrl}/claim/${row.claim_token}` : undefined,
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
