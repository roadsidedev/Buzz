/**
 * TURN Credentials Integration Tests
 *
 * Tests for time-limited TURN server credentials generation.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  generateTurnCredentials,
  validateTurnCredentials,
  createIceServerConfig,
  shouldRefreshCredentials,
  IceServer,
  TurnCredentials,
} from "../../src/utils/turn-credentials.js";

describe("TURN Credentials", () => {
  const testSecret = "test-turn-secret-key-12345";
  const testRealm = "clawhouse.test";

  describe("generateTurnCredentials", () => {
    it("should generate valid TURN credentials", () => {
      const credentials = generateTurnCredentials(testSecret, "test-user");

      expect(credentials.username).toBeDefined();
      expect(credentials.credential).toBeDefined();
      expect(credentials.ttl).toBeGreaterThan(0);
      expect(credentials.expiresAt).toBeGreaterThan(Date.now());
    });

    it("should generate username with timestamp format", () => {
      const credentials = generateTurnCredentials(testSecret, "test-user");

      const [timestamp] = credentials.username.split(":");
      const timestampNum = parseInt(timestamp, 10);

      expect(timestampNum).toBeGreaterThan(0);
      expect(timestampNum).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it("should generate consistent credentials for same inputs", () => {
      const cred1 = generateTurnCredentials(testSecret, "user1", 3600);
      const cred2 = generateTurnCredentials(testSecret, "user1", 3600);

      expect(cred1.username).toBe(cred2.username);
      expect(cred1.credential).toBe(cred2.credential);
    });

    it("should generate different credentials for different identifiers", () => {
      const cred1 = generateTurnCredentials(testSecret, "user1");
      const cred2 = generateTurnCredentials(testSecret, "user2");

      expect(cred1.username).not.toBe(cred2.username);
    });

    it("should throw error if secret is empty", () => {
      expect(() => generateTurnCredentials("", "user")).toThrow(
        "COTURN_SECRET is required",
      );
    });

    it("should use custom TTL", () => {
      const customTtl = 7200;
      const credentials = generateTurnCredentials(
        testSecret,
        "user",
        customTtl,
      );

      expect(credentials.ttl).toBe(customTtl);
    });
  });

  describe("validateTurnCredentials", () => {
    it("should validate correct credentials", () => {
      const credentials = generateTurnCredentials(testSecret, "user");

      const result = validateTurnCredentials(
        credentials.username,
        credentials.credential,
        testSecret,
      );

      expect(result.valid).toBe(true);
    });

    it("should reject invalid credential", () => {
      const credentials = generateTurnCredentials(testSecret, "user");

      const result = validateTurnCredentials(
        credentials.username,
        "invalid-credential",
        testSecret,
      );

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid credential");
    });

    it("should reject wrong secret", () => {
      const credentials = generateTurnCredentials(testSecret, "user");

      const result = validateTurnCredentials(
        credentials.username,
        credentials.credential,
        "wrong-secret",
      );

      expect(result.valid).toBe(false);
    });

    it("should reject expired credentials", async () => {
      // Generate credentials with very short TTL
      const credentials = generateTurnCredentials(testSecret, "user", 1);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const result = validateTurnCredentials(
        credentials.username,
        credentials.credential,
        testSecret,
      );

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Credentials expired");
    });

    it("should reject invalid username format", () => {
      const result = validateTurnCredentials(
        "invalid",
        "credential",
        testSecret,
      );

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid username format");
    });
  });

  describe("createIceServerConfig", () => {
    it("should create ICE server config with STUN only if no TURN secret", () => {
      const config = createIceServerConfig({
        stunUrl: "stun:localhost:3478",
      });

      expect(config.iceServers).toHaveLength(1);
      expect(config.iceServers[0].urls).toBe("stun:localhost:3478");
      expect(config.credentials).toBeNull();
    });

    it("should create ICE server config with TURN when secret provided", () => {
      const config = createIceServerConfig({
        stunUrl: "stun:localhost:3478",
        turnUrl: "turn:localhost:3478",
        turnSecret: testSecret,
        turnRealm: testRealm,
      });

      expect(config.iceServers.length).toBeGreaterThanOrEqual(2);
      expect(config.credentials).not.toBeNull();
      expect(config.credentials?.username).toBeDefined();
      expect(config.credentials?.credential).toBeDefined();
    });

    it("should include multiple TURN URLs", () => {
      const config = createIceServerConfig({
        turnUrl: "turn:localhost:3478",
        turnSecret: testSecret,
      });

      const turnServer = config.iceServers.find((s) => s.username);
      expect(turnServer).toBeDefined();
      expect(Array.isArray(turnServer?.urls)).toBe(true);
    });

    it("should use custom identifier for credentials", () => {
      const config1 = createIceServerConfig({
        turnUrl: "turn:localhost:3478",
        turnSecret: testSecret,
        identifier: "user1",
      });

      const config2 = createIceServerConfig({
        turnUrl: "turn:localhost:3478",
        turnSecret: testSecret,
        identifier: "user2",
      });

      expect(config1.credentials?.username).not.toBe(
        config2.credentials?.username,
      );
    });
  });

  describe("shouldRefreshCredentials", () => {
    it("should return true for credentials near expiration", () => {
      const credentials: TurnCredentials = {
        username: "12345:user",
        credential: "abc123",
        ttl: 3600,
        expiresAt: Date.now() + 100000, // 100 seconds from now
      };

      expect(shouldRefreshCredentials(credentials, 300000)).toBe(true);
    });

    it("should return false for fresh credentials", () => {
      const credentials: TurnCredentials = {
        username: "12345:user",
        credential: "abc123",
        ttl: 3600,
        expiresAt: Date.now() + 7200000, // 2 hours from now
      };

      expect(shouldRefreshCredentials(credentials, 300000)).toBe(false);
    });

    it("should use default threshold of 5 minutes", () => {
      const credentials: TurnCredentials = {
        username: "12345:user",
        credential: "abc123",
        ttl: 3600,
        expiresAt: Date.now() + 240000, // 4 minutes from now
      };

      expect(shouldRefreshCredentials(credentials)).toBe(true);
    });
  });
});
