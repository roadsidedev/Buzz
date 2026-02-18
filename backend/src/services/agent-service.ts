/**
 * Agent Service
 * Business logic for agent management with ERC-8004 identity verification
 */

import crypto from "crypto";
import type { VerifiedAgent, AgentStats } from "../../common/types/index.js";
import { ValidationError, NotFoundError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { agentRepository } from "../repositories/index.js";
import {
  getERC8004Service,
  type ERC8004VerificationInput,
} from "./erc8004-verification-service.js";

interface CreateAgentInput {
  name: string;
  erc8004Address: string;
  avatarUrl?: string;
}

interface VerifyAgentInput {
  agentId: string;
  walletAddress: string;
  proof: string;
  signature: string;
}

/**
 * Agent Service
 * Handles agent creation, verification, and profile management
 */
export class AgentService {
  private erc8004Service = getERC8004Service();

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

    logger.info("Agent created in database", {
      agentId: agent.id,
      name: agent.name,
    });

    // Attempt on-chain registration if signer is available
    // This is non-blocking to ensure API responsiveness, but logs errors
    this.registerAgentOnChain(agent.id, input.erc8004Address).catch((err) => {
      logger.error("Background on-chain registration failed", {
        agentId: agent.id,
        error: err instanceof Error ? err.message : String(err),
      });
    });

    return agent;
  }

  /**
   * Register agent identity on-chain via ERC-8004
   */
  async registerAgentOnChain(agentId: string, walletAddress: string): Promise<string | null> {
    try {
      const txHash = await this.erc8004Service.registerAgent(agentId, walletAddress);
      logger.info("Agent registered on-chain", { agentId, txHash });
      return txHash;
    } catch (err) {
      // If service is not initialized with signer (e.g. dev mode without private key),
      // we log a warning but don't fail the operation.
      if (err instanceof Error && err.message.includes("signer")) {
        logger.warn("Skipping on-chain registration: No signer configured", { agentId });
        return null;
      }
      throw err;
    }
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
   * Verify agent via ERC-8004 smart contract
   *
   * Process:
   * 1. Validate agent exists
   * 2. Recover wallet from signature
   * 3. Call ERC-8004 contract to verify ownership
   * 4. Update verification status in database
   * 5. Log audit trail
   *
   * @param input - Agent ID, wallet, proof, and signature
   * @returns true if verification succeeded, false otherwise
   */
  async verifyAgent(input: VerifyAgentInput): Promise<boolean> {
    // Validate agent exists
    const agent = await this.getAgentById(input.agentId);

    logger.info("Starting ERC-8004 verification", {
      agentId: input.agentId,
      walletAddress: input.walletAddress,
    });

    try {
      // Call ERC-8004 verification service
      const verificationResult = await this.erc8004Service.verifyAgentOwnership({
        agentId: input.agentId,
        walletAddress: input.walletAddress,
        proof: input.proof,
        signature: input.signature,
      });

      if (!verificationResult.verified) {
        logger.warn("ERC-8004 verification failed", {
          agentId: input.agentId,
          walletAddress: input.walletAddress,
          error: verificationResult.error,
        });
        return false;
      }

      // Update verification status in database
      await agentRepository.updateVerificationStatus(input.agentId, "verified");

      logger.info("ERC-8004 verification succeeded", {
        agentId: input.agentId,
        walletAddress: verificationResult.ownerAddress,
        verifiedAt: verificationResult.verifiedAt.toISOString(),
      });

      return true;
    } catch (err) {
      logger.error("ERC-8004 verification error", {
        agentId: input.agentId,
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }

  /**
   * Check if wallet owns agent identity (non-cryptographic check)
   *
   * @param agentId - Agent ID
   * @param walletAddress - Wallet address
   * @returns true if wallet is owner on-chain
   */
  async isAgentOwner(agentId: string, walletAddress: string): Promise<boolean> {
    try {
      return await this.erc8004Service.isAgentOwner(agentId, walletAddress);
    } catch (err) {
      logger.error("Failed to check agent ownership", {
        agentId,
        walletAddress,
        error: err,
      });
      return false;
    }
  }

  /**
   * Get ERC-8004 verification service for direct contract interaction
   */
  getERC8004Service() {
    return this.erc8004Service;
  }
}

export const agentService = new AgentService();
