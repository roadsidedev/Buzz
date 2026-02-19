// @ts-nocheck
/**
 * Redis-Backed Rate Limiting Store
 *
 * Replaces in-memory store with distributed Redis store
 * Benefits:
 * - Shared state across multiple app instances (clustering support)
 * - Prevents memory exhaustion attacks
 * - Persistent across container restarts
 * - Works with load balancers
 *
 * Uses Redis INCR and EXPIRE commands for atomic operations
 */

import { createClient, RedisClientType } from "redis";
import { logger } from "./logger.js";

export interface RateLimitStore {
  checkLimit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number }>;
  reset(key: string): Promise<void>;
}

/**
 * Redis-backed rate limit store
 * Uses atomic Redis operations for thread-safe counting
 */
export class RedisRateLimitStore implements RateLimitStore {
  private redis: RedisClientType | null = null;
  private isConnected: boolean = false;

  constructor(redisUrl: string = process.env.REDIS_URL || "redis://localhost:6379") {
    this.initializeRedis(redisUrl);
  }

  /**
   * Initialize Redis client
   */
  private async initializeRedis(redisUrl: string): Promise<void> {
    try {
      this.redis = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries: number) => {
            if (retries > 10) {
              logger.error("Redis reconnection failed after 10 attempts");
              return new Error("Max reconnection attempts exceeded");
            }
            return Math.min(retries * 50, 500);
          },
        },
      });

      this.redis.on("error", (err) => {
        logger.error("Redis client error", {
          error: err instanceof Error ? err.message : String(err),
        });
        this.isConnected = false;
      });

      this.redis.on("connect", () => {
        logger.info("Connected to Redis for rate limiting");
        this.isConnected = true;
      });

      this.redis.on("disconnect", () => {
        logger.warn("Disconnected from Redis");
        this.isConnected = false;
      });

      await this.redis.connect();
      this.isConnected = true;
    } catch (error) {
      logger.error("Failed to initialize Redis client", {
        error: error instanceof Error ? error.message : String(error),
      });
      this.isConnected = false;
    }
  }

  /**
   * Check if a key has exceeded its rate limit
   *
   * Uses Redis INCR for atomic incrementing and EXPIRE for key expiration
   * This ensures thread-safe counting across multiple processes
   *
   * @param key - Rate limit key (e.g., "agent:123", "ip:192.168.1.1")
   * @param limit - Maximum requests allowed in the window
   * @param windowSeconds - Time window in seconds
   * @returns Object with allowed status, remaining count, and reset time
   */
  async checkLimit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    // If Redis is not connected, allow the request but log warning
    if (!this.isConnected || !this.redis) {
      logger.warn("Redis not connected, allowing request (rate limiting degraded)");
      return {
        allowed: true,
        remaining: limit,
        resetAt: Date.now() + windowSeconds * 1000,
      };
    }

    try {
      const prefixedKey = `ratelimit:${key}`;
      const now = Date.now();

      // Atomic increment: INCR returns new count
      const count = await this.redis.incr(prefixedKey);

      // Set expiration on first request in window
      if (count === 1) {
        await this.redis.expire(prefixedKey, windowSeconds);
      }

      // Get TTL for reset time
      const ttl = await this.redis.ttl(prefixedKey);
      const resetAt = now + (ttl > 0 ? ttl * 1000 : windowSeconds * 1000);

      const allowed = count <= limit;
      const remaining = Math.max(0, limit - count);

      if (!allowed) {
        logger.warn("Rate limit exceeded", {
          key,
          count,
          limit,
          ttlSeconds: ttl,
        });
      }

      return { allowed, remaining, resetAt };
    } catch (error) {
      logger.error("Redis rate limit check failed", {
        key,
        error: error instanceof Error ? error.message : String(error),
      });

      // Allow request if Redis fails (degrade gracefully)
      return {
        allowed: true,
        remaining: limit,
        resetAt: Date.now() + windowSeconds * 1000,
      };
    }
  }

  /**
   * Reset rate limit for a key
   * @param key - Rate limit key
   */
  async reset(key: string): Promise<void> {
    if (!this.isConnected || !this.redis) {
      return;
    }

    try {
      const prefixedKey = `ratelimit:${key}`;
      await this.redis.del(prefixedKey);
      logger.debug("Rate limit reset", { key });
    } catch (error) {
      logger.warn("Failed to reset rate limit", {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Close Redis connection
   */
  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.disconnect();
      this.isConnected = false;
      logger.info("Redis client disconnected");
    }
  }

  /**
   * Get connection status
   */
  isHealthy(): boolean {
    return this.isConnected;
  }
}

/**
 * In-memory fallback store for development/testing
 * Used when Redis is not available
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private store = new Map<string, { count: number; expiresAt: number }>();
  private cleanupInterval: NodeJS.Timer | null = null;

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 1000);
  }

  async checkLimit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const now = Date.now();
    let entry = this.store.get(key);

    // Create new entry or reset if expired
    if (!entry || entry.expiresAt < now) {
      entry = {
        count: 0,
        expiresAt: now + windowSeconds * 1000,
      };
      this.store.set(key, entry);
    }

    entry.count++;

    const allowed = entry.count <= limit;
    const remaining = Math.max(0, limit - entry.count);

    if (!allowed) {
      logger.warn("Rate limit exceeded (memory store)", {
        key,
        count: entry.count,
        limit,
      });
    }

    return {
      allowed,
      remaining,
      resetAt: entry.expiresAt,
    };
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key);
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt < now) {
        this.store.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug("Memory rate limit store cleanup", { removed: cleaned });
    }
  }

  disconnect(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  isHealthy(): boolean {
    return true;
  }
}
