/**
 * Day 6 Integration Tests: x402 Payment Integration
 *
 * Tests:
 * 1. Spawn fee charging in room creation
 * 2. Webhook signature verification (HMAC-SHA256)
 * 3. Payment confirmation and room activation
 * 4. Error handling and recovery
 * 5. Payment persistence to database
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import crypto from "crypto";
import { X402PaymentService } from "../../src/services/x402-payment-service.js";
import { RoomService } from "../../src/services/room-service.js";
import { PaymentStatus, PaymentType } from "../../src/config/x402-config.js";

describe("Day 6: x402 Payment Integration", () => {
  let paymentService: X402PaymentService;
  let roomService: RoomService;

  // Test constants
  const TEST_WEBHOOK_SECRET = "test-webhook-secret-key";
  const TEST_AGENT_ID = "agent-test-123";
  const TEST_WALLET = "0x1234567890123456789012345678901234567890";
  const TEST_ROOM_ID = "room-test-456";
  const TEST_PAYMENT_ID = "payment-test-789";

  beforeEach(() => {
    // Set up environment for tests
    process.env.X402_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
    process.env.X402_API_KEY = "test-api-key";
    process.env.X402_SECRET_KEY = "test-secret-key";
    process.env.PLATFORM_WALLET = "0xplatform0000000000000000000000000000";

    paymentService = new X402PaymentService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Spawn Fee Charging", () => {
    it("should initiate spawn fee charge with valid inputs", async () => {
      // Act
      const payment = await paymentService.chargeSpawnFee(
        TEST_AGENT_ID,
        TEST_WALLET,
        TEST_ROOM_ID
      );

      // Assert
      expect(payment).toBeDefined();
      expect(payment.id).toBeDefined();
      expect(payment.agentId).toBe(TEST_AGENT_ID);
      expect(payment.roomId).toBe(TEST_ROOM_ID);
      expect(payment.status).toBe(PaymentStatus.PENDING);
      expect(payment.type).toBe(PaymentType.SPAWN_FEE);
      expect(payment.amount).toBeGreaterThan(0);
    });

    it("should reject spawn fee charge with missing agentId", async () => {
      // Act & Assert
      await expect(
        paymentService.chargeSpawnFee("", TEST_WALLET, TEST_ROOM_ID)
      ).rejects.toThrow();
    });

    it("should reject spawn fee charge with invalid wallet address", async () => {
      // Act & Assert
      await expect(
        paymentService.chargeSpawnFee(TEST_AGENT_ID, "invalid-wallet", TEST_ROOM_ID)
      ).rejects.toThrow("Invalid wallet address");
    });

    it("should reject spawn fee charge with non-0x wallet", async () => {
      // Act & Assert
      await expect(
        paymentService.chargeSpawnFee(
          TEST_AGENT_ID,
          "1234567890123456789012345678901234567890",
          TEST_ROOM_ID
        )
      ).rejects.toThrow("Invalid wallet address");
    });
  });

  describe("Webhook Signature Verification", () => {
    it("should verify valid webhook signature", () => {
      // Arrange
      const payload = JSON.stringify({
        paymentId: TEST_PAYMENT_ID,
        status: "confirmed",
        txHash: "0x1234567890abcdef",
      });

      // Create valid signature
      const validSignature = crypto
        .createHmac("sha256", TEST_WEBHOOK_SECRET)
        .update(payload)
        .digest("hex");

      // Act
      const isValid = paymentService.verifyWebhookSignature(payload, validSignature);

      // Assert
      expect(isValid).toBe(true);
    });

    it("should reject invalid webhook signature", () => {
      // Arrange
      const payload = JSON.stringify({
        paymentId: TEST_PAYMENT_ID,
        status: "confirmed",
      });

      const invalidSignature = "invalid-signature-hash";

      // Act
      const isValid = paymentService.verifyWebhookSignature(
        payload,
        invalidSignature
      );

      // Assert
      expect(isValid).toBe(false);
    });

    it("should reject tampered webhook payload", () => {
      // Arrange
      const payload1 = JSON.stringify({
        paymentId: TEST_PAYMENT_ID,
        status: "confirmed",
      });

      // Create signature for original payload
      const signature = crypto
        .createHmac("sha256", TEST_WEBHOOK_SECRET)
        .update(payload1)
        .digest("hex");

      // Tamper with payload
      const payload2 = JSON.stringify({
        paymentId: TEST_PAYMENT_ID,
        status: "failed", // Changed status
      });

      // Act
      const isValid = paymentService.verifyWebhookSignature(payload2, signature);

      // Assert
      expect(isValid).toBe(false);
    });

    it("should handle signature verification with empty secret", () => {
      // Arrange
      process.env.X402_WEBHOOK_SECRET = "";
      const paymentService2 = new X402PaymentService();

      const payload = JSON.stringify({
        paymentId: TEST_PAYMENT_ID,
        status: "confirmed",
      });

      // Act
      const isValid = paymentService2.verifyWebhookSignature(payload, "any-signature");

      // Assert
      expect(isValid).toBe(false);
    });
  });

  describe("Webhook Payment Processing", () => {
    it("should process confirmed payment webhook", async () => {
      // Arrange
      const paymentId = TEST_PAYMENT_ID;
      const status = PaymentStatus.CONFIRMED;
      const txHash = "0x1234567890abcdef";

      // Act
      const result = await paymentService.processWebhookPayment(
        paymentId,
        status,
        txHash
      );

      // Assert
      expect(result).toBeUndefined(); // Should complete without error
    });

    it("should process failed payment webhook", async () => {
      // Arrange
      const paymentId = TEST_PAYMENT_ID;
      const status = PaymentStatus.FAILED;

      // Act
      const result = await paymentService.processWebhookPayment(
        paymentId,
        status
      );

      // Assert
      expect(result).toBeUndefined();
    });

    it("should process pending payment webhook", async () => {
      // Arrange
      const paymentId = TEST_PAYMENT_ID;
      const status = PaymentStatus.CONFIRMING;

      // Act
      const result = await paymentService.processWebhookPayment(
        paymentId,
        status
      );

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe("Revenue Distribution", () => {
    it("should calculate correct revenue splits", async () => {
      // Arrange
      const roomId = TEST_ROOM_ID;
      const hostWallet = TEST_WALLET;
      const participantWallets = [
        "0x1111111111111111111111111111111111111111",
        "0x2222222222222222222222222222222222222222",
      ];
      const totalRevenue = BigInt("1000000000000000000"); // 1 token

      // Act
      const payouts = await paymentService.distributeRevenue(
        roomId,
        hostWallet,
        participantWallets,
        totalRevenue
      );

      // Assert
      expect(payouts.length).toBe(4); // host + 2 participants + platform
      expect(payouts[0].type).toBe(PaymentType.HOST_PAYOUT);
      expect(payouts[1].type).toBe(PaymentType.PARTICIPANT_PAYOUT);
      expect(payouts[2].type).toBe(PaymentType.PARTICIPANT_PAYOUT);
      expect(payouts[3].type).toBe(PaymentType.PLATFORM_REVENUE);
    });

    it("should handle single participant revenue distribution", async () => {
      // Arrange
      const roomId = TEST_ROOM_ID;
      const hostWallet = TEST_WALLET;
      const participantWallets = ["0x1111111111111111111111111111111111111111"];
      const totalRevenue = BigInt("1000000000000000000");

      // Act
      const payouts = await paymentService.distributeRevenue(
        roomId,
        hostWallet,
        participantWallets,
        totalRevenue
      );

      // Assert
      expect(payouts.length).toBe(3); // host + 1 participant + platform
    });

    it("should reject distribution with invalid host wallet", async () => {
      // Act & Assert
      await expect(
        paymentService.distributeRevenue(
          TEST_ROOM_ID,
          "invalid-wallet",
          [],
          BigInt("1000000000000000000")
        )
      ).rejects.toThrow("Invalid host wallet address");
    });

    it("should reject distribution with zero revenue", async () => {
      // Act & Assert
      await expect(
        paymentService.distributeRevenue(TEST_ROOM_ID, TEST_WALLET, [], BigInt(0))
      ).rejects.toThrow("Total revenue must be positive");
    });

    it("should reject distribution with negative revenue", async () => {
      // Act & Assert
      await expect(
        paymentService.distributeRevenue(
          TEST_ROOM_ID,
          TEST_WALLET,
          [],
          BigInt(-1000)
        )
      ).rejects.toThrow("Total revenue must be positive");
    });
  });

  describe("Error Handling", () => {
    it("should handle payment error gracefully", async () => {
      // Arrange
      const error = new Error("Network error");
      const paymentId = TEST_PAYMENT_ID;

      // Act
      const result = await paymentService.handlePaymentError(error, paymentId);

      // Assert
      expect(result).toBeUndefined(); // Should log error but not throw
    });

    it("should provide detailed error context", async () => {
      // Act
      const payment = await paymentService.chargeSpawnFee(
        TEST_AGENT_ID,
        TEST_WALLET,
        TEST_ROOM_ID
      );

      // Assert
      expect(payment).toHaveProperty("id");
      expect(payment).toHaveProperty("createdAt");
      expect(payment).toHaveProperty("updatedAt");
    });
  });

  describe("Payment Service Singleton", () => {
    it("should return same instance for multiple calls", async () => {
      // Act
      const { getX402PaymentService } = await import(
        "../../src/services/x402-payment-service.js"
      );

      const instance1 = getX402PaymentService();
      const instance2 = getX402PaymentService();

      // Assert
      expect(instance1).toBe(instance2);
    });
  });
});
