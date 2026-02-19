/**
 * Agent Repository
 * Data access layer for agent queries
 */

import type { VerifiedAgent } from "@common/types/index";
import { query, queryOne } from "../config/database.js";
import { logger } from "../utils/logger.js";
import {
  encryptDatabaseField,
  decryptDatabaseField,
} from "../config/database-encryption-config.js";

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

    const text = `
      INSERT INTO agent (id, name, avatar, erc8004_address, verification_status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING id, name, avatar, erc8004_address, verified_at, created_at, updated_at
    `;

    const row = await queryOne<AgentRow>(text, [
      agent.id,
      agent.name,
      agent.avatar,
      encryptedAddress,
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
   * Get agent by Ethereum address
   * Note: Encrypted fields cannot be searched directly without blind indexing.
   * For MVP, we fetch and decrypt or use a hashed version for lookup.
   * Since erc8004_address is unique, we search for the encrypted value.
   */
  async getByAddress(erc8004Address: string): Promise<VerifiedAgent | null> {
    // To find an encrypted field, we must encrypt the search term with the same IV (not possible with random IV)
    // or use a deterministic hash (blind index).
    // For now, we search by the encrypted value (only works if encryption is deterministic, which GCM is not).
    // CORRECT APPROACH: Use a blind index (hash) for lookups.

    // Fallback: If we can't search, we might need a separate hashed_address column.
    // For this fix, we'll try to find it by decrypting all or using the encrypted string if it matches.
    // However, GCM is non-deterministic. Let's check if we have a hashed_address column.

    const text = `
      SELECT id, name, avatar, erc8004_address, verified_at, created_at, updated_at
      FROM agent
    `;

    const rows = await query<AgentRow>(text);

    for (const row of rows) {
      const decrypted = decryptDatabaseField(
        "agent",
        "erc8004_address",
        row.erc8004_address,
      );
      if (decrypted === erc8004Address) {
        return this.mapRowToAgent(row);
      }
    }

    return null;
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
