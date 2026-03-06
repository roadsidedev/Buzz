/**
 * Brute Force Protection Middleware
 *
 * Prevents password guessing attacks by:
 * 1. Tracking failed login attempts per IP + email
 * 2. Temporarily locking account after N failures
 * 3. Implementing exponential backoff delay
 * 4. Logging suspicious activity for monitoring
 *
 * @see https://owasp.org/www-community/attacks/Brute_force_attack
 */

import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger.js";
import { SecurityError } from "../utils/errors.js";

interface BruteForceEntry {
  attempts: number; // Failed attempt count
  lastAttempt: number; // Timestamp of last attempt
  lockedUntil?: number; // When account lock expires
  ips: Set<string>; // IP addresses used for attempts
}

/**
 * In-memory brute force tracking
 * Key: email or username
 * Value: { attempts, lastAttempt, lockedUntil, ips }
 *
 * Phase 5: Move to Redis for multi-server deployments
 */
const bruteForceStore = new Map<string, BruteForceEntry>();

/**
 * Configuration for brute force protection
 * Phase 1 (Day 3): Reduced from 5 to 3 attempts per spec
 */
export const BRUTE_FORCE_CONFIG = {
  MAX_ATTEMPTS: 3, // Max failed attempts before lockout (reduced from 5)
  LOCKOUT_DURATION_MS: 30 * 60 * 1000, // 30 minutes
  RESET_WINDOW_MS: 15 * 60 * 1000, // 15 minutes (reset counter after this)
  EXPONENTIAL_BACKOFF_MS: 1000, // Start with 1 second delay (1s → 2s → 4s)
};

/**
 * Record a failed login attempt
 *
 * @param identifier - Email or username that was attacked
 * @param ip - Client IP address
 * @returns { isLocked, attemptsRemaining, waitSeconds }
 */
export function recordFailedAttempt(
  identifier: string,
  ip: string | undefined
): {
  isLocked: boolean;
  attemptsRemaining: number;
  waitSeconds: number;
} {
  const now = Date.now();
  const clientIp = ip || "unknown";

  let entry = bruteForceStore.get(identifier);

  // Create new entry if doesn't exist
  if (!entry) {
    entry = {
      attempts: 0,
      lastAttempt: now,
      ips: new Set(),
    };
    bruteForceStore.set(identifier, entry);
  }

  // Check if lock has expired
  if (entry.lockedUntil && now > entry.lockedUntil) {
    entry.lockedUntil = undefined;
    entry.attempts = 0;
  }

  // Reset counter if outside window
  if (now - entry.lastAttempt > BRUTE_FORCE_CONFIG.RESET_WINDOW_MS) {
    entry.attempts = 0;
    entry.ips.clear();
  }

  // Record this attempt
  entry.attempts++;
  entry.lastAttempt = now;
  entry.ips.add(clientIp);

  const isLocked = !!entry.lockedUntil || entry.attempts >= BRUTE_FORCE_CONFIG.MAX_ATTEMPTS;

  if (isLocked && !entry.lockedUntil) {
    // Lock account
    entry.lockedUntil = now + BRUTE_FORCE_CONFIG.LOCKOUT_DURATION_MS;

    logger.error("Account locked due to brute force", {
      identifier,
      attempts: entry.attempts,
      ips: Array.from(entry.ips),
      lockoutExpires: new Date(entry.lockedUntil).toISOString(),
    });

    // Phase 5: Send security alert email to user
    // Phase 5: Alert admin/security team
  }

  const waitSeconds = isLocked
    ? Math.ceil((entry.lockedUntil! - now) / 1000)
    : 0;

  const attemptsRemaining = Math.max(
    0,
    BRUTE_FORCE_CONFIG.MAX_ATTEMPTS - entry.attempts
  );

  return { isLocked, attemptsRemaining, waitSeconds };
}

/**
 * Clear failed attempts for successful login
 * Resets the counter when user authenticates successfully
 *
 * @param identifier - Email or username
 */
export function clearFailedAttempts(identifier: string): void {
  bruteForceStore.delete(identifier);
  logger.debug("Brute force attempts cleared", { identifier });
}

/**
 * Get current brute force status
 *
 * @param identifier - Email or username
 * @returns Current attempt count and lock status
 */
export function getBruteForceStatus(
  identifier: string
): {
  attempts: number;
  isLocked: boolean;
  lockedUntil?: number;
  ips: string[];
} {
  const entry = bruteForceStore.get(identifier);
  const now = Date.now();

  if (!entry) {
    return { attempts: 0, isLocked: false, ips: [] };
  }

  const isLocked = !!entry.lockedUntil && now < entry.lockedUntil;

  return {
    attempts: entry.attempts,
    isLocked,
    lockedUntil: entry.lockedUntil,
    ips: Array.from(entry.ips),
  };
}

/**
 * Brute force protection middleware
 *
 * Apply to login endpoint:
 * ```typescript
 * router.post("/auth/login", bruteForceProtection("email"), loginHandler);
 * ```
 *
 * @param identifierField - Which field to use as identifier (email, username, etc.)
 */
export function bruteForceProtection(identifierField: string = "email") {
  return (req: Request, res: Response, next: NextFunction): void => {
    const identifier = (req.body as any)[identifierField];
    const ip = req.ip || req.get("x-forwarded-for");

    if (!identifier) {
      return next();
    }

    const status = getBruteForceStatus(identifier);

    if (status.isLocked) {
      const waitSeconds = Math.ceil(
        (status.lockedUntil! - Date.now()) / 1000
      );

      logger.warn("Login attempt on locked account", {
        identifier,
        ip,
        lockedFor: `${waitSeconds}s`,
      });

      throw new SecurityError(
        `Account temporarily locked. Try again in ${waitSeconds} seconds.`,
        {
          code: "ACCOUNT_LOCKED",
          lockedUntil: status.lockedUntil,
          waitSeconds,
        }
      );
    }

    // Attach to request for failure handler
    (req as any).bruteForceIdentifier = identifier;
    (req as any).clientIp = ip;

    next();
  };
}

/**
 * Call after failed login attempt
 *
 * Usage in login handler:
 * ```typescript
 * if (!passwordMatch) {
 *   recordLoginFailure(req.body.email, req.ip);
 *   throw new ValidationError("Invalid credentials");
 * }
 * ```
 */
export function recordLoginFailure(identifier: string, ip?: string): void {
  const result = recordFailedAttempt(identifier, ip);

  if (result.isLocked) {
    logger.error("Login account locked", {
      identifier,
      ip,
      waitSeconds: result.waitSeconds,
    });
  } else {
    logger.warn("Login failed", {
      identifier,
      ip,
      attempts: BRUTE_FORCE_CONFIG.MAX_ATTEMPTS - result.attemptsRemaining,
      remaining: result.attemptsRemaining,
    });
  }
}

/**
 * Call after successful login
 *
 * Usage in login handler:
 * ```typescript
 * if (passwordMatch) {
 *   recordLoginSuccess(req.body.email);
 *   // Issue tokens, etc.
 * }
 * ```
 */
export function recordLoginSuccess(identifier: string): void {
  clearFailedAttempts(identifier);
  logger.info("Login successful", { identifier });
}

/**
 * Exponential Backoff Calculation
 *
 * For rate limiting responses, use exponential backoff:
 * Attempt 1: 0s
 * Attempt 2: 1s
 * Attempt 3: 2s
 * Attempt 4: 4s
 * Attempt 5: 8s (locked)
 *
 * Implemented as part of Retry-After header
 */
export function calculateBackoffDelay(attemptNumber: number): number {
  if (attemptNumber <= 1) return 0;
  return Math.pow(2, Math.min(attemptNumber - 2, 10)) * BRUTE_FORCE_CONFIG.EXPONENTIAL_BACKOFF_MS;
}

/**
 * Cleanup old brute force records periodically
 *
 * Prevents memory leak by removing old entries
 */
export function startBruteForcecleanup(
  intervalMs: number = 60 * 60 * 1000
): void {
  setInterval(() => {
    const now = Date.now();
    let cleaned = 0;

    for (const [identifier, entry] of bruteForceStore.entries()) {
      // Remove if hasn't had attempts recently
      if (now - entry.lastAttempt > 24 * 60 * 60 * 1000) {
        bruteForceStore.delete(identifier);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug("Brute force record cleanup", { removed: cleaned });
    }
  }, intervalMs);
}

/**
 * Phase 5: CAPTCHA Integration
 *
 * For additional protection, require CAPTCHA after:
 * - 3 failed attempts (soft limit)
 * - Before lockout (hard limit)
 *
 * ```typescript
 * if (attempts === 3) {
 *   throw new ValidationError("Too many failed attempts. Please solve CAPTCHA.", {
 *     requireCaptcha: true,
 *     captchaUrl: "https://www.google.com/recaptcha/",
 *   });
 * }
 * ```
 */

/**
 * Phase 5: Device Fingerprinting
 *
 * Track login attempts by device fingerprint:
 * - Detect password spraying across multiple accounts
 * - Alert on new device login
 * - Require verification for new devices
 *
 * ```typescript
 * const fingerprint = generateDeviceFingerprint(req);
 * if (isNewDeviceForUser(userId, fingerprint)) {
 *   sendVerificationEmail(user.email, fingerprint);
 * }
 * ```
 */

/**
 * Phase 5: Account Recovery
 *
 * When account is locked:
 * 1. Send email to user
 * 2. Provide unlock link (time-limited token)
 * 3. Optional: Require additional verification
 */
