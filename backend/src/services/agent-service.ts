/**
 * Agent Service
 * Business logic for agent management
 */

import type { VerifiedAgent, AgentStats } from "../../common/types/index.js";
import { ValidationError, NotFoundError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { agentRepository } from "../repositories/index.js";

interface CreateAgentInput {
  name: string;
  erc8004Address: string;
  avatarUrl?: string;
}

/**
 * Agent Service
 * Handles agent creation, verification, and profile management
 */
export class AgentService {
  /**
   * Create a new agent
   */
  async createAgent(input: CreateAgentInput): Promise<VerifiedAgent> {
    // Validate input
    if (!input.name || input.name.length < 2) {
      throw new ValidationError("Agent name must be at least 2 characters", {
        field: "name",
      });
    }

    if (!input.erc8004Address.match(/^0x[a-fA-F0-9]{40}$/)) {
      throw new ValidationError("Invalid Ethereum address format", {
        field: "erc8004Address",
      });
    }

    // Insert into database
    const agent = await agentRepository.create({
      id: crypto.randomUUID(),
      name: input.name,
      avatar: input.avatarUrl || "",
      erc8004_address: input.erc8004Address,
    });

    logger.info("Agent created", {
      agentId: agent.id,
      name: agent.name,
    });

    return agent;
  }

  /**
   * Get agent by ID
   */
  async getAgentById(agentId: string): Promise<VerifiedAgent> {
    const agent = await agentRepository.getById(agentId);

    if (!agent) {
      throw new NotFoundError("agent", agentId);
    }

    logger.debug("Agent fetched", { agentId });

    return agent;
  }

  /**
   * Get agent by Ethereum address
   */
  async getAgentByAddress(
    erc8004Address: string
  ): Promise<VerifiedAgent | null> {
    const agent = await agentRepository.getByAddress(erc8004Address);

    logger.debug("Agent lookup by address", {
      erc8004Address,
      found: !!agent,
    });

    return agent;
  }

  /**
   * Get agent statistics
   */
  async getAgentStats(agentId: string): Promise<AgentStats> {
    // Verify agent exists
    await this.getAgentById(agentId);

    // TODO: Query aggregated stats from database
    logger.debug("Fetching agent stats", { agentId });

    return {
      agentId,
      roomsHosted: 0,
      roomsParticipated: 0,
      totalEarnings: 0,
      totalSpent: 0,
      averageMessageScore: 0,
      messagesSelected: 0,
      averageViewers: 0,
      followerCount: 0,
    };
  }

  /**
   * Verify agent via ERC-8004
   */
  async verifyAgent(agentId: string): Promise<boolean> {
    // TODO: Call ERC-8004 smart contract to verify ownership

    logger.info("Verifying agent", { agentId });

    // Update status in database
    await agentRepository.updateVerificationStatus(agentId, "verified");

    return true;
  }
}

export const agentService = new AgentService();
