/**
 * ERC-8004 Verification & Reputation Service
 *
 * Implements agent identity verification and reputation management via ERC-8004 smart contracts.
 *
 * Deployment Addresses (Base Network):
 * - Base Sepolia: IdentityRegistry & ReputationRegistry
 * - Base Mainnet: IdentityRegistry & ReputationRegistry
 */

import { ethers } from "ethers";
import type { Contract, Signer, Provider } from "ethers";
import { logger } from "../utils/logger.js";

/**
 * Deployment Addresses from https://github.com/erc-8004/erc-8004-contracts
 */
export const ERC8004_ADDRESSES = {
  BASE_MAINNET: {
    IDENTITY: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
    REPUTATION: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63",
  },
  BASE_SEPOLIA: {
    IDENTITY: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
    REPUTATION: "0x8004B663056A597Dffe9eCcC1965A193B7388713",
  },
};

export interface ERC8004VerificationInput {
  agentId: string;
  walletAddress: string;
  proof: string;
  signature: string;
}

export interface ERC8004VerificationResult {
  verified: boolean;
  agentId: string;
  ownerAddress: string;
  verifiedAt: Date;
  error?: string;
}

const IDENTITY_REGISTRY_ABI = [
  "function isAgentOwner(bytes32 agentId, address walletAddress) view returns (bool)",
  "function getAgentOwner(bytes32 agentId) view returns (address)",
  "function registerAgent(bytes32 agentId, address walletAddress) external",
  "function verifyOwnership(bytes32 agentId, string proof, bytes signature) view returns (bool)",
  "function revokeAgent(bytes32 agentId) external",
];

const REPUTATION_REGISTRY_ABI = [
  "function getReputation(bytes32 agentId) view returns (uint256)",
  "function updateReputation(bytes32 agentId, uint256 newReputation) external",
  "function getHistory(bytes32 agentId) view returns (tuple(uint256 score, uint256 timestamp)[])",
];

/**
 * Check if a string is a valid Ethereum address
 */
function isValidEthereumAddress(address: string): boolean {
  try {
    ethers.getAddress(address);
    return true;
  } catch {
    return false;
  }
}

export class ERC8004VerificationService {
  private idContract: Contract | null = null;
  private repContract: Contract | null = null;
  private provider: Provider | null = null;
  private signer: Signer | null = null;

  constructor(
    contractAddress: string,
    rpcUrl: string,
    _chainId?: number,
    privateKey?: string
  ) {
    try {
      this.provider = new ethers.JsonRpcProvider(rpcUrl);

      if (privateKey) {
        this.signer = new ethers.Wallet(privateKey, this.provider);
        this.idContract = new ethers.Contract(contractAddress, IDENTITY_REGISTRY_ABI, this.signer);
        this.repContract = new ethers.Contract(contractAddress, REPUTATION_REGISTRY_ABI, this.signer);
      } else {
        this.idContract = new ethers.Contract(contractAddress, IDENTITY_REGISTRY_ABI, this.provider);
        this.repContract = new ethers.Contract(contractAddress, REPUTATION_REGISTRY_ABI, this.provider);
      }

      logger.info("ERC-8004 Service initialized", {
        contractAddress,
        hasSigner: !!this.signer,
      });
    } catch (err) {
      logger.error("Failed to initialize ERC-8004 service", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ==================== IDENTITY MANAGEMENT ====================

  async verifyAgentOwnership(
    input: ERC8004VerificationInput
  ): Promise<ERC8004VerificationResult> {
    // Input validation
    if (!input.agentId) {
      return {
        verified: false,
        agentId: input.agentId,
        ownerAddress: input.walletAddress,
        verifiedAt: new Date(),
        error: "Invalid agent ID: agent ID cannot be empty",
      };
    }

    if (!input.proof) {
      return {
        verified: false,
        agentId: input.agentId,
        ownerAddress: input.walletAddress,
        verifiedAt: new Date(),
        error: "Invalid proof: proof cannot be empty",
      };
    }

    if (!input.signature) {
      return {
        verified: false,
        agentId: input.agentId,
        ownerAddress: input.walletAddress,
        verifiedAt: new Date(),
        error: "Invalid signature: signature cannot be empty",
      };
    }

    if (!isValidEthereumAddress(input.walletAddress)) {
      return {
        verified: false,
        agentId: input.agentId,
        ownerAddress: input.walletAddress,
        verifiedAt: new Date(),
        error: "Invalid Ethereum address: wallet address format is invalid",
      };
    }

    if (!this.idContract) {
      return {
        verified: false,
        agentId: input.agentId,
        ownerAddress: input.walletAddress,
        verifiedAt: new Date(),
        error: "Identity contract not initialized",
      };
    }

    try {
      // Normalize to checksum address
      const normalizedAddress = ethers.getAddress(input.walletAddress);
      const agentIdHash = ethers.id(input.agentId);
      const isOwner = await this.idContract.verifyOwnership(
        agentIdHash,
        input.proof,
        input.signature
      );

      return {
        verified: isOwner,
        agentId: input.agentId,
        ownerAddress: normalizedAddress,
        verifiedAt: new Date(),
        error: isOwner ? undefined : "Wallet does not own this agent identity",
      };
    } catch (err) {
      return {
        verified: false,
        agentId: input.agentId,
        ownerAddress: input.walletAddress,
        verifiedAt: new Date(),
        error: `Verification error: ${err instanceof Error ? err.message : "Unknown error"}`,
      };
    }
  }

  async registerAgent(agentId: string, walletAddress: string): Promise<string> {
    if (!this.idContract || !this.signer) throw new Error("Signer required for registration");

    try {
      const agentIdHash = ethers.id(agentId);
      const tx = await this.idContract.registerAgent(agentIdHash, walletAddress);
      await tx.wait();
      return tx.hash;
    } catch (err) {
      logger.error("Failed to register agent on-chain", { agentId, error: err });
      throw err;
    }
  }

  // ==================== REPUTATION MANAGEMENT ====================

  /**
   * Check if wallet owns agent identity on-chain
   */
  async isAgentOwner(agentId: string, walletAddress: string): Promise<boolean> {
    if (!this.idContract) return false;

    if (!agentId || !isValidEthereumAddress(walletAddress)) {
      return false;
    }

    try {
      const agentIdHash = ethers.id(agentId);
      const isOwner = await this.idContract.isAgentOwner(agentIdHash, walletAddress);
      return Boolean(isOwner);
    } catch (err) {
      logger.warn("Failed to check agent ownership", { agentId, walletAddress, error: err });
      return false;
    }
  }

  /**
   * Get owner address of an agent from the registry
   */
  async getAgentOwner(agentId: string): Promise<string | null> {
    if (!agentId) return null;

    if (!this.idContract) return null;

    try {
      const agentIdHash = ethers.id(agentId);
      const owner = await this.idContract.getAgentOwner(agentIdHash);
      return owner as string;
    } catch (err) {
      logger.warn("Failed to get agent owner", { agentId, error: err });
      return null;
    }
  }

  async getAgentReputation(agentId: string): Promise<number> {
    if (!this.repContract) throw new Error("Reputation contract not initialized");
    try {
      const agentIdHash = ethers.id(agentId);
      const reputation = await this.repContract.getReputation(agentIdHash);
      return Number(reputation);
    } catch (err) {
      logger.error("Failed to fetch agent reputation", { agentId, error: err });
      return 0;
    }
  }

  async updateAgentReputation(agentId: string, newScore: number): Promise<string> {
    if (!this.repContract || !this.signer) throw new Error("Signer required for reputation update");
    try {
      const agentIdHash = ethers.id(agentId);
      const tx = await this.repContract.updateReputation(agentIdHash, BigInt(newScore));
      await tx.wait();
      return tx.hash;
    } catch (err) {
      logger.error("Failed to update agent reputation", { agentId, score: newScore, error: err });
      throw err;
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.provider || !this.idContract) return false;
    try {
      const code = await this.provider.getCode(await this.idContract.getAddress());
      return code !== "0x";
    } catch {
      return false;
    }
  }
}

/**
 * Create a new ERC-8004 verification service with a single contract address.
 * Validates the contract address before creating the service.
 *
 * @param contractAddress - The ERC-8004 registry contract address (must be valid Ethereum address)
 * @param rpcUrl - The RPC URL for the blockchain network
 * @param chainId - Optional chain ID (defaults to Sepolia testnet 11155111)
 * @throws Error if contractAddress is not a valid Ethereum address
 */
export function createERC8004VerificationService(
  contractAddress: string,
  rpcUrl: string,
  chainId?: number
): ERC8004VerificationService {
  // Validate contract address - throws if invalid
  ethers.getAddress(contractAddress);

  return new ERC8004VerificationService(contractAddress, rpcUrl, chainId);
}

/**
 * Factory function to create environment-aware ERC-8004 service
 */
export function getERC8004Service(): ERC8004VerificationService {
  const env = process.env.NODE_ENV === "production" ? "BASE_MAINNET" : "BASE_SEPOLIA";
  const config = ERC8004_ADDRESSES[env];

  const contractAddress = process.env.ERC8004_IDENTITY_ADDRESS || config.IDENTITY;

  const rpcUrl = process.env.ERC8004_RPC_URL ||
    (env === "BASE_MAINNET" ? "https://mainnet.base.org" : "https://sepolia.base.org");

  const privateKey = process.env.ERC8004_PRIVATE_KEY;

  return new ERC8004VerificationService(contractAddress, rpcUrl, undefined, privateKey);
}
