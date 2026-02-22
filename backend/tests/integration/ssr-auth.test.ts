/**
 * SSR Auth Integration Tests
 *
 * Tests for Ed25519-based Simple Signed Records authentication.
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  generateKeypair,
  deriveKeypairFromERC8004,
  signPayload,
  verifySignature,
  createAuthToken,
  encryptPrivateKey,
  decryptPrivateKey,
  generateJamIdentityId,
  getAgentKeypair,
} from "../../src/utils/ssr-auth.js";

describe("SSR Auth", () => {
  describe("generateKeypair", () => {
    it("should generate a valid Ed25519 keypair", async () => {
      const keypair = await generateKeypair();

      expect(keypair.publicKey).toBeInstanceOf(Uint8Array);
      expect(keypair.privateKey).toBeInstanceOf(Uint8Array);
      expect(keypair.publicKey.length).toBe(32);
      expect(keypair.privateKey.length).toBe(32);
      expect(keypair.publicKeyBase64).toBeDefined();
      expect(keypair.privateKeyBase64).toBeDefined();
    });

    it("should generate unique keypairs", async () => {
      const keypair1 = await generateKeypair();
      const keypair2 = await generateKeypair();

      expect(keypair1.publicKeyBase64).not.toBe(keypair2.publicKeyBase64);
      expect(keypair1.privateKeyBase64).not.toBe(keypair2.privateKeyBase64);
    });
  });

  describe("deriveKeypairFromERC8004", () => {
    it("should derive deterministic keypair from ERC-8004 identity", async () => {
      const erc8004Identity = "0x1234567890abcdef1234567890abcdef12345678";
      const agentId = "agent-123";

      const keypair1 = await deriveKeypairFromERC8004(erc8004Identity, agentId);
      const keypair2 = await deriveKeypairFromERC8004(erc8004Identity, agentId);

      expect(keypair1.publicKeyBase64).toBe(keypair2.publicKeyBase64);
      expect(keypair1.privateKeyBase64).toBe(keypair2.privateKeyBase64);
    });

    it("should generate different keypairs for different agents", async () => {
      const erc8004Identity = "0x1234567890abcdef1234567890abcdef12345678";

      const keypair1 = await deriveKeypairFromERC8004(
        erc8004Identity,
        "agent-1",
      );
      const keypair2 = await deriveKeypairFromERC8004(
        erc8004Identity,
        "agent-2",
      );

      expect(keypair1.publicKeyBase64).not.toBe(keypair2.publicKeyBase64);
    });

    it("should generate different keypairs for different identities", async () => {
      const agentId = "agent-123";

      const keypair1 = await deriveKeypairFromERC8004(
        "0x1111111111111111111111111111111111111111",
        agentId,
      );
      const keypair2 = await deriveKeypairFromERC8004(
        "0x2222222222222222222222222222222222222222",
        agentId,
      );

      expect(keypair1.publicKeyBase64).not.toBe(keypair2.publicKeyBase64);
    });
  });

  describe("signPayload and verifySignature", () => {
    it("should sign and verify a payload", async () => {
      const keypair = await generateKeypair();
      const payload = { test: "data", timestamp: Date.now() };

      const signedRecord = await signPayload(keypair.privateKey, payload);

      expect(signedRecord.Certified).toBeDefined();
      expect(signedRecord.signatures).toHaveLength(1);
      expect(signedRecord.signatures[0].publicKey).toBe(
        keypair.publicKeyBase64,
      );

      const result = await verifySignature(signedRecord);

      expect(result.valid).toBe(true);
      expect(result.payload).toEqual(payload);
    });

    it("should fail verification with tampered payload", async () => {
      const keypair = await generateKeypair();
      const payload = { test: "data" };

      const signedRecord = await signPayload(keypair.privateKey, payload);

      // Tamper with the certified data
      signedRecord.Certified = Buffer.from(
        JSON.stringify({ hacked: true }),
      ).toString("base64");

      const result = await verifySignature(signedRecord);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should fail verification with wrong public key", async () => {
      const keypair1 = await generateKeypair();
      const keypair2 = await generateKeypair();
      const payload = { test: "data" };

      const signedRecord = await signPayload(keypair1.privateKey, payload);

      // Replace public key with different one
      signedRecord.signatures[0].publicKey = keypair2.publicKeyBase64;

      const result = await verifySignature(signedRecord);

      expect(result.valid).toBe(false);
    });
  });

  describe("createAuthToken", () => {
    it("should create a valid auth token for WebSocket connections", async () => {
      const keypair = await generateKeypair();

      const token = await createAuthToken(keypair);

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");

      // Token should be base64 encoded
      const decoded = JSON.parse(Buffer.from(token, "base64").toString());
      expect(decoded.Certified).toBeDefined();
      expect(decoded.signatures).toBeDefined();
    });
  });

  describe("encryptPrivateKey and decryptPrivateKey", () => {
    it("should encrypt and decrypt private key", async () => {
      const keypair = await generateKeypair();
      const encryptionSecret = "test-secret-key-12345678901234567890";

      const encrypted = encryptPrivateKey(
        keypair.privateKeyBase64,
        encryptionSecret,
      );

      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(keypair.privateKeyBase64);
      expect(encrypted.split(":")).toHaveLength(3); // iv:authTag:encrypted

      const decrypted = await decryptPrivateKey(encrypted, encryptionSecret);

      expect(decrypted).toBe(keypair.privateKeyBase64);
    });

    it("should fail decryption with wrong secret", async () => {
      const keypair = await generateKeypair();
      const encryptionSecret = "correct-secret-12345678901234567890";
      const wrongSecret = "wrong-secret-123456789012345678901";

      const encrypted = encryptPrivateKey(
        keypair.privateKeyBase64,
        encryptionSecret,
      );

      await expect(decryptPrivateKey(encrypted, wrongSecret)).rejects.toThrow();
    });
  });

  describe("generateJamIdentityId", () => {
    it("should generate consistent identity ID from public key", async () => {
      const keypair = await generateKeypair();

      const id1 = generateJamIdentityId(keypair.publicKeyBase64);
      const id2 = generateJamIdentityId(keypair.publicKeyBase64);

      expect(id1).toBe(id2);
      expect(id1.length).toBe(32);
    });

    it("should generate different IDs for different public keys", async () => {
      const keypair1 = await generateKeypair();
      const keypair2 = await generateKeypair();

      const id1 = generateJamIdentityId(keypair1.publicKeyBase64);
      const id2 = generateJamIdentityId(keypair2.publicKeyBase64);

      expect(id1).not.toBe(id2);
    });
  });

  describe("getAgentKeypair", () => {
    it("should derive keypair from ERC-8004 identity (primary)", async () => {
      const encryptionSecret = "test-secret-123456789012345678901234";

      const keypair = await getAgentKeypair({
        agentId: "agent-123",
        erc8004Identity: "0x1234567890abcdef1234567890abcdef12345678",
        encryptionSecret,
      });

      expect(keypair.publicKeyBase64).toBeDefined();
      expect(keypair.privateKeyBase64).toBeDefined();
    });

    it("should use stored keypair when no ERC-8004 identity (fallback)", async () => {
      const encryptionSecret = "test-secret-123456789012345678901234";
      const keypair = await generateKeypair();
      const encrypted = encryptPrivateKey(
        keypair.privateKeyBase64,
        encryptionSecret,
      );

      const retrievedKeypair = await getAgentKeypair({
        agentId: "agent-123",
        storedPublicKey: keypair.publicKeyBase64,
        storedPrivateKeyEncrypted: encrypted,
        encryptionSecret,
      });

      expect(retrievedKeypair.publicKeyBase64).toBe(keypair.publicKeyBase64);
      expect(retrievedKeypair.privateKeyBase64).toBe(keypair.privateKeyBase64);
    });

    it("should generate new keypair when neither available", async () => {
      const encryptionSecret = "test-secret-123456789012345678901234";

      const keypair = await getAgentKeypair({
        agentId: "agent-123",
        encryptionSecret,
      });

      expect(keypair.publicKeyBase64).toBeDefined();
      expect(keypair.privateKeyBase64).toBeDefined();
    });
  });
});
