/**
 * Agent Repository
 * Data access layer for agent queries
 */

import crypto from "crypto";
import type { VerifiedAgent } from "@common/types/index";
import { query, queryOne } from "../config/database.js";
import { logger } from "../utils/logger.js";
import {
  encryptDatabaseField,
  decryptDatabaseField,
} from "../config/database-encryption-config.js";

/**
 * Compute a deterministic HMAC-SHA256 blind index for an Ethereum address.
 *
 * GCM encryption is non-deterministic (random IVs) so encrypted values cannot
 * be searched with a WHERE clause. A blind index — an HMAC keyed with a stable
 * secret — is deterministic and safe to store alongside the ciphertext.
 *
 * BLIND_INDEX_SECRET must be set in the environment; it is separate from
 * ENCRYPTION_SECRET so that a compromise of one does not affect the other.
 */
function blindIndexAddress(address: string): string {
  const secret = process.env.BLIND_INDEX_SECRET || process.env.ENCRYPTION_SECRET || "";
  if (!secret) {
    throw new Error(
      "BLIND_INDEX_SECRET (or ENCRYPTION_SECRET) is required for address lookup. " +
      "Set a stable random value in the environment.",
    );
  }
  return crypto
    .createHmac("sha256", secret)
    .update(address.toLowerCase())
    .digest("hex");
}

interface AgentRow {
  id: string;
  name: string;
  avatar: string;
  erc8004_address: string;
  verification_status: string;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

/**
 * Agent Repository
 * Handles all agent database operations with field-level encryption
 */
export class AgentRepository {
  /**
   * Create a new agent with encrypted wallet address
   */
  async create(agent: {
    id: string;
    name: string;
    avatar: string;
    erc8004_address: string;
  }): Promise<VerifiedAgent> {
    // Encrypt sensitive PII before storage
    const encryptedAddress = encryptDatabaseField(
      "agent",
      "erc8004_address",
      agent.erc8004_address,
    );

    // Compute a deterministic blind index for address lookups (H5).
    // The column hashed_address must exist; if not yet migrated the INSERT will
    // fail loudly rather than silently skipping the index.
    const hashedAddress = blindIndexAddress(agent.erc8004_address);

    const text = `
      INSERT INTO agent (id, name, avatar, erc8004_address, hashed_address, verification_status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING id, name, avatar, erc8004_address, verified_at, created_at, updated_at
    `;

    const row = await queryOne<AgentRow>(text, [
      agent.id,
      agent.name,
      agent.avatar,
      encryptedAddress,
      hashedAddress,
      "verified",
    ]);

    if (!row) {
      throw new Error("Failed to create agent");
    }

    logger.info("Agent created with encrypted PII", { agentId: agent.id });

    return this.mapRowToAgent(row);
  }

  /**
   * Get agent by ID with decrypted PII
   */
  async getById(id: string): Promise<VerifiedAgent | null> {
    const text = `
      SELECT id, name, avatar, erc8004_address, verified_at, created_at, updated_at
      FROM agent
      WHERE id = $1
    `;

    const row = await queryOne<AgentRow>(text, [id]);

    if (!row) {
      logger.debug("Agent not found", { agentId: id });
      return null;
    }

    return this.mapRowToAgent(row);
  }

  /**
   * Get agent by Ethereum address using a blind-index lookup (O(log n)).
   *
   * GCM encryption is non-deterministic so the encrypted `erc8004_address`
   * column cannot be searched directly.  We store an HMAC-SHA256 blind index
   * (`hashed_address`) that is deterministic and indexed in the database,
   * allowing an exact-match WHERE clause instead of a full-table scan.
   */
  async getByAddress(erc8004Address: string): Promise<VerifiedAgent | null> {
    const hashedAddress = blindIndexAddress(erc8004Address);

    const text = `
      SELECT id, name, avatar, erc8004_address, verified_at, created_at, updated_at
      FROM agent
      WHERE hashed_address = $1
      LIMIT 1
    `;

    const row = await queryOne<AgentRow>(text, [hashedAddress]);

    if (!row) {
      logger.debug("Agent not found by address", {
        addressPrefix: erc8004Address.slice(0, 10) + "...",
      });
      return null;
    }

    return this.mapRowToAgent(row);
  }

  /**
   * Check if agent exists by address
   */
  async existsByAddress(erc8004Address: string): Promise<boolean> {
    const text = `
      SELECT EXISTS(SELECT 1 FROM agent WHERE erc8004_address = $1)
    `;

    const result = await queryOne<{ exists: boolean }>(text, [erc8004Address]);

    return result?.exists ?? false;
  }

  /**
   * Update agent fields
   */
  async update(id: string, data: Record<string, any>): Promise<void> {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(data)) {
      fields.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }

    if (fields.length === 0) return;

    values.push(id);
    const text = `
      UPDATE agent
      SET ${fields.join(", ")}, updated_at = NOW()
      WHERE id = $${paramIndex}
    `;

    await query(text, values);
    logger.debug("Agent updated", { agentId: id, fields: Object.keys(data) });
  }

  /**
   * Update agent verification status
   */
  async updateVerificationStatus(
    agentId: string,
    status: "verified" | "unverified" | "pending" | "suspended" | "banned",
  ): Promise<void> {
    const text = `
      UPDATE agent
      SET verification_status = $1, verified_at = CASE WHEN $1 = 'verified' THEN NOW() ELSE verified_at END, updated_at = NOW()
      WHERE id = $2
    `;

    await query(text, [status, agentId]);

    logger.info("Agent verification updated", {
      agentId,
      status,
    });
  }

  /**
   * Map database row to VerifiedAgent with decryption
   */
  private mapRowToAgent(row: AgentRow): VerifiedAgent {
    const decryptedAddress = decryptDatabaseField(
      "agent",
      "erc8004_address",
      row.erc8004_address,
    );

    return {
      id: row.id,
      name: row.name,
      avatar: row.avatar,
      erc8004Address: decryptedAddress || row.erc8004_address,
      verifiedAt: row.verified_at ? new Date(row.verified_at) : new Date(),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}

export const agentRepository = new AgentRepository();
