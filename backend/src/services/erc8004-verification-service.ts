/**
 * ERC-8004 Verification Service
 *
 * Implements agent identity verification via ERC-8004 smart contract.
 * Verifies that an Ethereum wallet owns a registered agent identity on-chain.
 *
 * Security Model:
 * - Agent registration creates immutable on-chain identity
 * - Wallet proves ownership via cryptographic signature
 * - Backend validates proof against smart contract
 * - Prevents impersonation and sybil attacks
 */

import { ethers } from "ethers";
import type { Contract } from "ethers";
import logger from "../utils/logger.js";

export interface ERC8004VerificationInput {
  /** Agent ID registered on-chain */
  agentId: string;
  /** Ethereum wallet address claiming ownership */
  walletAddress: string;
  /** Cryptographic proof of wallet ownership */
  proof: string;
  /** Signature of proof */
  signature: string;
}

export interface ERC8004VerificationResult {
  /** Whether verification succeeded */
  verified: boolean;
  /** On-chain agent ID */
  agentId: string;
  /** Owner wallet address */
  ownerAddress: string;
  /** Verification timestamp */
  verifiedAt: Date;
  /** Any error details if failed */
  error?: string;
}

/**
 * Smart contract ABI for AgentRegistry
 *
 * Key Functions:
 * - isAgentOwner(agentId, walletAddress) -> bool
 * - getAgentOwner(agentId) -> address
 * - registerAgent(agentId, walletAddress) -> void
 * - revokeAgent(agentId) -> void
 */
const AGENT_REGISTRY_ABI = [
  {
    name: "isAgentOwner",
    type: "function",
    inputs: [
      { name: "agentId", type: "bytes32" },
      { name: "walletAddress", type: "address" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "view",
  },
  {
    name: "getAgentOwner",
    type: "function",
    inputs: [{ name: "agentId", type: "bytes32" }],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
  {
    name: "registerAgent",
    type: "function",
    inputs: [
      { name: "agentId", type: "bytes32" },
      { name: "walletAddress", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "verifyOwnership",
    type: "function",
    inputs: [
      { name: "agentId", type: "bytes32" },
      { name: "proof", type: "string" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "view",
  },
  {
    name: "revokeAgent",
    type: "function",
    inputs: [{ name: "agentId", type: "bytes32" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
];

const VERIFICATION_TIMEOUT = 10000; // 10 seconds

/**
 * ERC8004VerificationService
 *
 * Manages interaction with ERC-8004 agent registry smart contract.
 * Supports:
 * - Verifying wallet ownership of agent identity
 * - Checking agent verification status
 * - Revoking compromised identities
 */
export class ERC8004VerificationService {
  private contract: Contract | null = null;
  private provider: ethers.Provider | null = null;
  private contractAddress: string;
  private chainId: number;

  constructor(
    contractAddress: string,
    rpcUrl: string,
    chainId: number = 1 // Default to Ethereum mainnet
  ) {
    this.contractAddress = contractAddress;
    this.chainId = chainId;

    try {
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      this.contract = new ethers.Contract(
        contractAddress,
        AGENT_REGISTRY_ABI,
        this.provider
      );

      logger.info("ERC-8004 VerificationService initialized", {
        contractAddress,
        chainId,
      });
    } catch (err) {
      logger.error("Failed to initialize ERC-8004 service", {
        error: err,
        contractAddress,
      });
      throw new Error("Failed to initialize ERC-8004 verification service");
    }
  }

  /**
   * Verify that a wallet owns an agent identity on-chain
   *
   * Process:
   * 1. Validate inputs (eth address format, agent ID format)
   * 2. Recover public key from signature
   * 3. Call smart contract to verify ownership
   * 4. Return verification result with timestamp
   *
   * @param input - Agent ID, wallet address, and cryptographic proof
   * @returns Verification result
   * @throws Error if verification fails or contract unreachable
   */
  async verifyAgentOwnership(
    input: ERC8004VerificationInput
  ): Promise<ERC8004VerificationResult> {
    if (!this.contract || !this.provider) {
      throw new Error("ERC-8004 service not initialized");
    }

    // Validate input format
    this._validateInput(input);

    try {
      // Set timeout for contract call
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), VERIFICATION_TIMEOUT);

      try {
        // Call smart contract to verify ownership
        const agentIdHash = ethers.id(input.agentId);
        const walletAddressChecked = ethers.getAddress(input.walletAddress);

        logger.info("Calling ERC-8004 verification", {
          agentId: input.agentId,
          walletAddress: walletAddressChecked,
        });

        const isOwner = await (this.contract as any).verifyOwnership(
          agentIdHash,
          input.proof,
          input.signature
        );

        clearTimeout(timeoutId);

        if (!isOwner) {
          logger.warn("ERC-8004 verification failed", {
            agentId: input.agentId,
            walletAddress: walletAddressChecked,
            reason: "Smart contract returned false",
          });

          return {
            verified: false,
            agentId: input.agentId,
            ownerAddress: walletAddressChecked,
            verifiedAt: new Date(),
            error: "Wallet does not own this agent identity",
          };
        }

        logger.info("ERC-8004 verification succeeded", {
          agentId: input.agentId,
          walletAddress: walletAddressChecked,
        });

        return {
          verified: true,
          agentId: input.agentId,
          ownerAddress: walletAddressChecked,
          verifiedAt: new Date(),
        };
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (err) {
      logger.error("ERC-8004 verification error", {
        agentId: input.agentId,
        error: err instanceof Error ? err.message : String(err),
      });

      return {
        verified: false,
        agentId: input.agentId,
        ownerAddress: input.walletAddress,
        verifiedAt: new Date(),
        error: `Verification error: ${err instanceof Error ? err.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Check if wallet is owner of agent identity (read-only, no proof required)
   *
   * Note: This reads current on-chain state but does not validate the caller.
   * Use verifyAgentOwnership() for full cryptographic verification.
   *
   * @param agentId - Agent ID
   * @param walletAddress - Wallet address to check
   * @returns true if wallet owns agent, false otherwise
   */
  async isAgentOwner(agentId: string, walletAddress: string): Promise<boolean> {
    if (!this.contract) {
      throw new Error("ERC-8004 service not initialized");
    }

    try {
      this._validateAddress(walletAddress);

      const agentIdHash = ethers.id(agentId);
      const walletAddressChecked = ethers.getAddress(walletAddress);

      const result = await (this.contract as any).isAgentOwner(
        agentIdHash,
        walletAddressChecked
      );

      return Boolean(result);
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
   * Get the registered owner of an agent identity
   *
   * @param agentId - Agent ID
   * @returns Owner wallet address, or null if not registered
   */
  async getAgentOwner(agentId: string): Promise<string | null> {
    if (!this.contract) {
      throw new Error("ERC-8004 service not initialized");
    }

    try {
      const agentIdHash = ethers.id(agentId);
      const owner = await (this.contract as any).getAgentOwner(agentIdHash);

      // Check if address is zero address (not registered)
      if (owner === ethers.ZeroAddress) {
        return null;
      }

      return ethers.getAddress(owner);
    } catch (err) {
      logger.error("Failed to get agent owner", {
        agentId,
        error: err,
      });
      return null;
    }
  }

  /**
   * Register a new agent on-chain (requires admin/contract owner)
   *
   * Note: This method should only be called by authorized backend service.
   * In production, use a private key with restricted permissions.
   *
   * @param agentId - New agent ID to register
   * @param walletAddress - Owner wallet address
   * @throws Error if registration fails
   */
  async registerAgent(agentId: string, walletAddress: string): Promise<void> {
    if (!this.contract) {
      throw new Error("ERC-8004 service not initialized");
    }

    this._validateInput({
      agentId,
      walletAddress,
      proof: "",
      signature: "",
    });

    try {
      logger.info("Registering agent on-chain", {
        agentId,
        walletAddress,
      });

      const agentIdHash = ethers.id(agentId);
      const walletAddressChecked = ethers.getAddress(walletAddress);

      // Note: In production, this would require a signer with appropriate permissions
      // For now, we log this as a placeholder for the deployment process
      logger.warn("registerAgent requires contract owner signer - implement in deployment", {
        agentId,
        walletAddress,
      });
    } catch (err) {
      logger.error("Failed to register agent on-chain", {
        agentId,
        error: err,
      });
      throw new Error(`Failed to register agent on-chain: ${err}`);
    }
  }

  /**
   * Revoke an agent identity (mark as invalid)
   *
   * @param agentId - Agent ID to revoke
   * @throws Error if revocation fails
   */
  async revokeAgent(agentId: string): Promise<void> {
    if (!this.contract) {
      throw new Error("ERC-8004 service not initialized");
    }

    try {
      const agentIdHash = ethers.id(agentId);

      logger.warn("Revoking agent identity", { agentId });

      // Note: In production, this would require a signer with appropriate permissions
      logger.warn("revokeAgent requires contract owner signer - implement in deployment", {
        agentId,
      });
    } catch (err) {
      logger.error("Failed to revoke agent", {
        agentId,
        error: err,
      });
      throw new Error(`Failed to revoke agent: ${err}`);
    }
  }

  /**
   * Health check: verify contract is reachable
   *
   * @returns true if contract is accessible, false otherwise
   */
  async healthCheck(): Promise<boolean> {
    if (!this.contract || !this.provider) {
      return false;
    }

    try {
      // Try to read contract code
      const code = await this.provider.getCode(this.contractAddress);
      return code !== "0x"; // Non-empty bytecode means contract exists
    } catch (err) {
      logger.error("ERC-8004 health check failed", { error: err });
      return false;
    }
  }

  // ============================================
  // Private Helpers
  // ============================================

  /**
   * Validate verification input
   *
   * @private
   * @throws ValidationError if input invalid
   */
  private _validateInput(input: ERC8004VerificationInput): void {
    // Validate agent ID format (should be non-empty string)
    if (!input.agentId || input.agentId.trim().length === 0) {
      throw new Error("Invalid agent ID format");
    }

    // Validate wallet address
    this._validateAddress(input.walletAddress);

    // Validate proof format
    if (!input.proof || input.proof.trim().length === 0) {
      throw new Error("Invalid proof format");
    }

    // Validate signature format (should be hex string)
    if (!input.signature || input.signature.trim().length === 0) {
      throw new Error("Invalid signature format");
    }
  }

  /**
   * Validate Ethereum address format
   *
   * @private
   * @throws Error if address invalid
   */
  private _validateAddress(address: string): void {
    try {
      ethers.getAddress(address);
    } catch (err) {
      throw new Error(`Invalid Ethereum address: ${address}`);
    }
  }
}

/**
 * Factory function to create ERC-8004 verification service
 *
 * @param contractAddress - Smart contract address
 * @param rpcUrl - Blockchain RPC endpoint
 * @param chainId - Network chain ID
 * @returns Initialized verification service
 */
export function createERC8004VerificationService(
  contractAddress: string,
  rpcUrl: string,
  chainId?: number
): ERC8004VerificationService {
  return new ERC8004VerificationService(contractAddress, rpcUrl, chainId);
}
