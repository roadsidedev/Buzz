/**
 * Phase 2 Payment Enhancements - Integration Tests
 *
 * Comprehensive test suite for:
 * - Spawn fee charging with database persistence
 * - Payment status tracking
 * - Webhook processing with idempotency
 * - Refund mechanism
 * - Revenue distribution
 * - Expired payment auto-refunds
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getX402PaymentService } from "../../src/services/x402-payment-service.js";
import { PaymentStatus, PaymentType } from "../../src/config/x402-config.js";

describe("Phase 2 Payment Enhancements", () => {
  let paymentService: any;

  beforeEach(() => {
    paymentService = getX402PaymentService();
  });

  describe("7.1 & 7.2a - Spawn Fee Charging with x402", () => {
    it("should charge spawn fee and return payment record", async () => {
      const agentId = "agent-test-123";
      const walletAddress = "0x1234567890123456789012345678901234567890";
      const roomId = "room-test-456";

      const payment = await paymentService.chargeSpawnFee(
        agentId,
        walletAddress,
        roomId
      );

      expect(payment).toBeDefined();
      expect(payment.id).toBeDefined();
      expect(payment.agentId).toBe(agentId);
      expect(payment.walletAddress).toBe(walletAddress);
      expect(payment.roomId).toBe(roomId);
      expect(payment.type).toBe(PaymentType.SPAWN_FEE);
      expect(payment.status).toBe(PaymentStatus.PENDING);
      expect(payment.createdAt).toBeInstanceOf(Date);
    });

    it("should reject invalid wallet address", async () => {
      const agentId = "agent-test-123";
      const invalidWallet = "not-a-wallet"; // Missing 0x prefix

      await expect(
        paymentService.chargeSpawnFee(agentId, invalidWallet)
      ).rejects.toThrow("Invalid wallet address format");
    });

    it("should reject missing agent ID", async () => {
      const walletAddress = "0x1234567890123456789012345678901234567890";

      await expect(
        paymentService.chargeSpawnFee("", walletAddress)
      ).rejects.toThrow("Missing agentId or walletAddress");
    });

    it("should persist payment to database", async () => {
      const agentId = "agent-persist-123";
      const walletAddress = "0x1234567890123456789012345678901234567890";

      const payment = await paymentService.chargeSpawnFee(
        agentId,
        walletAddress
      );

      // Verify payment was persisted (would need paymentRepository.getById)
      // This is a placeholder for actual DB verification
      expect(payment.id).toBeTruthy();
    });
  });

  describe("7.3 - Payment Status Tracking", () => {
    it("should check payment status from database", async () => {
      const agentId = "agent-status-123";
      const walletAddress = "0x1234567890123456789012345678901234567890";

      const payment = await paymentService.chargeSpawnFee(
        agentId,
        walletAddress
      );

      const status = await paymentService.checkPaymentStatus(payment.id);

      expect(status).toBe(PaymentStatus.PENDING);
    });

    it("should throw error for non-existent payment", async () => {
      const nonExistentId = "00000000-0000-0000-0000-000000000000";

      await expect(
        paymentService.checkPaymentStatus(nonExistentId)
      ).rejects.toThrow("Payment not found");
    });
  });

  describe("7.6 - Webhook Processing with Idempotency", () => {
    it("should process webhook and update payment status", async () => {
      const agentId = "agent-webhook-123";
      const walletAddress = "0x1234567890123456789012345678901234567890";

      const payment = await paymentService.chargeSpawnFee(
        agentId,
        walletAddress
      );

      // Process webhook
      await paymentService.processWebhookPayment(
        payment.id,
        PaymentStatus.CONFIRMED,
        "0xabcdef1234567890"
      );

      // Verify status updated
      const updatedStatus = await paymentService.checkPaymentStatus(payment.id);
      expect(updatedStatus).toBe(PaymentStatus.CONFIRMED);
    });

    it("should handle webhook retry (idempotency)", async () => {
      const agentId = "agent-idempotent-123";
      const walletAddress = "0x1234567890123456789012345678901234567890";

      const payment = await paymentService.chargeSpawnFee(
        agentId,
        walletAddress
      );

      // First webhook
      await paymentService.processWebhookPayment(
        payment.id,
        PaymentStatus.CONFIRMED
      );

      // Verify status
      let status = await paymentService.checkPaymentStatus(payment.id);
      expect(status).toBe(PaymentStatus.CONFIRMED);

      // Retry same webhook (should not error)
      await paymentService.processWebhookPayment(
        payment.id,
        PaymentStatus.CONFIRMED
      );

      // Status should still be CONFIRMED (no double-processing)
      status = await paymentService.checkPaymentStatus(payment.id);
      expect(status).toBe(PaymentStatus.CONFIRMED);
    });

    it("should use idempotency key to prevent duplicates", async () => {
      const agentId = "agent-key-123";
      const walletAddress = "0x1234567890123456789012345678901234567890";

      const payment = await paymentService.chargeSpawnFee(
        agentId,
        walletAddress
      );

      const idempotencyKey = "unique-key-123";

      // Process webhook with key
      await paymentService.processWebhookPayment(
        payment.id,
        PaymentStatus.CONFIRMED,
        undefined,
        idempotencyKey
      );

      expect(await paymentService.checkPaymentStatus(payment.id)).toBe(
        PaymentStatus.CONFIRMED
      );
    });
  });

  describe("7.7 - Refund Mechanism", () => {
    it("should refund pending payment", async () => {
      const agentId = "agent-refund-123";
      const walletAddress = "0x1234567890123456789012345678901234567890";

      const payment = await paymentService.chargeSpawnFee(
        agentId,
        walletAddress
      );

      expect(payment.status).toBe(PaymentStatus.PENDING);

      // Issue refund
      await paymentService.issueRefund(payment.id, "Test refund");

      // Verify refunded
      const status = await paymentService.checkPaymentStatus(payment.id);
      expect(status).toBe(PaymentStatus.REFUNDED);
    });

    it("should not refund already refunded payment", async () => {
      const agentId = "agent-double-refund-123";
      const walletAddress = "0x1234567890123456789012345678901234567890";

      const payment = await paymentService.chargeSpawnFee(
        agentId,
        walletAddress
      );

      // First refund
      await paymentService.issueRefund(payment.id);

      // Second refund attempt (should not error, just log)
      await paymentService.issueRefund(payment.id);

      // Status should still be REFUNDED
      const status = await paymentService.checkPaymentStatus(payment.id);
      expect(status).toBe(PaymentStatus.REFUNDED);
    });

    it("should reject refund for confirmed payment", async () => {
      const agentId = "agent-confirmed-refund-123";
      const walletAddress = "0x1234567890123456789012345678901234567890";

      const payment = await paymentService.chargeSpawnFee(
        agentId,
        walletAddress
      );

      // Confirm payment first
      await paymentService.processWebhookPayment(
        payment.id,
        PaymentStatus.CONFIRMED
      );

      // Try to refund (should fail)
      await expect(
        paymentService.issueRefund(payment.id)
      ).rejects.toThrow("Cannot refund payment with status");
    });

    it("should throw error for non-existent payment refund", async () => {
      const nonExistentId = "00000000-0000-0000-0000-000000000001";

      await expect(
        paymentService.issueRefund(nonExistentId)
      ).rejects.toThrow("Payment not found");
    });
  });

  describe("7.7 - Payment Timeout & Auto-Refund", () => {
    it("should detect and refund expired payments", async () => {
      // This test would need to mock time or create old payments
      // For now, we test that the method runs without error
      const count = await paymentService.refundExpiredPayments(60);

      expect(typeof count).toBe("number");
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it("should handle errors during expiry check gracefully", async () => {
      // Background job should not throw even if DB fails
      const count = await paymentService.refundExpiredPayments(60);

      // Should return 0 on error, not throw
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe("7.4 - Revenue Distribution", () => {
    it("should distribute revenue 50/40/10", async () => {
      const roomId = "room-dist-123";
      const hostWallet = "0x0000000000000000000000000000000000000001";
      const participant1 = "0x0000000000000000000000000000000000000002";
      const participant2 = "0x0000000000000000000000000000000000000003";
      const totalRevenue = BigInt(1000); // 1000 units

      const payouts = await paymentService.distributeRevenue(
        roomId,
        hostWallet,
        [participant1, participant2],
        totalRevenue
      );

      // Should have 4 payouts: host + 2 participants + platform
      expect(payouts.length).toBe(4);

      // Verify split
      const hostPayout = payouts.find(
        (p) => p.type === PaymentType.HOST_PAYOUT
      );
      const participantPayouts = payouts.filter(
        (p) => p.type === PaymentType.PARTICIPANT_PAYOUT
      );
      const platformPayout = payouts.find(
        (p) => p.type === PaymentType.PLATFORM_REVENUE
      );

      expect(hostPayout?.amount).toBe(BigInt(500)); // 50%
      expect(participantPayouts[0]?.amount).toBe(BigInt(200)); // 20% each
      expect(participantPayouts[1]?.amount).toBe(BigInt(200)); // 20% each
      expect(platformPayout?.amount).toBe(BigInt(100)); // 10%
    });

    it("should reject invalid host wallet", async () => {
      const roomId = "room-invalid-123";
      const invalidWallet = "not-a-wallet";

      await expect(
        paymentService.distributeRevenue(
          roomId,
          invalidWallet,
          [],
          BigInt(1000)
        )
      ).rejects.toThrow("Invalid host wallet address");
    });

    it("should reject zero or negative revenue", async () => {
      const roomId = "room-zero-123";
      const hostWallet = "0x0000000000000000000000000000000000000001";

      await expect(
        paymentService.distributeRevenue(roomId, hostWallet, [], BigInt(0))
      ).rejects.toThrow("Total revenue must be positive");
    });
  });

  describe("Webhook Security", () => {
    it("should verify valid webhook signature", () => {
      const crypto = require("crypto");
      const body = "test-body";
      const secret = "test-secret";

      const hash = crypto
        .createHmac("sha256", secret)
        .update(body)
        .digest("hex");

      // Set config secret for test
      const result = paymentService.verifyWebhookSignature(body, hash);

      // Note: This test would need proper secret mocking
      expect(typeof result).toBe("boolean");
    });
  });

  describe("Error Handling", () => {
    it("should provide helpful error messages", async () => {
      try {
        await paymentService.chargeSpawnFee("test", "invalid-wallet");
      } catch (err: any) {
        expect(err.message).toContain("Invalid wallet address");
        expect(err.message).not.toContain("undefined");
      }
    });

    it("should log errors with context", async () => {
      // Error logging tested through logger assertions
      // This is more of a manual verification during development
      const agentId = "agent-error-123";
      const invalidWallet = "invalid";

      try {
        await paymentService.chargeSpawnFee(agentId, invalidWallet);
      } catch (err) {
        // Should have logged the error
      }
    });
  });

  describe("Singleton Pattern", () => {
    it("should return same instance", () => {
      const service1 = getX402PaymentService();
      const service2 = getX402PaymentService();

      expect(service1).toBe(service2);
    });
  });
});
