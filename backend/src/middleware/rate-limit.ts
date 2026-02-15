/**
 * Rate Limiting Middleware
 * Per-agent request rate limiting using Redis
 */

import { Request, Response, NextFunction } from "express";
import { RateLimitError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyGenerator?: (req: Request) => string;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store for rate limiting (TODO: replace with Redis in production)
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Create rate limit middleware
 */
export function createRateLimiter(config: RateLimitConfig) {
  const { windowMs, maxRequests } = config;

  const keyGenerator =
    config.keyGenerator ||
    ((req: Request) => {
      // Rate limit by agent ID if authenticated, otherwise by IP
      return req.agent?.agentId || req.ip || "unknown";
    });

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyGenerator(req);
    const now = Date.now();

    let entry = rateLimitStore.get(key);

    // Initialize or reset entry if window has passed
    if (!entry || entry.resetAt < now) {
      entry = {
        count: 0,
        resetAt: now + windowMs,
      };
      rateLimitStore.set(key, entry);
    }

    entry.count++;

    // Set rate limit headers
    const remainingRequests = Math.max(0, maxRequests - entry.count);
    const resetTime = Math.ceil((entry.resetAt - now) / 1000);

    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader("X-RateLimit-Remaining", remainingRequests);
    res.setHeader("X-RateLimit-Reset", resetTime);

    if (entry.count > maxRequests) {
      logger.warn("Rate limit exceeded", {
        key,
        count: entry.count,
        limit: maxRequests,
      });

      throw new RateLimitError(
        `Too many requests. Try again in ${resetTime} seconds.`,
        resetTime,
        { remainingRequests, resetTime }
      );
    }

    next();
  };
}

/**
 * Per-endpoint rate limiters
 */

// Auth endpoints: 5 requests per 15 minutes
export const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 5,
});

// Room creation: 10 rooms per hour per agent
export const roomCreationLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 10,
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
 * Clean up old entries periodically (prevent memory leak)
 */
export function startRateLimitCleanup(intervalMs: number = 60 * 1000): void {
  setInterval(() => {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetAt < now) {
        rateLimitStore.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug("Rate limit store cleanup", { removed: cleaned });
    }
  }, intervalMs);
}
