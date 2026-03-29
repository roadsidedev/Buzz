/**
 * Cache Service
 * Wrapper around Redis for caching with TTL management and health checks
 */

import { createClient, RedisClientType } from "redis";
import { logger } from "../utils/logger.js";

export interface CacheHealthStatus {
  status: "healthy" | "unhealthy";
  latency: number;
  memory?: {
    used: number;
    peak: number;
  };
  connected: boolean;
}

/**
 * CacheService: Redis-backed caching layer
 *
 * Provides:
 * - Key-value storage with TTL
 * - Cache invalidation
 * - Health monitoring
 * - Graceful degradation on failure
 */
export class CacheService {
  private client: RedisClientType | null = null;
  private initialized = false;

  constructor(private redisUrl: string = "redis://redis:6379") {}

  /**
   * Initialize Redis connection
   * Safe to call multiple times
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.client = createClient({
        url: this.redisUrl,
      });

      this.client.on("error", (err: Error) => {
        logger.error("Redis client error", { error: err });
      });

      this.client.on("connect", () => {
        logger.info("Redis connected");
      });

      await this.client.connect();
      this.initialized = true;
      logger.info("CacheService initialized", { url: this.redisUrl });
    } catch (err) {
      logger.error("Failed to initialize CacheService", { error: err });
      // Don't throw - allow graceful degradation
      this.initialized = true;
    }
  }

  /**
   * Get a value from cache
   * Returns null if not found or error occurs
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.client) return null;

    try {
      const value = await this.client.get(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (err) {
      logger.warn("Cache get failed", { key, error: err });
      return null;
    }
  }

  /**
   * Set a value in cache with TTL
   * Silently fails if Redis unavailable
   */
  async set<T>(key: string, value: T, ttl: number = 300): Promise<void> {
    if (!this.client) return;

    try {
      await this.client.setEx(key, ttl, JSON.stringify(value));
    } catch (err) {
      logger.warn("Cache set failed", { key, ttl, error: err });
    }
  }

  /**
   * Delete a key from cache
   */
  async delete(key: string): Promise<void> {
    if (!this.client) return;

    try {
      await this.client.del(key);
    } catch (err) {
      logger.warn("Cache delete failed", { key, error: err });
    }
  }

  /**
   * Delete multiple keys (pattern-based)
   * @param pattern - Redis key pattern (e.g., "trending:*")
   */
  async deletePattern(pattern: string): Promise<number> {
    if (!this.client) return 0;

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) return 0;
      return await this.client.del(keys);
    } catch (err) {
      logger.warn("Cache pattern delete failed", { pattern, error: err });
      return 0;
    }
  }

  /**
   * Clear all cache
   * Use with caution - mainly for testing
   */
  async clear(): Promise<void> {
    if (!this.client) return;

    try {
      await this.client.flushDb();
      logger.info("Cache cleared");
    } catch (err) {
      logger.warn("Cache clear failed", { error: err });
    }
  }

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    if (!this.client) return false;

    try {
      const exists = await this.client.exists(key);
      return exists === 1;
    } catch (err) {
      logger.warn("Cache exists check failed", { key, error: err });
      return false;
    }
  }

  /**
   * Get TTL of a key
   * Returns -1 if no expiry, -2 if not found, or TTL in seconds
   */
  async getTTL(key: string): Promise<number> {
    if (!this.client) return -2;

    try {
      return await this.client.ttl(key);
    } catch (err) {
      logger.warn("Cache TTL check failed", { key, error: err });
      return -2;
    }
  }

  /**
   * Health check endpoint
   * Returns connection status and basic metrics
   */
  async getHealth(): Promise<CacheHealthStatus> {
    if (!this.client) {
      return {
        status: "unhealthy",
        latency: 0,
        connected: false,
      };
    }

    try {
      const start = Date.now();
      await this.client.ping();
      const latency = Date.now() - start;

      // Try to get memory stats
      let memory: { used: number; peak: number } | undefined;
      try {
        const info = await this.client.info("memory");
        const lines = info.split("\r\n");
        const usedLine = lines.find((l: string) => l.startsWith("used_memory:"));
        const peakLine = lines.find((l: string) => l.startsWith("used_memory_peak:"));

        if (usedLine && peakLine) {
          const used = parseInt(usedLine.split(":")[1], 10);
          const peak = parseInt(peakLine.split(":")[1], 10);
          memory = { used, peak };
        }
      } catch {
        // Silently fail if we can't get memory stats
      }

      return {
        status: "healthy",
        latency,
        memory,
        connected: true,
      };
    } catch (err) {
      logger.error("Cache health check failed", { error: err });
      return {
        status: "unhealthy",
        latency: 0,
        connected: false,
      };
    }
  }

  /**
   * Expose underlying Redis client for modules that need direct Redis access
   * (e.g. RoomStateStore in the scoring module).
   * Returns null if Redis is unavailable.
   */
  getRedisClient(): RedisClientType | null {
    return this.client;
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (!this.client) return;

    try {
      await this.client.quit();
      this.initialized = false;
      logger.info("CacheService shutdown complete");
    } catch (err) {
      logger.error("Cache shutdown error", { error: err });
    }
  }
}

/**
 * Singleton instance
 */
let cacheService: CacheService | null = null;

/**
 * Factory: Get or create cache service
 */
export function getCacheService(
  redisUrl: string = process.env.REDIS_URL || "redis://redis:6379"
): CacheService {
  if (!cacheService) {
    cacheService = new CacheService(redisUrl);
  }
  return cacheService;
}

/**
 * Factory: Create fresh cache service (mainly for testing)
 */
export function createCacheService(
  redisUrl: string = process.env.REDIS_URL || "redis://redis:6379"
): CacheService {
  return new CacheService(redisUrl);
}
