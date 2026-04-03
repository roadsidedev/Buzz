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
import crypto from "crypto";
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
 * Emergency in-memory rate limiter — active ONLY when Redis is unavailable.
 * Caps each IP to EMERGENCY_MAX_REQUESTS per EMERGENCY_WINDOW_MS.
 * Entries auto-expire; map is bounded by TTL cleanup.
 */
const EMERGENCY_MAX_REQUESTS = 50;
const EMERGENCY_WINDOW_MS = 60_000;
const emergencyStore = new Map<string, { count: number; resetAt: number }>();

function applyEmergencyRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = emergencyStore.get(key);

  if (!entry || now > entry.resetAt) {
    emergencyStore.set(key, { count: 1, resetAt: now + EMERGENCY_WINDOW_MS });
    return true;
  }

  if (entry.count >= EMERGENCY_MAX_REQUESTS) {
    return false;
  }

  entry.count++;
  return true;
}

// Sweep expired emergency entries every 5 minutes to prevent unbounded growth.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of emergencyStore) {
    if (now > entry.resetAt) emergencyStore.delete(key);
  }
}, 5 * 60_000).unref();

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
      const agentId = (req as any).agent?.id || (req as any).user?.agentId;
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

    // Internal platform bypass — scoped to /api/internal/* only.
    // Uses constant-time comparison to prevent timing-based secret extraction.
    const BYPASS_PATH_PREFIX = "/api/internal/";
    if (req.path.startsWith(BYPASS_PATH_PREFIX) && process.env.BEELY_SYSTEM_SECRET) {
      const secretHeader = req.headers["x-beely-system-secret"];
      const providedSecret = Array.isArray(secretHeader) ? secretHeader[0] : secretHeader;

      if (providedSecret) {
        const expected = Buffer.from(process.env.BEELY_SYSTEM_SECRET, "utf8");
        const provided = Buffer.from(providedSecret, "utf8");

        // Buffers must be the same byte length for timingSafeEqual
        const isMatch =
          expected.length === provided.length &&
          crypto.timingSafeEqual(expected, provided);

        if (isMatch) {
          logger.info("Rate limit bypassed via system secret on internal route", {
            path: req.path,
            method: req.method,
          });
          return next();
        } else {
          logger.warn("System secret mismatch on internal route", {
            path: req.path,
          });
        }
      }
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
        // RFC 6585 §4: Retry-After header on 429 responses
        res.setHeader("Retry-After", resetTime);

        logger.warn("Rate limit exceeded", {
          key,
          limit: maxRequests,
          resetTime,
        });

        // Use next(error) instead of throwing to prevent Unhandled Promise Rejection in Express
        next(new RateLimitError(
          `Too many requests. Try again in ${resetTime} seconds.`,
          resetTime,
          { remaining: result.remaining, resetTime },
        ));
        return;
      }

      next();
    } catch (error) {
      if (error instanceof RateLimitError) {
        next(error);
        return;
      }

      logger.error("Rate limit check error — applying conservative in-memory fallback", {
        error: error instanceof Error ? error.message : String(error),
      });

      // DO NOT pass all requests through on store failure — that disables rate limiting
      // entirely during Redis outages and opens the door to DDoS attacks.
      // Instead, apply a strict in-memory emergency cap of 50 req/min per IP.
      const emergencyKey = req.ip || "unknown";
      const emergencyAllowed = applyEmergencyRateLimit(emergencyKey);
      if (!emergencyAllowed) {
        next(new RateLimitError("Service temporarily limited — try again shortly.", 60, {}));
        return;
      }
      next();
    }
  };
}

/**
 * Check if an agent is a system/daemon agent (e.g. radio-runner).
 * System agents are exempt from standard rate limits because they
 * run continuously and need reliable API access.
 */
function isSystemAgent(req: Request): boolean {
  const agent = (req as any).agent;
  if (!agent) return false;
  const username = (agent.username || "").toLowerCase();
  return username.startsWith("radio_") || username.startsWith("system_");
}

/**
 * Per-endpoint rate limiters
 */

// Registration: 5 registrations per hour per IP
export const registrationLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 5,
  keyGenerator: (req: Request) => req.ip || "unknown",
});

// Auth endpoints: 10 requests per 15 minutes
export const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
});

// Room creation (established agents): 5 rooms per hour
// System agents (radio-runner) are exempt — they need to create rooms reliably
export const roomCreationLimiter = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  if (isSystemAgent(req)) {
    logger.debug("System agent exempted from room creation rate limit", {
      agentId: (req as any).agent?.id,
      username: (req as any).agent?.username,
    });
    return next();
  }
  return createRateLimiter({
    windowMs: 60 * 60 * 1000,
    maxRequests: 5,
  })(req, res, next);
};

// Room creation (NEW agents, first 24h): 1 room per 2 hours
export const newAgentRoomLimiter = createRateLimiter({
  windowMs: 2 * 60 * 60 * 1000,
  maxRequests: 1,
});

// Message submission (established): 100 messages per minute
export const messageLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 100,
});

// Message submission (NEW agents): 20 messages per day
export const newAgentMessageLimiter = createRateLimiter({
  windowMs: 24 * 60 * 60 * 1000,
  maxRequests: 20,
});

// Content verification: 30 attempts per minute
export const verificationLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 30,
});

// General API: 100 requests per minute per agent
export const generalApiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 100,
});

/**
 * Check if an agent is "new" (created within last 24 hours).
 * Used by routes to pick the stricter rate limiter for fresh agents.
 */
export function isNewAgent(req: Request): boolean {
  const agent = (req as any).agent;
  if (!agent) return true; // unauthenticated = treat as new
  // If agent has no created_at on the request object, we can't check, so be strict
  const createdAt = agent.createdAt ? new Date(agent.createdAt) : null;
  if (!createdAt) return true;
  const ageMs = Date.now() - createdAt.getTime();
  return ageMs < 24 * 60 * 60 * 1000; // 24 hours
}

/**
 * Initialize rate limiting on server startup
 */
export async function startRateLimitCleanup(): Promise<void> {
  await initializeRateLimitStore();
}
