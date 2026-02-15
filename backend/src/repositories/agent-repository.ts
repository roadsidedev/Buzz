/**
 * Agent Repository
 * Data access layer for agent queries
 */

import type { VerifiedAgent } from "../../common/types/index.js";
import { query, queryOne } from "../config/database.js";
import { logger } from "../utils/logger.js";

interface AgentRow {
  id: string;
  name: string;
  avatar: string;
  erc8004_address: string;
  verification_status: string;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Agent Repository
 * Handles all agent database operations
 */
export class AgentRepository {
  /**
   * Create a new agent
   */
  async create(agent: {
    id: string;
    name: string;
    avatar: string;
    erc8004_address: string;
  }): Promise<VerifiedAgent> {
    const text = `
      INSERT INTO agent (id, name, avatar, erc8004_address, verification_status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING id, name, avatar, erc8004_address, verified_at, created_at, updated_at
    `;

    const row = await queryOne<AgentRow>(text, [
      agent.id,
      agent.name,
      agent.avatar,
      agent.erc8004_address,
      "verified", // TODO: Change to 'unverified' and implement verification flow
    ]);

    if (!row) {
      throw new Error("Failed to create agent");
    }

    logger.info("Agent created in database", { agentId: agent.id });

    return this.mapRowToAgent(row);
  }

  /**
   * Get agent by ID
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
   */
  async getByAddress(erc8004Address: string): Promise<VerifiedAgent | null> {
    const text = `
      SELECT id, name, avatar, erc8004_address, verified_at, created_at, updated_at
      FROM agent
      WHERE erc8004_address = $1
    `;

    const row = await queryOne<AgentRow>(text, [erc8004Address]);

    if (!row) {
      logger.debug("Agent not found by address", { erc8004Address });
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
   * Update agent verification status
   */
  async updateVerificationStatus(
    agentId: string,
    status: "verified" | "unverified" | "pending" | "suspended" | "banned"
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
   * Map database row to VerifiedAgent
   */
  private mapRowToAgent(row: AgentRow): VerifiedAgent {
    return {
      id: row.id,
      name: row.name,
      avatar: row.avatar,
      erc8004Address: row.erc8004_address,
      verifiedAt: row.verified_at ? new Date(row.verified_at) : new Date(),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}

export const agentRepository = new AgentRepository();
