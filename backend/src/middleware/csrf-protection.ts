/**
 * CSRF (Cross-Site Request Forgery) Protection Middleware
 *
 * Prevents attackers from tricking authenticated users into making
 * unintended state-changing requests (POST, PUT, DELETE).
 *
 * Implementation:
 * 1. GET /api/csrf-token - Returns CSRF token to client
 * 2. Client must send token in X-CSRF-Token header for state-changing requests
 * 3. Server validates token matches session
 *
 * @see https://owasp.org/www-community/attacks/csrf
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
 */

import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { logger } from "../utils/logger.js";
import { SecurityError } from "../utils/errors.js";

/**
 * CSRF token store (in-memory for MVP, use Redis in production)
 * Structure: Map<sessionId, { token, createdAt }>
 */
const csrfTokenStore = new Map<
  string,
  { token: string; createdAt: number; agentId?: string }
>();

const CSRF_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const CSRF_HEADER_NAME = "X-CSRF-Token";
const CSRF_COOKIE_NAME = "X-CSRF-Token";

/**
 * Generate a cryptographically secure CSRF token
 */
function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Get or create CSRF token for a session
 *
 * @param sessionId - Unique session identifier (e.g., user ID, session cookie)
 * @returns CSRF token
 */
export function getCsrfToken(sessionId: string, agentId?: string): string {
  const existing = csrfTokenStore.get(sessionId);
  const now = Date.now();

  // Return existing token if still valid
  if (
    existing &&
    now - existing.createdAt < CSRF_TOKEN_EXPIRY_MS
  ) {
    return existing.token;
  }

  // Generate new token
  const token = generateCsrfToken();
  csrfTokenStore.set(sessionId, {
    token,
    createdAt: now,
    agentId,
  });

  logger.debug("CSRF token generated", {
    sessionId,
    agentId,
    expiresIn: CSRF_TOKEN_EXPIRY_MS / 1000,
  });

  return token;
}

/**
 * Validate CSRF token from request
 *
 * Checks both:
 * 1. X-CSRF-Token header (double-submit pattern)
 * 2. Stored token in server-side store
 *
 * @param sessionId - Session identifier
 * @param providedToken - Token from request header
 * @returns true if valid, false otherwise
 */
export function validateCsrfToken(
  sessionId: string,
  providedToken: string | undefined
): boolean {
  if (!providedToken) {
    logger.warn("CSRF token missing from request", { sessionId });
    return false;
  }

  const stored = csrfTokenStore.get(sessionId);
  if (!stored) {
    logger.warn("CSRF token not found in store", { sessionId });
    return false;
  }

  const now = Date.now();
  if (now - stored.createdAt > CSRF_TOKEN_EXPIRY_MS) {
    logger.warn("CSRF token expired", { sessionId });
    csrfTokenStore.delete(sessionId);
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  const match = crypto.timingSafeEqual(
    Buffer.from(stored.token),
    Buffer.from(providedToken)
  );

  if (!match) {
    logger.warn("CSRF token mismatch", { sessionId });
  }

  return match;
}

/**
 * CSRF Token Endpoint Middleware
 * GET /api/csrf-token - Endpoint to retrieve CSRF token
 *
 * Client calls this before making state-changing requests
 * to get a fresh CSRF token.
 */
export function csrfTokenEndpoint(req: Request, res: Response): void {
  // Session ID can be:
  // 1. Agent ID (if authenticated)
  // 2. Session cookie (if available)
  // 3. Generate new session for unauthenticated users
  const sessionId = (req as any).agentId || (req as any).sessionId || crypto.randomUUID();

  const token = getCsrfToken(sessionId, (req as any).agentId);

  // Set token in httpOnly cookie as well (double-submit pattern)
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // Allow JavaScript to read for header submission
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: CSRF_TOKEN_EXPIRY_MS,
  });

  logger.debug("CSRF token issued", {
    sessionId,
    agentId: (req as any).agentId,
  });

  res.json({
    success: true,
    data: {
      token,
      expiresIn: CSRF_TOKEN_EXPIRY_MS / 1000,
    },
  });
}

/**
 * CSRF Protection Middleware
 *
 * Apply to all state-changing routes (POST, PUT, DELETE, PATCH)
 *
 * Usage:
 * ```typescript
 * router.post("/api/rooms", csrfProtection, createRoomHandler);
 * router.put("/api/rooms/:id", csrfProtection, updateRoomHandler);
 * ```
 */
export function csrfProtection(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Skip CSRF check for safe methods (GET, HEAD, OPTIONS)
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  const sessionId = (req as any).agentId || (req as any).sessionId;
  if (!sessionId) {
    logger.warn("CSRF check skipped: no session ID", { path: req.path });
    return next();
  }

  // Get token from request header (primary)
  const tokenFromHeader = req.get(CSRF_HEADER_NAME);

  // Also check cookie (double-submit pattern)
  const tokenFromCookie = (req as any).cookies?.[CSRF_COOKIE_NAME];

  // Use header token if available, fall back to cookie
  const providedToken = tokenFromHeader || tokenFromCookie;

  if (!validateCsrfToken(sessionId, providedToken)) {
    logger.error("CSRF validation failed", {
      sessionId,
      path: req.path,
      method: req.method,
      hasHeader: !!tokenFromHeader,
      hasCookie: !!tokenFromCookie,
    });

    throw new SecurityError("CSRF token invalid or missing", {
      code: "CSRF_VALIDATION_FAILED",
      provided: !!providedToken,
      sessionId,
    });
  }

  logger.debug("CSRF validation passed", {
    sessionId,
    path: req.path,
    method: req.method,
  });

  next();
}

/**
 * Cleanup expired tokens periodically
 *
 * Prevents memory leak from storing old CSRF tokens
 */
export function startCsrfCleanup(intervalMs: number = 60 * 60 * 1000): void {
  setInterval(() => {
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, entry] of csrfTokenStore.entries()) {
      if (now - entry.createdAt > CSRF_TOKEN_EXPIRY_MS) {
        csrfTokenStore.delete(sessionId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug("CSRF token cleanup", { removed: cleaned });
    }
  }, intervalMs);
}

/**
 * Phase 5: Redis-backed CSRF Token Store
 *
 * For production, replace in-memory store with Redis:
 * ```typescript
 * async function getCsrfToken(sessionId: string): Promise<string> {
 *   const key = `csrf:${sessionId}`;
 *   let token = await redis.get(key);
 *
 *   if (!token) {
 *     token = generateCsrfToken();
 *     await redis.setex(key, CSRF_TOKEN_EXPIRY_MS / 1000, token);
 *   }
 *
 *   return token;
 * }
 * ```
 *
 * Benefits:
 * - Survives server restarts
 * - Scales across multiple servers
 * - Easy to revoke tokens
 */

/**
 * Alternative: Stateless CSRF Token
 *
 * For stateless APIs, use HMAC instead of storing tokens:
 * ```typescript
 * function generateStatelessCsrfToken(sessionId: string): string {
 *   const hmac = crypto.createHmac("sha256", CSRF_SECRET);
 *   const timestamp = Date.now().toString();
 *   hmac.update(`${sessionId}:${timestamp}`);
 *   return `${timestamp}:${hmac.digest("hex")}`;
 * }
 *
 * function validateStatelessCsrfToken(sessionId: string, token: string): boolean {
 *   const [timestamp, signature] = token.split(":");
 *   const expected = generateStatelessCsrfToken(sessionId);
 *   return crypto.timingSafeEqual(
 *     Buffer.from(signature),
 *     Buffer.from(expected.split(":")[1])
 *   );
 * }
 * ```
 *
 * Benefits:
 * - No server-side storage needed
 * - Scales infinitely
 * - Tokens can't be revoked (downside)
 */
