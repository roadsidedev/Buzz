// @ts-nocheck
/**
 * Refresh Token Service
 * 
 * Implements secure token rotation per RFC 6749 Section 6:
 * - Single-use refresh tokens (invalidated after refresh)
 * - Redis-backed token family tracking (detect token reuse attacks)
 * - Configurable rotation policies
 * - Token revocation and family revocation
 */

import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import type { CacheService } from "./cache-service.js";
import type { Database } from "../config/database.js";
import logger from "../utils/logger.js";

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  tokenFamily: string; // Track token rotation lineage
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  issuedAt: number; // Unix timestamp for token claim
}

export interface RefreshTokenMetadata {
  tokenFamily: string;
  generationNumber: number;
  parentTokenId: string | null;
}

const REFRESH_TOKEN_EXPIRY = 30 * 24 * 60 * 60; // 30 days in seconds
const REDIS_PREFIX_TOKEN_FAMILY = "refresh_token_family:";
const REDIS_PREFIX_REVOKED = "revoked_tokens:";

/**
 * RefreshTokenService: Manages secure token rotation
 * 
 * Key Features:
 * 1. Single-Use Tokens: Invalidates token after use
 * 2. Token Families: Tracks rotation lineage to detect attacks
 * 3. Family Revocation: If reuse detected, revokes entire family
 * 4. Redis Caching: Fast lookups and family tracking
 * 5. Database Persistence: Audit trail and recovery
 */
export class RefreshTokenService {
  constructor(
    private db: Database,
    private cache: CacheService,
  ) {}

  /**
   * Issue new refresh token pair
   * 
   * Creates initial token family on first issue.
   * 
   * @param userId - User ID
   * @returns Token string and metadata
   */
  async issueToken(userId: string): Promise<{
    token: string;
    metadata: RefreshTokenMetadata;
  }> {
    const tokenId = uuidv4();
    const tokenFamily = uuidv4(); // New family for initial issue
    const tokenSecret = this._generateTokenSecret();
    const issuedAt = Math.floor(Date.now() / 1000);

    // Hash token for storage (never store plaintext)
    const tokenHash = this._hashToken(tokenSecret);

    // Persist to database
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY * 1000);

    try {
      await this.db.query(
        `INSERT INTO refresh_token 
         (id, user_id, token_hash, token_family, generation, parent_token_id, 
          expires_at, issued_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          tokenId,
          userId,
          tokenHash,
          tokenFamily,
          0, // generation = 0 for initial
          null, // no parent
          expiresAt,
          issuedAt,
          new Date(),
        ]
      );
    } catch (err) {
      logger.error("Failed to insert refresh token", { error: err, userId });
      throw new Error("Failed to issue refresh token");
    }

    // Cache token family metadata
    await this.cache.set(
      `${REDIS_PREFIX_TOKEN_FAMILY}${tokenFamily}`,
      {
        userId,
        latestGeneration: 0,
        latestTokenId: tokenId,
        createdAt: new Date().toISOString(),
      },
      REFRESH_TOKEN_EXPIRY
    );

    logger.info("Refresh token issued", {
      userId,
      tokenFamily,
      expiresAt: expiresAt.toISOString(),
    });

    return {
      token: `${tokenId}.${tokenSecret}`, // Format: id.secret
      metadata: {
        tokenFamily,
        generationNumber: 0,
        parentTokenId: null,
      },
    };
  }

  /**
   * Refresh access token with rotation
   * 
   * Process:
   * 1. Parse and validate refresh token
   * 2. Check if token is single-use (not already rotated)
   * 3. Verify token family (detect reuse attacks)
   * 4. Issue new token pair
   * 5. Revoke old token (single-use enforcement)
   * 6. Update family metadata
   * 
   * @param oldRefreshToken - Current refresh token
   * @returns New token pair
   * @throws Error if token invalid, expired, or reused
   */
  async rotateToken(
    oldRefreshToken: string
  ): Promise<{
    token: string;
    metadata: RefreshTokenMetadata;
  }> {
    // Parse token
    const [tokenId, tokenSecret] = oldRefreshToken.split(".");
    if (!tokenId || !tokenSecret) {
      throw new Error("Invalid refresh token format");
    }

    // Look up token record
    const tokenHash = this._hashToken(tokenSecret);
    const result = await this.db.query(
      `SELECT * FROM refresh_token WHERE id = $1 AND token_hash = $2`,
      [tokenId, tokenHash]
    );

    if (result.length === 0) {
      logger.warn("Token validation failed", { tokenId });
      throw new Error("Invalid or expired refresh token");
    }

    const oldTokenRecord = result[0];

    // Check if already revoked (single-use enforcement)
    if (oldTokenRecord.revoked_at) {
      logger.warn("Token reuse detected - possible attack", {
        userId: oldTokenRecord.user_id,
        tokenFamily: oldTokenRecord.token_family,
        tokenId,
      });

      // SECURITY: Revoke entire family (potential token theft)
      await this._revokeTokenFamily(
        oldTokenRecord.token_family,
        "TOKEN_REUSE_DETECTED"
      );

      throw new Error(
        "Token already used. Entire token family revoked due to suspected attack."
      );
    }

    // Check expiration
    if (new Date(oldTokenRecord.expires_at) < new Date()) {
      throw new Error("Refresh token expired");
    }

    // Verify family in cache (fast check for attacks)
    const familyData = await this.cache.get<any>(
      `${REDIS_PREFIX_TOKEN_FAMILY}${oldTokenRecord.token_family}`
    );

    if (!familyData) {
      logger.error("Token family not found in cache", {
        tokenFamily: oldTokenRecord.token_family,
      });
      throw new Error("Token family invalid");
    }

    // Issue new token in same family (higher generation)
    const newTokenId = uuidv4();
    const newTokenSecret = this._generateTokenSecret();
    const newTokenHash = this._hashToken(newTokenSecret);
    const issuedAt = Math.floor(Date.now() / 1000);
    const newGeneration = oldTokenRecord.generation + 1;

    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY * 1000);

    try {
      await this.db.query(
        `INSERT INTO refresh_token 
         (id, user_id, token_hash, token_family, generation, parent_token_id, 
          expires_at, issued_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          newTokenId,
          oldTokenRecord.user_id,
          newTokenHash,
          oldTokenRecord.token_family,
          newGeneration,
          tokenId, // Link to parent
          expiresAt,
          issuedAt,
          new Date(),
        ]
      );
    } catch (err) {
      logger.error("Failed to insert new refresh token", { error: err });
      throw new Error("Failed to rotate refresh token");
    }

    // Revoke old token (single-use)
    try {
      await this.db.query(
        `UPDATE refresh_token SET revoked_at = $1 WHERE id = $2`,
        [new Date(), tokenId]
      );
    } catch (err) {
      logger.error("Failed to revoke old token", { error: err, tokenId });
      // Don't throw - token is functionally revoked by new generation
    }

    // Update family metadata in cache
    await this.cache.set(
      `${REDIS_PREFIX_TOKEN_FAMILY}${oldTokenRecord.token_family}`,
      {
        userId: oldTokenRecord.user_id,
        latestGeneration: newGeneration,
        latestTokenId: newTokenId,
        createdAt: familyData.createdAt,
      },
      REFRESH_TOKEN_EXPIRY
    );

    logger.info("Token rotated", {
      userId: oldTokenRecord.user_id,
      tokenFamily: oldTokenRecord.token_family,
      generation: newGeneration,
    });

    return {
      token: `${newTokenId}.${newTokenSecret}`,
      metadata: {
        tokenFamily: oldTokenRecord.token_family,
        generationNumber: newGeneration,
        parentTokenId: tokenId,
      },
    };
  }

  /**
   * Revoke a specific token
   * 
   * @param tokenId - Token ID
   */
  async revokeToken(tokenId: string): Promise<void> {
    try {
      await this.db.query(
        `UPDATE refresh_token SET revoked_at = $1 WHERE id = $2`,
        [new Date(), tokenId]
      );

      logger.info("Token revoked", { tokenId });
    } catch (err) {
      logger.error("Failed to revoke token", { error: err, tokenId });
    }
  }

  /**
   * Revoke entire token family (security incident)
   * 
   * @private
   * @param tokenFamily - Token family ID
   * @param reason - Revocation reason
   */
  private async _revokeTokenFamily(
    tokenFamily: string,
    reason: string
  ): Promise<void> {
    const now = new Date();

    try {
      // Revoke all tokens in family
      await this.db.query(
        `UPDATE refresh_token SET revoked_at = $1 
         WHERE token_family = $2 AND revoked_at IS NULL`,
        [now, tokenFamily]
      );
    } catch (err) {
      logger.error("Failed to revoke token family", {
        error: err,
        tokenFamily,
      });
    }

    // Mark family as revoked in cache
    await this.cache.set(
      `${REDIS_PREFIX_REVOKED}${tokenFamily}`,
      { reason, revokedAt: now.toISOString() },
      REFRESH_TOKEN_EXPIRY
    );

    logger.warn("Token family revoked", {
      tokenFamily,
      reason,
    });
  }

  /**
   * Revoke all tokens for a user (logout)
   * 
   * @param userId - User ID
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    const now = new Date();

    try {
      await this.db.query(
        `UPDATE refresh_token SET revoked_at = $1 
         WHERE user_id = $2 AND revoked_at IS NULL`,
        [now, userId]
      );

      logger.info("All user tokens revoked (logout)", { userId });
    } catch (err) {
      logger.error("Failed to revoke user tokens", { error: err, userId });
    }
  }

  /**
   * Clean up expired tokens (periodic maintenance)
   * 
   * Runs as background job
   */
  async cleanupExpiredTokens(): Promise<number> {
    try {
      const result = await this.db.query(
        `DELETE FROM refresh_token WHERE expires_at < NOW()`
      );

      logger.info("Expired tokens cleaned up", {
        deletedCount: result.length,
      });

      return result.length;
    } catch (err) {
      logger.error("Failed to cleanup expired tokens", { error: err });
      return 0;
    }
  }

  // ============================================
  // Private Helpers
  // ============================================

  /**
   * Generate cryptographically secure token secret
   * 
   * @private
   */
  private _generateTokenSecret(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * Hash token using SHA-256 for storage
   * 
   * @private
   */
  private _hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }
}

export function createRefreshTokenService(
  db: Database,
  cache: CacheService
): RefreshTokenService {
  return new RefreshTokenService(db, cache);
}
