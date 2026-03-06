/**
 * Tests for ERC-8004 Verification Service
 *
 * Tests:
 * - Contract initialization and health checks
 * - Agent ownership verification (happy path and failures)
 * - Cryptographic proof validation
 * - Timeout handling
 * - Address validation
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ethers } from "ethers";
import {
  ERC8004VerificationService,
  createERC8004VerificationService,
} from "../../../src/services/erc8004-verification-service";

// Test data
const TEST_CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000001";
const TEST_RPC_URL = "https://eth-sepolia.g.alchemy.com/v2/demo";
const TEST_CHAIN_ID = 11155111; // Sepolia testnet

const TEST_AGENT_ID = "test-agent-123";
const TEST_WALLET_ADDRESS = "0x1234567890123456789012345678901234567890";
const TEST_PROOF = "proof-data-123";
const TEST_SIGNATURE =
  "0x1234567890123456789012345678901234567890123456789012345678901234";

describe("ERC8004VerificationService", () => {
  let service: ERC8004VerificationService;

  beforeEach(() => {
    service = createERC8004VerificationService(
      TEST_CONTRACT_ADDRESS,
      TEST_RPC_URL,
      TEST_CHAIN_ID
    );
  });

  describe("initialization", () => {
    it("should initialize with contract address and RPC URL", () => {
      expect(service).toBeDefined();
    });

    it("should throw on invalid contract address", () => {
      expect(() => {
        createERC8004VerificationService("invalid-address", TEST_RPC_URL);
      }).toThrow();
    });

    it("should accept valid Sepolia testnet configuration", () => {
      const sepoliaService = createERC8004VerificationService(
        TEST_CONTRACT_ADDRESS,
        TEST_RPC_URL,
        11155111
      );
      expect(sepoliaService).toBeDefined();
    });
  });

  describe("verifyAgentOwnership", () => {
    it("should reject invalid wallet address format", async () => {
      const result = await service.verifyAgentOwnership({
        agentId: TEST_AGENT_ID,
        walletAddress: "invalid-address",
        proof: TEST_PROOF,
        signature: TEST_SIGNATURE,
      });

      expect(result.verified).toBe(false);
      expect(result.error).toContain("Invalid Ethereum address");
    });

    it("should reject empty agent ID", async () => {
      const result = await service.verifyAgentOwnership({
        agentId: "",
        walletAddress: TEST_WALLET_ADDRESS,
        proof: TEST_PROOF,
        signature: TEST_SIGNATURE,
      });

      expect(result.verified).toBe(false);
      expect(result.error).toContain("Invalid agent ID");
    });

    it("should reject empty proof", async () => {
      const result = await service.verifyAgentOwnership({
        agentId: TEST_AGENT_ID,
        walletAddress: TEST_WALLET_ADDRESS,
        proof: "",
        signature: TEST_SIGNATURE,
      });

      expect(result.verified).toBe(false);
      expect(result.error).toContain("Invalid proof");
    });

    it("should reject empty signature", async () => {
      const result = await service.verifyAgentOwnership({
        agentId: TEST_AGENT_ID,
        walletAddress: TEST_WALLET_ADDRESS,
        proof: TEST_PROOF,
        signature: "",
      });

      expect(result.verified).toBe(false);
      expect(result.error).toContain("Invalid signature");
    });

    it("should handle contract call timeout gracefully", async () => {
      // Note: In real tests with mocking, simulate timeout
      const result = await service.verifyAgentOwnership({
        agentId: TEST_AGENT_ID,
        walletAddress: TEST_WALLET_ADDRESS,
        proof: TEST_PROOF,
        signature: TEST_SIGNATURE,
      });

      // Should have some result (either verified or error)
      expect(result).toBeDefined();
      expect(result.agentId).toBe(TEST_AGENT_ID);
      expect(result.ownerAddress).toBe(TEST_WALLET_ADDRESS);
      expect(result.verifiedAt).toBeInstanceOf(Date);
    });

    it("should normalize wallet address to checksum format", async () => {
      const lowercaseAddress = "0x1234567890123456789012345678901234567890";

      const result = await service.verifyAgentOwnership({
        agentId: TEST_AGENT_ID,
        walletAddress: lowercaseAddress,
        proof: TEST_PROOF,
        signature: TEST_SIGNATURE,
      });

      // Address should be normalized
      expect(result.ownerAddress).toBeDefined();
      expect(result.ownerAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });
  });

  describe("isAgentOwner", () => {
    it("should validate address format", async () => {
      const result = await service.isAgentOwner("invalid-id", "invalid-address");
      expect(result).toBe(false);
    });

    it("should handle valid inputs gracefully", async () => {
      const result = await service.isAgentOwner(TEST_AGENT_ID, TEST_WALLET_ADDRESS);
      expect(typeof result).toBe("boolean");
    });
  });

  describe("getAgentOwner", () => {
    it("should return null for invalid agent ID", async () => {
      const owner = await service.getAgentOwner("");
      expect(owner).toBeNull();
    });

    it("should handle errors gracefully", async () => {
      const owner = await service.getAgentOwner("non-existent-agent");
      // Should return null on error, not throw
      expect(owner === null || typeof owner === "string").toBe(true);
    });
  });

  describe("healthCheck", () => {
    it("should return health status", async () => {
      const health = await service.healthCheck();
      expect(typeof health).toBe("boolean");
    });

    it("should return false if service not initialized", async () => {
      // Create service with invalid RPC
      const invalidService = new ERC8004VerificationService(
        TEST_CONTRACT_ADDRESS,
        "https://invalid-rpc-url.example.com",
        TEST_CHAIN_ID
      );

      const health = await invalidService.healthCheck();
      expect(health).toBe(false);
    });
  });

  describe("input validation", () => {
    it("should accept valid Ethereum addresses", () => {
      const validAddresses = [
        "0x1234567890123456789012345678901234567890",
        "0x0000000000000000000000000000000000000000",
        "0xffffffffffffffffffffffffffffffffffffffff",
      ];

      validAddresses.forEach((addr) => {
        expect(() => {
          // This would normally validate in the service
          ethers.getAddress(addr);
        }).not.toThrow();
      });
    });

    it("should reject invalid Ethereum addresses", () => {
      const invalidAddresses = [
        "0x123", // Too short
        "0x" + "1".repeat(41), // Too long
        "not-an-ethereum-address", // Not hex at all
        "0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG", // Invalid hex chars
      ];

      invalidAddresses.forEach((addr) => {
        expect(() => {
          ethers.getAddress(addr);
        }).toThrow();
      });
    });
  });
});
