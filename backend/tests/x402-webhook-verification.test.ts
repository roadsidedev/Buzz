/**
 * Test: x402 Webhook Signature Verification
 *
 * This test verifies that webhook signatures are properly validated
 * to prevent forged payment confirmations.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "crypto";
import { getX402PaymentService } from "../src/services/x402-payment-service.js";
import { X402_CONFIG } from "../src/config/x402-config.js";

describe("x402 Webhook Signature Verification", () => {
  const originalEnv = process.env;
  let paymentService: ReturnType<typeof getX402PaymentService>;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.X402_WEBHOOK_SECRET = "test-webhook-secret-key-32-chars-long";
    process.env.ENABLE_WEBHOOKS = "true";
    paymentService = getX402PaymentService();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("verifyWebhookSignature", () => {
    it("should reject when webhook secret not configured", () => {
      delete process.env.X402_WEBHOOK_SECRET;

      expect(() =>
        paymentService.verifyWebhookSignature("test body", "signature"),
      ).toThrow(/WEBHOOK_SECRET_MISSING/);
    });

    it("should reject empty body", () => {
      const result = paymentService.verifyWebhookSignature("", "signature");
      expect(result).toBe(false);
    });

    it("should reject missing signature", () => {
      const result = paymentService.verifyWebhookSignature(
        '{"test": true}',
        "",
      );
      expect(result).toBe(false);
    });

    it("should reject invalid signature format", () => {
      const result = paymentService.verifyWebhookSignature(
        '{"test": true}',
        "not-hex-signature",
      );
      expect(result).toBe(false);
    });

    it("should reject tampered body", () => {
      const body = '{"paymentId": "123", "status": "confirmed"}';
      const correctSignature = crypto
        .createHmac("sha256", process.env.X402_WEBHOOK_SECRET!)
        .update(body, "utf8")
        .digest("hex");

      // Tamper with the body
      const tamperedBody = body.replace("confirmed", "failed");

      const result = paymentService.verifyWebhookSignature(
        tamperedBody,
        correctSignature,
      );
      expect(result).toBe(false);
    });

    it("should reject wrong signature", () => {
      const body = '{"paymentId": "123", "status": "confirmed"}';
      const wrongSignature = crypto
        .createHmac("sha256", "wrong-secret")
        .update(body, "utf8")
        .digest("hex");

      const result = paymentService.verifyWebhookSignature(
        body,
        wrongSignature,
      );
      expect(result).toBe(false);
    });

    it("should accept valid signature", () => {
      const body =
        '{"paymentId": "123", "status": "confirmed", "amount": "1000"}';
      const validSignature = crypto
        .createHmac("sha256", process.env.X402_WEBHOOK_SECRET!)
        .update(body, "utf8")
        .digest("hex");

      const result = paymentService.verifyWebhookSignature(
        body,
        validSignature,
      );
      expect(result).toBe(true);
    });

    it("should handle complex JSON body", () => {
      const body = JSON.stringify({
        paymentId: "uuid-123",
        status: "confirmed",
        txHash: "0xabc123",
        blockNumber: 12345,
        metadata: {
          agentId: "agent-456",
          roomId: "room-789",
        },
      });

      const validSignature = crypto
        .createHmac("sha256", process.env.X402_WEBHOOK_SECRET!)
        .update(body, "utf8")
        .digest("hex");

      const result = paymentService.verifyWebhookSignature(
        body,
        validSignature,
      );
      expect(result).toBe(true);
    });

    it("should be case-insensitive for hex signature", () => {
      const body = '{"test": true}';
      const signature = crypto
        .createHmac("sha256", process.env.X402_WEBHOOK_SECRET!)
        .update(body, "utf8")
        .digest("hex");

      // Test uppercase
      const resultUpper = paymentService.verifyWebhookSignature(
        body,
        signature.toUpperCase(),
      );
      expect(resultUpper).toBe(true);

      // Test lowercase
      const resultLower = paymentService.verifyWebhookSignature(
        body,
        signature.toLowerCase(),
      );
      expect(resultLower).toBe(true);
    });
  });

  describe("Security Features", () => {
    it("should use timing-safe comparison", () => {
      const body = '{"paymentId": "123"}';
      const validSignature = crypto
        .createHmac("sha256", process.env.X402_WEBHOOK_SECRET!)
        .update(body, "utf8")
        .digest("hex");

      // Measure time for valid signature
      const start1 = process.hrtime.bigint();
      paymentService.verifyWebhookSignature(body, validSignature);
      const time1 = process.hrtime.bigint() - start1;

      // Measure time for invalid signature
      const invalidSignature = validSignature.slice(0, -1) + "0";
      const start2 = process.hrtime.bigint();
      paymentService.verifyWebhookSignature(body, invalidSignature);
      const time2 = process.hrtime.bigint() - start2;

      // Times should be similar (within 2x factor) for timing-safe comparison
      const ratio = Number(time2) / Number(time1);
      expect(ratio).toBeGreaterThan(0.5);
      expect(ratio).toBeLessThan(2.0);
    });

    it("should reject when webhooks disabled", () => {
      process.env.ENABLE_WEBHOOKS = "false";

      const body = '{"test": true}';
      const signature = crypto
        .createHmac("sha256", process.env.X402_WEBHOOK_SECRET!)
        .update(body, "utf8")
        .digest("hex");

      const result = paymentService.verifyWebhookSignature(body, signature);
      expect(result).toBe(false);
    });
  });
});

/**
 * Test Results Summary:
 *
 * ✅ Fixed: Webhook Signature Verification Disabled (Issue #3)
 *
 * Before Fix:
 * - All webhook signatures accepted without verification
 * - Method returned true for any input
 * - No HMAC validation
 * - Open to payment forgery attacks
 *
 * After Fix:
 * - Proper HMAC-SHA256 signature verification
 * - Timing-safe comparison prevents timing attacks
 * - Validates webhook secret is configured
 * - Rejects empty bodies and missing signatures
 * - Validates signature format (hex)
 * - Case-insensitive hex signature handling
 * - Respects ENABLE_WEBHOOKS flag
 *
 * Security Improvements:
 * - Prevents forged payment webhooks
 * - Timing attack protection via crypto.timingSafeEqual
 * - Input validation (body, signature format)
 * - Configuration validation (webhook secret required)
 * - Comprehensive error logging
 *
 * Implementation Details:
 * - Uses crypto.createHmac with SHA256
 * - Requires X402_WEBHOOK_SECRET environment variable
 * - Validates signature is valid hex string
 * - Constant-time comparison to prevent timing attacks
 * - Logs security events for monitoring
 */
