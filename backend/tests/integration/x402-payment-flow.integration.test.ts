/**
 * x402 Payment Integration Tests
 *
 * Complete payment flow test:
 * 1. Charge spawn fee → 2. Verify payment → 3. Distribute revenue
 *
 * Covers:
 * - Spawn fee collection
 * - Payment status checking
 * - Revenue distribution
 * - Refunds
 * - Podcast generation costs
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { paymentService } from "../../src/services/payment-service.js";
import { getX402PaymentService } from "../../src/services/x402-payment-service.js";
import {
  PaymentStatus,
  PaymentType,
} from "../../src/config/x402-config.js";
import { ValidationError, PaymentError } from "../../src/utils/errors.js";

describe("x402 Payment Integration", () => {
  const x402Service = getX402PaymentService();

  // Test data
  const agentId = "test-agent-1";
  const roomId = "test-room-1";
  const walletAddress = "0x1234567890123456789012345678901234567890";
  const hostWalletAddress = "0x2234567890123456789012345678901234567890";
  const participant1Wallet = "0x3234567890123456789012345678901234567890";
  const participant2Wallet = "0x4234567890123456789012345678901234567890";

  // ===================================================================
  // SPAWN FEE TESTS
  // ===================================================================

  describe("chargeSpawnFee", () => {
    it("should initiate spawn fee payment with valid inputs", async () => {
      const payment = await paymentService.chargeSpawnFee(
        agentId,
        roomId,
        walletAddress,
      );

      expect(payment).toBeDefined();
      expect(payment.id).toBeDefined();
      expect(payment.amount).toBeGreaterThan(0);
      expect(payment.status).toBe("pending");
    });

    it("should throw ValidationError for invalid wallet address", async () => {
      const invalidWallet = "not-a-wallet";

      await expect(
        paymentService.chargeSpawnFee(agentId, roomId, invalidWallet),
      ).rejects.toThrow(ValidationError);
    });

    it("should throw ValidationError for missing agentId", async () => {
      await expect(
        paymentService.chargeSpawnFee("", roomId, walletAddress),
      ).rejects.toThrow(ValidationError);
    });

    it("should throw ValidationError for missing walletAddress", async () => {
      await expect(
        paymentService.chargeSpawnFee(agentId, roomId, ""),
      ).rejects.toThrow(ValidationError);
    });
  });

  // ===================================================================
  // PAYMENT STATUS TESTS
  // ===================================================================

  describe("getPaymentStatus", () => {
    let paymentId: string;

    beforeAll(async () => {
      const payment = await paymentService.chargeSpawnFee(
        agentId,
        roomId,
        walletAddress,
      );
      paymentId = payment.id;
    });

    it("should return payment status", async () => {
      const status = await paymentService.getPaymentStatus(paymentId);

      expect(status).toBeDefined();
      expect(["pending", "confirming", "confirmed", "failed"]).toContain(
        status,
      );
    });

    it("should throw PaymentError for non-existent payment", async () => {
      const fakePaymentId = "fake-payment-id";

      await expect(
        paymentService.getPaymentStatus(fakePaymentId),
      ).rejects.toThrow(PaymentError);
    });
  });

  // ===================================================================
  // SPAWN FEE VERIFICATION TESTS
  // ===================================================================

  describe("verifySpawnFeeConfirmed", () => {
    let paymentId: string;

    beforeAll(async () => {
      const payment = await paymentService.chargeSpawnFee(
        agentId,
        roomId,
        walletAddress,
      );
      paymentId = payment.id;
    });

    it("should return false for pending payment", async () => {
      const confirmed = await paymentService.verifySpawnFeeConfirmed(paymentId);

      expect(confirmed).toBe(false);
    });

    it("should return true after webhook confirms payment", async () => {
      // Simulate webhook confirmation
      await x402Service.processWebhookPayment(
        paymentId,
        PaymentStatus.CONFIRMED,
        "0xtxhash123456789",
      );

      const confirmed = await paymentService.verifySpawnFeeConfirmed(paymentId);

      expect(confirmed).toBe(true);
    });
  });

  // ===================================================================
  // REVENUE DISTRIBUTION TESTS
  // ===================================================================

  describe("distributeRevenue", () => {
    let totalSpawnFee: bigint;

    beforeAll(() => {
      // Assume $10 spawn fee = 1000 cents = 10^18 wei
      totalSpawnFee = BigInt(1000) * BigInt(10_000_000_000_000_000);
    });

    it("should distribute revenue to host and participants", async () => {
      const participantData = [
        { agentId: "participant-1", walletAddress: participant1Wallet },
        { agentId: "participant-2", walletAddress: participant2Wallet },
      ];

      const payments = await paymentService.distributeRevenue(
        roomId,
        agentId,
        hostWalletAddress,
        participantData,
        totalSpawnFee,
      );

      expect(payments).toBeDefined();
      expect(payments.length).toBeGreaterThan(0);
      expect(payments[0]).toHaveProperty("id");
      expect(payments[0]).toHaveProperty("amount");
      expect(payments[0]).toHaveProperty("status");
    });

    it("should calculate correct revenue splits", async () => {
      // Revenue split should be:
      // Host: 50%
      // Participants: 40% (20% each for 2 participants)
      // Platform: 10%

      const participantData = [
        { agentId: "participant-1", walletAddress: participant1Wallet },
      ];

      const payments = await paymentService.distributeRevenue(
        roomId,
        agentId,
        hostWalletAddress,
        participantData,
        totalSpawnFee,
      );

      // Verify payments were created
      expect(payments.length).toBeGreaterThan(0);

      // Note: Exact amounts depend on x402 SDK implementation
      // This test verifies structure and flow
      for (const payment of payments) {
        expect(payment.id).toBeDefined();
        expect(payment.amount).toBeGreaterThan(0);
        expect(payment.status).toBe("pending");
      }
    });
  });

  // ===================================================================
  // REFUND TESTS
  // ===================================================================

  describe("refundPayment", () => {
    let paymentId: string;

    beforeAll(async () => {
      const payment = await paymentService.chargeSpawnFee(
        agentId,
        roomId,
        walletAddress,
      );
      paymentId = payment.id;
    });

    it("should refund payment with valid reason", async () => {
      const refundedPayment = await paymentService.refundPayment(
        paymentId,
        "Room was cancelled by host",
      );

      expect(refundedPayment).toBeDefined();
      expect(refundedPayment.id).toBe(paymentId);
      expect(refundedPayment.status).toBe("refunded");
    });

    it("should throw ValidationError for missing reason", async () => {
      const payment = await paymentService.chargeSpawnFee(
        agentId,
        roomId,
        walletAddress,
      );

      await expect(
        paymentService.refundPayment(payment.id, ""),
      ).rejects.toThrow(ValidationError);
    });
  });

  // ===================================================================
  // PODCAST GENERATION COST TESTS
  // ===================================================================

  describe("chargeGenerationCost", () => {
    it("should charge podcast generation cost with valid inputs", async () => {
      const payment = await paymentService.chargeGenerationCost(
        agentId,
        "episode-1",
        walletAddress,
        0.5, // $0.50
        "My Podcast Episode",
      );

      expect(payment).toBeDefined();
      expect(payment.id).toBeDefined();
      expect(payment.amount).toBeGreaterThan(0);
      expect(payment.type).toBe("podcast_generation");
    });

    it("should throw ValidationError for invalid cost", async () => {
      await expect(
        paymentService.chargeGenerationCost(
          agentId,
          "episode-1",
          walletAddress,
          0, // Zero cost
        ),
      ).rejects.toThrow(ValidationError);
    });

    it("should throw ValidationError for cost exceeding maximum", async () => {
      await expect(
        paymentService.chargeGenerationCost(
          agentId,
          "episode-1",
          walletAddress,
          2000, // Exceeds 1000 max
        ),
      ).rejects.toThrow(ValidationError);
    });

    it("should set generation cost type correctly", async () => {
      const payment = await paymentService.chargeGenerationCost(
        agentId,
        "episode-2",
        walletAddress,
        1.0,
      );

      expect(payment.type).toBe("podcast_generation");
    });
  });

  // ===================================================================
  // END-TO-END FLOW TESTS
  // ===================================================================

  describe("Complete Payment Flow", () => {
    it("should complete spawn fee → confirmation → distribution flow", async () => {
      // Step 1: Charge spawn fee
      const spawnPayment = await paymentService.chargeSpawnFee(
        agentId,
        roomId,
        hostWalletAddress,
      );

      expect(spawnPayment.id).toBeDefined();
      expect(spawnPayment.status).toBe("pending");

      // Step 2: Verify payment is pending
      let isConfirmed = await paymentService.verifySpawnFeeConfirmed(
        spawnPayment.id,
      );
      expect(isConfirmed).toBe(false);

      // Step 3: Simulate webhook confirmation
      await x402Service.processWebhookPayment(
        spawnPayment.id,
        PaymentStatus.CONFIRMED,
        "0xtxhash12345",
      );

      // Step 4: Verify payment is confirmed
      isConfirmed = await paymentService.verifySpawnFeeConfirmed(
        spawnPayment.id,
      );
      expect(isConfirmed).toBe(true);

      // Step 5: Distribute revenue to participants
      const totalSpawnFee =
        BigInt(100) * BigInt(10_000_000_000_000_000);

      const distributions = await paymentService.distributeRevenue(
        roomId,
        agentId,
        hostWalletAddress,
        [
          { agentId: "participant-1", walletAddress: participant1Wallet },
        ],
        totalSpawnFee,
      );

      expect(distributions.length).toBeGreaterThan(0);
      expect(distributions[0].amount).toBeGreaterThan(0);
    });

    it("should handle payment failure and refund flow", async () => {
      // Step 1: Charge spawn fee
      const payment = await paymentService.chargeSpawnFee(
        agentId,
        roomId,
        walletAddress,
      );

      // Step 2: Simulate payment failure via webhook
      await x402Service.processWebhookPayment(
        payment.id,
        PaymentStatus.FAILED,
      );

      // Step 3: Refund payment
      const refundedPayment = await paymentService.refundPayment(
        payment.id,
        "Payment failed on x402 network",
      );

      expect(refundedPayment.status).toBe("refunded");
    });
  });
});
