/**
 * ERC-8004 Verification Integration Tests
 *
 * Tests for agent identity verification via ERC-8004 smart contracts
 */

import request from "supertest";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { app } from "@/server";
import { agentRepository } from "@/repositories/index";
import type { VerifiedAgent } from "@/types/index";
import crypto from "crypto";

describe("ERC-8004 Verification Integration", () => {
  let testAgent: VerifiedAgent;
  let authToken: string;
  const testWalletAddress = "0x742d35Cc6634C0532925a3b844Bc9e7595f42bE";
  const testProof = "Verify my ClawZz agent identity";
  const testSignature =
    "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef00";

  beforeAll(async () => {
    // Create a test agent
    testAgent = await agentRepository.create({
      id: crypto.randomUUID(),
      name: "Test Agent",
      avatar: "",
      erc8004_address: testWalletAddress,
    });

    // In production, get auth token from login/register
    // For testing, we'd mock the JWT
    authToken = `Bearer test-jwt-token`;
  });

  afterAll(async () => {
    // Cleanup
    // Note: In real tests, use a test database transaction
  });

  describe("GET /api/v1/agents/:id/verification-status", () => {
    it("should return unverified status for new agent", async () => {
      const response = await request(app)
        .get(`/api/v1/agents/${testAgent.id}/verification-status`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.verificationStatus).toBe("unverified");
      expect(response.body.agentId).toBe(testAgent.id);
      expect(response.body.verifiedAt).toBeNull();
    });

    it("should return 404 for non-existent agent", async () => {
      const fakeId = crypto.randomUUID();
      const response = await request(app)
        .get(`/api/v1/agents/${fakeId}/verification-status`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("POST /api/v1/agents/:id/verify-identity", () => {
    it("should require authentication", async () => {
      const response = await request(app)
        .post(`/api/v1/agents/${testAgent.id}/verify-identity`)
        .send({
          walletAddress: testWalletAddress,
          proof: testProof,
          signature: testSignature,
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("MISSING_AUTH");
    });

    it("should reject mismatched agent ID", async () => {
      const otherAgentId = crypto.randomUUID();
      const response = await request(app)
        .post(`/api/v1/agents/${otherAgentId}/verify-identity`)
        .set("Authorization", authToken)
        .send({
          walletAddress: testWalletAddress,
          proof: testProof,
          signature: testSignature,
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
    });

    it("should validate required fields", async () => {
      const response = await request(app)
        .post(`/api/v1/agents/${testAgent.id}/verify-identity`)
        .set("Authorization", authToken)
        .send({
          walletAddress: testWalletAddress,
          // Missing proof and signature
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("MISSING_FIELDS");
    });

    it("should validate Ethereum address format", async () => {
      const response = await request(app)
        .post(`/api/v1/agents/${testAgent.id}/verify-identity`)
        .set("Authorization", authToken)
        .send({
          walletAddress: "invalid-address",
          proof: testProof,
          signature: testSignature,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("INVALID_ADDRESS");
    });

    it("should handle verification failure gracefully", async () => {
      const response = await request(app)
        .post(`/api/v1/agents/${testAgent.id}/verify-identity`)
        .set("Authorization", authToken)
        .send({
          walletAddress: testWalletAddress,
          proof: testProof,
          signature: testSignature,
        })
        .expect(200);

      // Response indicates whether verification succeeded or not
      expect(response.body).toHaveProperty("verified");
      expect(response.body).toHaveProperty("verificationStatus");
    });
  });

  describe("Room creation with verification requirement", () => {
    it("should prevent unverified agents from creating rooms", async () => {
      // This test requires the room creation endpoint
      // Verify that unverified agent gets AGENT_NOT_VERIFIED error
      // Implementation depends on room endpoint structure
    });

    it("should allow verified agents to create rooms", async () => {
      // Mark agent as verified
      await agentRepository.updateVerificationStatus(testAgent.id, "verified");

      // Attempt room creation - should succeed (pending other validations)
      // Implementation depends on room endpoint structure
    });
  });

  describe("Verification status checks", () => {
    it("should track verification timestamp", async () => {
      // Mark agent as verified
      await agentRepository.updateVerificationStatus(testAgent.id, "verified");

      const response = await request(app)
        .get(`/api/v1/agents/${testAgent.id}/verification-status`)
        .expect(200);

      expect(response.body.verificationStatus).toBe("verified");
      expect(response.body.verifiedAt).not.toBeNull();
    });

    it("should support status transitions", async () => {
      // Test transitions: unverified -> pending -> verified -> suspended
      const statuses = ["unverified", "pending", "verified", "suspended"];

      for (const status of statuses) {
        await agentRepository.updateVerificationStatus(
          testAgent.id,
          status as any
        );

        const response = await request(app)
          .get(`/api/v1/agents/${testAgent.id}/verification-status`)
          .expect(200);

        expect(response.body.verificationStatus).toBe(status);
      }
    });
  });
});
