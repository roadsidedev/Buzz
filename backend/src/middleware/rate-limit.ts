/**
 * Rate Limiting Middleware
 * Per-agent request rate limiting using Redis (with in-memory fallback)
 *
 * Production: Uses Redis for distributed rate limiting across multiple pods
 * Development: Falls back to in-memory store if Redis unavailable
 *
 * This ensures:
 * - Thread-safe counting across distributed systems
 * - Protection against memory exhaustion attacks
 * - Proper scaling in Kubernetes/clustered environments
 */

import { Request, Response, NextFunction } from "express";
import { RateLimitError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import {
  RedisRateLimitStore,
  MemoryRateLimitStore,
  RateLimitStore,
} from "../utils/redis-rate-limit-store.js";

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyGenerator?: (req: Request) => string;
}

// Initialize rate limit store
let rateLimitStore: RateLimitStore | null = null;

/**
 * Initialize the rate limit store
 * Tries Redis first, falls back to in-memory
 */
export async function initializeRateLimitStore(): Promise<void> {
  try {
    // Try to use Redis if available
    const redisStore = new RedisRateLimitStore(
      process.env.REDIS_URL || "redis://localhost:6379",
    );

    // Give Redis a moment to connect
    await new Promise((resolve) => setTimeout(resolve, 100));

    if (redisStore.isHealthy()) {
      rateLimitStore = redisStore;
      logger.info("Rate limiting initialized with Redis store");
      return;
    }
  } catch (error) {
    logger.warn(
      "Redis rate limit store initialization failed, using memory store",
      {
        error: error instanceof Error ? error.message : String(error),
      },
    );
  }

  // Fall back to in-memory store
  rateLimitStore = new MemoryRateLimitStore();
  logger.warn(
    "Using in-memory rate limit store. This will not work correctly in clustered environments. " +
      "Set REDIS_URL environment variable for production.",
  );
}

/**
 * Create rate limit middleware
 */
export function createRateLimiter(config: RateLimitConfig) {
  const { windowMs, maxRequests } = config;
  const windowSeconds = Math.floor(windowMs / 1000);

  const keyGenerator =
    config.keyGenerator ||
    ((req: Request) => {
      // Rate limit by agent ID if authenticated, otherwise by IP
      const agentId = (req as any).agent?.agentId || (req as any).user?.agentId;
      if (agentId) return String(agentId);
      return req.ip || "unknown";
    });

  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    if (!rateLimitStore) {
      logger.error("Rate limit store not initialized!");
      next();
      return;
    }

    try {
      const key = keyGenerator(req);
      const result = await rateLimitStore.checkLimit(
        key,
        maxRequests,
        windowSeconds,
      );

      const now = Date.now();
      const resetTime = Math.max(1, Math.ceil((result.resetAt - now) / 1000));

      // Set rate limit headers
      res.setHeader("X-RateLimit-Limit", maxRequests);
      res.setHeader("X-RateLimit-Remaining", result.remaining);
      res.setHeader("X-RateLimit-Reset", resetTime);

      if (!result.allowed) {
        logger.warn("Rate limit exceeded", {
          key,
          limit: maxRequests,
          resetTime,
        });

        throw new RateLimitError(
          `Too many requests. Try again in ${resetTime} seconds.`,
          resetTime,
          { remaining: result.remaining, resetTime },
        );
      }

      next();
    } catch (error) {
      if (error instanceof RateLimitError) {
        throw error;
      }

      logger.error("Rate limit check error", {
        error: error instanceof Error ? error.message : String(error),
      });

      // Allow request if rate limiting check fails (degrade gracefully)
      next();
    }
  };
}

/**
 * Per-endpoint rate limiters
 */

// Auth endpoints: 3 requests per 15 minutes (reduced for security)
export const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 3,
});

// Room creation: 5 rooms per hour per agent (spawn fee prevention)
export const roomCreationLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 5,
});

// Message submission: 100 messages per minute per agent
export const messageLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 100,
});

// General API: 1000 requests per minute per agent
export const generalApiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 1000,
});

/**
 * Initialize rate limiting on server startup
 */
export async function startRateLimitCleanup(): Promise<void> {
  await initializeRateLimitStore();
}
