/**
 * Login Attempt Service
 *
 * Tracks failed login attempts using Redis for distributed, persistent storage.
 * Phase 1 (Day 3): Redis-backed brute force tracking for clustering support.
 *
 * Features:
 * - Distributed tracking across multiple app instances
 * - Account lockout with exponential backoff
 * - Automatic unlock after timeout
 * - Per-IP and per-email tracking
 *
 * @see https://owasp.org/www-community/attacks/Brute_force_attack
 */

import { createClient, RedisClientType } from "redis";
import { logger } from "../utils/logger.js";

interface LoginAttemptRecord {
  attempts: number;
  lastAttempt: number;
  lockedUntil?: number;
  ips: string[];
}

/**
 * Login Attempt Service with Redis backend
 *
 * For Phase 5: Replace in-memory Map with this Redis-backed service
 */
export class LoginAttemptService {
  private redis: RedisClientType;
  private readonly keyPrefix = "login_attempt:";
  private readonly maxAttempts = 3;
  private readonly lockoutDurationMs = 30 * 60 * 1000; // 30 minutes
  private readonly resetWindowMs = 15 * 60 * 1000; // 15 minutes
  private readonly exponentialBackoffMs = 1000; // 1s base

  constructor() {
    this.redis = createClient({
      url: process.env.REDIS_URL || "redis://localhost:6379",
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 50, 500),
      },
    });

    this.redis.on("error", (err) => {
      logger.error("Redis client error in LoginAttemptService", {
        error: err.message,
      });
    });

    this.redis.on("connect", () => {
      logger.info("LoginAttemptService connected to Redis");
    });
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    if (!this.redis.isOpen) {
      await this.redis.connect();
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.redis.isOpen) {
      await this.redis.disconnect();
    }
  }

  /**
   * Record a failed login attempt
   *
   * @param identifier - Email or username
   * @param ip - Client IP address
   * @returns { isLocked, attemptsRemaining, waitSeconds }
   */
  async recordFailedAttempt(
    identifier: string,
    ip: string | undefined,
  ): Promise<{
    isLocked: boolean;
    attemptsRemaining: number;
    waitSeconds: number;
  }> {
    const key = `${this.keyPrefix}${identifier}`;
    const clientIp = ip || "unknown";
    const now = Date.now();

    try {
      // Get existing record
      const stored = await this.redis.get(key);
      let record: LoginAttemptRecord = stored
        ? JSON.parse(stored)
        : { attempts: 0, lastAttempt: now, ips: [] };

      // Check if lock has expired
      if (record.lockedUntil && now > record.lockedUntil) {
        record.lockedUntil = undefined;
        record.attempts = 0;
        record.ips = [];
      }

      // Reset counter if outside window
      if (now - record.lastAttempt > this.resetWindowMs) {
        record.attempts = 0;
        record.ips = [];
      }

      // Record this attempt
      record.attempts++;
      record.lastAttempt = now;
      if (!record.ips.includes(clientIp)) {
        record.ips.push(clientIp);
      }

      // Lock if threshold reached
      const isLocked =
        !!record.lockedUntil || record.attempts >= this.maxAttempts;
      if (isLocked && !record.lockedUntil) {
        record.lockedUntil = now + this.lockoutDurationMs;

        logger.error("Account locked due to brute force", {
          identifier,
          attempts: record.attempts,
          ips: record.ips,
          lockoutExpires: new Date(record.lockedUntil).toISOString(),
        });
      }

      // Store updated record (expire after 24 hours of inactivity)
      await this.redis.setEx(
        key,
        24 * 60 * 60, // 24 hours in seconds
        JSON.stringify(record),
      );

      const waitSeconds = isLocked
        ? Math.ceil((record.lockedUntil! - now) / 1000)
        : 0;

      const attemptsRemaining = Math.max(0, this.maxAttempts - record.attempts);

      return { isLocked, attemptsRemaining, waitSeconds };
    } catch (err) {
      logger.error("Error recording login attempt in Redis", {
        identifier,
        error: err instanceof Error ? err.message : String(err),
      });
      // Fail open: allow login to proceed if Redis is down
      return {
        isLocked: false,
        attemptsRemaining: this.maxAttempts,
        waitSeconds: 0,
      };
    }
  }

  /**
   * Clear failed attempts for successful login
   *
   * @param identifier - Email or username
   */
  async clearFailedAttempts(identifier: string): Promise<void> {
    const key = `${this.keyPrefix}${identifier}`;
    try {
      await this.redis.del(key);
      logger.debug("Login attempts cleared", { identifier });
    } catch (err) {
      logger.error("Error clearing login attempts", {
        identifier,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Get current brute force status
   *
   * @param identifier - Email or username
   * @returns Current attempt count and lock status
   */
  async getStatus(identifier: string): Promise<{
    attempts: number;
    isLocked: boolean;
    lockedUntil?: number;
    ips: string[];
  }> {
    const key = `${this.keyPrefix}${identifier}`;
    const now = Date.now();

    try {
      const stored = await this.redis.get(key);
      if (!stored) {
        return { attempts: 0, isLocked: false, ips: [] };
      }

      const record: LoginAttemptRecord = JSON.parse(stored);
      const isLocked = !!record.lockedUntil && now < record.lockedUntil;

      return {
        attempts: record.attempts,
        isLocked,
        lockedUntil: record.lockedUntil,
        ips: record.ips,
      };
    } catch (err) {
      logger.error("Error fetching login status from Redis", {
        identifier,
        error: err instanceof Error ? err.message : String(err),
      });
      return { attempts: 0, isLocked: false, ips: [] };
    }
  }

  /**
   * Calculate exponential backoff delay
   *
   * Attempt 1: 0s
   * Attempt 2: 1s
   * Attempt 3: 2s (locked)
   *
   * @param attemptNumber - The attempt number
   * @returns Delay in milliseconds
   */
  calculateBackoffDelay(attemptNumber: number): number {
    if (attemptNumber <= 1) return 0;
    return (
      Math.pow(2, Math.min(attemptNumber - 2, 10)) * this.exponentialBackoffMs
    );
  }
}

// Singleton instance
let serviceInstance: LoginAttemptService | null = null;

/**
 * Get or create singleton instance
 */
export function getLoginAttemptService(): LoginAttemptService {
  if (!serviceInstance) {
    serviceInstance = new LoginAttemptService();
  }
  return serviceInstance;
}

/**
 * Initialize the service (connect to Redis)
 */
export async function initializeLoginAttemptService(): Promise<void> {
  const service = getLoginAttemptService();
  try {
    await service.connect();
    logger.info("LoginAttemptService initialized successfully");
  } catch (err) {
    logger.warn("Failed to initialize LoginAttemptService, will continue", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
