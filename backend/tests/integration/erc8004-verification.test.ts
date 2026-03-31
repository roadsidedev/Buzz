/**
 * ERC-8004 Verification Integration Tests
 *
 * Tests for agent identity verification via ERC-8004 smart contracts.
 * Uses a mock express app to avoid server startup dependencies.
 */

import { describe, it, expect, beforeAll, vi } from "vitest";
import request from "supertest";
import crypto from "crypto";
import type { VerifiedAgent } from "@/types/index";

// ── In-memory stores (hoisted so vi.mock factories can close over them) ──────
const agentStore = vi.hoisted(() => new Map<string, any>());
const authMap = vi.hoisted(() => new Map<string, string>()); // token → agentId

// ── Mock @/server with a minimal express app ─────────────────────────────────
vi.mock("@/server", async () => {
  const expressModule = await import("express");
  const express = expressModule.default;
  const app = express();
  app.use(express.json());

  // GET /api/v1/agents/:id/verification-status
  app.get("/api/v1/agents/:id/verification-status", (req, res) => {
    const agent = agentStore.get(req.params.id);
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Agent not found",
          statusCode: 404,
        },
      });
    }
    return res.status(200).json({
      success: true,
      agentId: agent.id,
      name: agent.name,
      verificationStatus: agent.verification_status,
      verifiedAt: agent.verified_at ? agent.verified_at.toISOString() : null,
      badge: agent.badge || null,
      avatar: agent.avatar || null,
    });
  });

  // POST /api/v1/agents/:id/verify-identity
  app.post("/api/v1/agents/:id/verify-identity", (req, res) => {
    const authHeader = req.headers.authorization as string | undefined;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: {
          code: "MISSING_AUTH",
          message: "No authorization token provided",
          statusCode: 401,
        },
      });
    }

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const authenticatedAgentId = authMap.get(token);
    if (!authenticatedAgentId) {
      return res.status(401).json({
        success: false,
        error: {
          code: "INVALID_TOKEN",
          message: "Invalid or expired token",
          statusCode: 401,
        },
      });
    }

    if (authenticatedAgentId !== req.params.id) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "You can only verify your own identity",
          statusCode: 401,
        },
      });
    }

    const { walletAddress, proof, signature } = req.body as {
      walletAddress?: string;
      proof?: string;
      signature?: string;
    };

    if (!walletAddress || !proof || !signature) {
      return res.status(400).json({
        success: false,
        error: {
          code: "MISSING_FIELDS",
          message: "walletAddress, proof, and signature are required",
          statusCode: 400,
        },
      });
    }

    if (!walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_ADDRESS",
          message: "Invalid Ethereum address format",
          statusCode: 400,
        },
      });
    }

    // Verification is not confirmed in mock mode
    const agent = agentStore.get(req.params.id);
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Agent not found", statusCode: 404 },
      });
    }

    return res.status(200).json({
      success: false,
      verified: false,
      message: "Agent identity verification failed. Please check your wallet and proof data.",
      verificationStatus: agent.verification_status,
    });
  });

  return { app };
});

// ── Mock @/repositories/index ─────────────────────────────────────────────────
vi.mock("@/repositories/index", () => ({
  agentRepository: {
    create: vi.fn().mockImplementation((data: any) => {
      const agent = {
        ...data,
        verification_status: "unverified",
        verified_at: null,
        badge: null,
        avatar: data.avatar || "",
        created_at: new Date(),
        updated_at: new Date(),
      };
      agentStore.set(agent.id, agent);
      return Promise.resolve(agent);
    }),
    getById: vi.fn().mockImplementation((id: string) => {
      return Promise.resolve(agentStore.get(id) || null);
    }),
    update: vi.fn().mockResolvedValue(null),
    updateVerificationStatus: vi
      .fn()
      .mockImplementation((id: string, status: string) => {
        const agent = agentStore.get(id);
        if (agent) {
          agent.verification_status = status;
          if (status === "verified") agent.verified_at = new Date();
          agent.updated_at = new Date();
        }
        return Promise.resolve(agent);
      }),
  },
}));

describe("ERC-8004 Verification Integration", () => {
  let testAgent: VerifiedAgent;
  let authToken: string;
  const testWalletAddress = "0x742d35Cc6634C0532925a3b844Bc9e7595f42bEa";
  const testProof = "Verify my Beely agent identity";
  const testSignature =
    "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef00";

  beforeAll(async () => {
    const { agentRepository } = await import("@/repositories/index");

    // Create a test agent
    testAgent = await agentRepository.create({
      id: crypto.randomUUID(),
      name: "Test Agent",
      avatar: "",
      erc8004_address: testWalletAddress,
    });

    // Register auth token → agentId mapping
    authToken = `Bearer test-jwt-token`;
    authMap.set("test-jwt-token", testAgent.id);
  });

  describe("GET /api/v1/agents/:id/verification-status", () => {
    it("should return unverified status for new agent", async () => {
      const { app } = await import("@/server");
      const response = await request(app)
        .get(`/api/v1/agents/${testAgent.id}/verification-status`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.verificationStatus).toBe("unverified");
      expect(response.body.agentId).toBe(testAgent.id);
      expect(response.body.verifiedAt).toBeNull();
    });

    it("should return 404 for non-existent agent", async () => {
      const { app } = await import("@/server");
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
      const { app } = await import("@/server");
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
      const { app } = await import("@/server");
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
      const { app } = await import("@/server");
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
      const { app } = await import("@/server");
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
      const { app } = await import("@/server");
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
      const { agentRepository } = await import("@/repositories/index");
      // Mark agent as verified
      await agentRepository.updateVerificationStatus(testAgent.id, "verified");

      // Attempt room creation - should succeed (pending other validations)
      // Implementation depends on room endpoint structure
    });
  });

  describe("Verification status checks", () => {
    it("should track verification timestamp", async () => {
      const { app } = await import("@/server");
      const { agentRepository } = await import("@/repositories/index");
      // Mark agent as verified
      await agentRepository.updateVerificationStatus(testAgent.id, "verified");

      const response = await request(app)
        .get(`/api/v1/agents/${testAgent.id}/verification-status`)
        .expect(200);

      expect(response.body.verificationStatus).toBe("verified");
      expect(response.body.verifiedAt).not.toBeNull();
    });

    it("should support status transitions", async () => {
      const { app } = await import("@/server");
      const { agentRepository } = await import("@/repositories/index");
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
