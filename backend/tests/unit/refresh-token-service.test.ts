/**
 * Refresh Token Service Tests
 * 
 * Test coverage:
 * - Token issuance and format validation
 * - Token rotation with family tracking
 * - Single-use enforcement
 * - Token reuse detection and family revocation
 * - Expiration handling
 * - Edge cases and error handling
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { RefreshTokenService } from "@/services/refresh-token-service";
import type { CacheService } from "@/services/cache-service";
import type { Database } from "@/config/database";

describe("RefreshTokenService", () => {
  let service: RefreshTokenService;
  let mockDb: Database;
  let mockCache: CacheService;

  const testUserId = "user-123";
  const testTokenId = "token-456";
  const testTokenSecret = "a".repeat(64); // 32 bytes hex
  const testTokenFamily = "family-789";

  beforeEach(() => {
    // Mock database
    mockDb = {
      query: vi.fn(),
    } as any;

    // Mock cache service
    mockCache = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    } as any;

    service = new RefreshTokenService(mockDb, mockCache);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("issueToken", () => {
    it("should issue a new refresh token with valid format", async () => {
      const mockDbQuery = vi.mocked(mockDb.query);
      const mockCacheSet = vi.mocked(mockCache.set);

      mockDbQuery.mockResolvedValue([]);

      const result = await service.issueToken(testUserId);

      // Verify token format (id.secret)
      expect(result.token).toMatch(/^[a-f0-9-]+\.[a-f0-9]{64}$/);

      // Verify metadata
      expect(result.metadata).toEqual({
        tokenFamily: expect.any(String),
        generationNumber: 0,
        parentTokenId: null,
      });

      // Verify database insert was called
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO refresh_token"),
        expect.arrayContaining([
          expect.any(String), // tokenId
          testUserId,
          expect.any(String), // tokenHash
          expect.any(String), // tokenFamily
          0, // generation
          null, // parentTokenId
          expect.any(Date), // expiresAt
          expect.any(Number), // issuedAt
          expect.any(Date), // createdAt
        ])
      );

      // Verify cache was set
      expect(mockCacheSet).toHaveBeenCalledWith(
        expect.stringContaining("refresh_token_family:"),
        expect.objectContaining({
          userId: testUserId,
          latestGeneration: 0,
          latestTokenId: expect.any(String),
        }),
        expect.any(Number)
      );
    });

    it("should throw error on database failure", async () => {
      const mockDbQuery = vi.mocked(mockDb.query);
      mockDbQuery.mockRejectedValue(new Error("Database error"));

      await expect(service.issueToken(testUserId)).rejects.toThrow(
        "Failed to issue refresh token"
      );
    });
  });

  describe("rotateToken", () => {
    it("should rotate token and maintain family lineage", async () => {
      const oldToken = `${testTokenId}.${testTokenSecret}`;
      const mockDbQuery = vi.mocked(mockDb.query);
      const mockCacheGet = vi.mocked(mockCache.get);
      const mockCacheSet = vi.mocked(mockCache.set);

      // Mock database: find old token
      mockDbQuery.mockResolvedValueOnce([
        {
          id: testTokenId,
          user_id: testUserId,
          token_family: testTokenFamily,
          generation: 0,
          parent_token_id: null,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          revoked_at: null,
          created_at: new Date(),
        },
      ]);

      // Mock database: insert new token
      mockDbQuery.mockResolvedValueOnce([]);

      // Mock database: revoke old token
      mockDbQuery.mockResolvedValueOnce([]);

      // Mock cache: get family
      mockCacheGet.mockResolvedValue({
        userId: testUserId,
        latestGeneration: 0,
        createdAt: new Date().toISOString(),
      });

      const result = await service.rotateToken(oldToken);

      // Verify token format
      expect(result.token).toMatch(/^[a-f0-9-]+\.[a-f0-9]{64}$/);

      // Verify metadata shows new generation
      expect(result.metadata).toEqual({
        tokenFamily: testTokenFamily,
        generationNumber: 1,
        parentTokenId: testTokenId,
      });

      // Verify old token was revoked
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE refresh_token SET revoked_at"),
        [expect.any(Date), testTokenId]
      );
    });

    it("should detect token reuse and revoke family", async () => {
      const oldToken = `${testTokenId}.${testTokenSecret}`;
      const mockDbQuery = vi.mocked(mockDb.query);

      // Mock database: find already-revoked token
      mockDbQuery.mockResolvedValueOnce([
        {
          id: testTokenId,
          user_id: testUserId,
          token_family: testTokenFamily,
          generation: 0,
          revoked_at: new Date(), // Already revoked!
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          created_at: new Date(),
        },
      ]);

      // Mock database: revoke family
      mockDbQuery.mockResolvedValueOnce([]);

      await expect(service.rotateToken(oldToken)).rejects.toThrow(
        /Token already used/
      );

      // Verify entire family was revoked
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE refresh_token SET revoked_at"),
        expect.arrayContaining([
          expect.any(Date),
          testTokenFamily,
        ])
      );
    });

    it("should reject invalid token format", async () => {
      const invalidToken = "not-a-valid-token";

      await expect(service.rotateToken(invalidToken)).rejects.toThrow(
        "Invalid refresh token format"
      );
    });

    it("should reject expired token", async () => {
      const oldToken = `${testTokenId}.${testTokenSecret}`;
      const mockDbQuery = vi.mocked(mockDb.query);

      // Mock database: find expired token
      mockDbQuery.mockResolvedValueOnce([
        {
          id: testTokenId,
          user_id: testUserId,
          token_family: testTokenFamily,
          generation: 0,
          revoked_at: null,
          expires_at: new Date(Date.now() - 1000), // Expired!
          created_at: new Date(),
        },
      ]);

      await expect(service.rotateToken(oldToken)).rejects.toThrow(
        "Refresh token expired"
      );
    });

    it("should reject token not found", async () => {
      const oldToken = `${testTokenId}.${testTokenSecret}`;
      const mockDbQuery = vi.mocked(mockDb.query);

      // Mock database: token not found
      mockDbQuery.mockResolvedValueOnce([]);

      await expect(service.rotateToken(oldToken)).rejects.toThrow(
        "Invalid or expired refresh token"
      );
    });
  });

  describe("revokeAllUserTokens", () => {
    it("should revoke all active tokens for user", async () => {
      const mockDbQuery = vi.mocked(mockDb.query);
      mockDbQuery.mockResolvedValue([]);

      await service.revokeAllUserTokens(testUserId);

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE refresh_token SET revoked_at"),
        [expect.any(Date), testUserId]
      );
    });
  });

  describe("cleanupExpiredTokens", () => {
    it("should delete expired tokens", async () => {
      const mockDbQuery = vi.mocked(mockDb.query);
      mockDbQuery.mockResolvedValue([
        { id: "token-1" },
        { id: "token-2" },
      ]);

      const deleted = await service.cleanupExpiredTokens();

      expect(deleted).toBe(2);
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM refresh_token")
      );
    });
  });

  describe("Security Edge Cases", () => {
    it("should handle concurrent rotation attempts safely", async () => {
      const oldToken = `${testTokenId}.${testTokenSecret}`;
      const mockDbQuery = vi.mocked(mockDb.query);
      const mockCacheGet = vi.mocked(mockCache.get);

      // First call: token found
      mockDbQuery.mockResolvedValueOnce([
        {
          id: testTokenId,
          user_id: testUserId,
          token_family: testTokenFamily,
          generation: 0,
          revoked_at: null,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          created_at: new Date(),
        },
      ]);

      mockCacheGet.mockResolvedValue({
        userId: testUserId,
        latestGeneration: 0,
      });

      // Insert new token
      mockDbQuery.mockResolvedValueOnce([]);

      // Revoke old
      mockDbQuery.mockResolvedValueOnce([]);

      const result1 = await service.rotateToken(oldToken);
      expect(result1.token).toBeDefined();

      // Now try same old token again (should fail)
      mockDbQuery.mockResolvedValueOnce([
        {
          id: testTokenId,
          revoked_at: new Date(), // Now revoked
          user_id: testUserId,
          token_family: testTokenFamily,
          generation: 0,
        },
      ]);

      await expect(service.rotateToken(oldToken)).rejects.toThrow();
    });

    it("should maintain audit trail on token operations", async () => {
      const mockDbQuery = vi.mocked(mockDb.query);
      mockDbQuery.mockResolvedValue([]);

      await service.issueToken(testUserId);

      // Verify database call includes all audit fields
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining("issued_at"),
        expect.arrayContaining([
          expect.any(String), // id
          expect.any(String), // user_id
          expect.any(String), // token_hash
          expect.any(String), // token_family
          expect.any(Number), // generation
          null, // parent_token_id
          expect.any(Date), // expires_at
          expect.any(Number), // issued_at (timestamp)
          expect.any(Date), // created_at
        ])
      );
    });
  });
});
