/**
 * CSRF Protection Middleware
 * Protects against Cross-Site Request Forgery attacks
 *
 * Strategy:
 * 1. Double-Submit Cookie Pattern
 *    - Token stored in httpOnly cookie (secure, not accessible to JS)
 *    - Same token in request header (X-CSRF-Token)
 *    - Server validates both values match
 *
 * 2. SameSite Cookie Attribute
 *    - SameSite=Strict: Cookie only sent in same-site requests
 *    - Browsers won't send cookie in cross-site requests
 *    - Defense-in-depth with token validation
 *
 * 3. Token Rotation
 *    - New token generated per session
 *    - Optionally rotated after sensitive operations
 *    - Prevents token reuse attacks
 */

import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { ValidationError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

/**
 * CSRF token metadata
 */
interface CSRFToken {
  token: string;
  createdAt: number;
  expiresAt: number;
}

/**
 * CSRF cookie name (must match frontend)
 */
const CSRF_COOKIE_NAME = "XSRF-TOKEN";

/**
 * CSRF header name (frontend must send this)
 */
const CSRF_HEADER_NAME = "X-CSRF-Token";

/**
 * Token expiration: 1 hour
 */
const TOKEN_EXPIRATION_MS = 60 * 60 * 1000;

/**
 * Generate a cryptographically secure CSRF token
 * Uses base64 URL-safe encoding for easy transmission
 *
 * @returns Generated CSRF token (32 bytes = 256 bits)
 */
export function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * Initialize CSRF protection for a session
 * Creates and stores a CSRF token in the response cookie
 *
 * Should be called for authenticated sessions
 * Sends both:
 * - httpOnly cookie (secure, not accessible to JavaScript)
 * - Response body (for SPA to read and send back in headers)
 *
 * @param req Express request object
 * @param res Express response object
 */
export function initializeCSRFToken(
  req: Request,
  res: Response,
): string {
  // Check if token already exists and is still valid
  if (req.csrfToken) {
    const now = Date.now();
    if (req.csrfToken.expiresAt > now) {
      // Token still valid, return it
      return req.csrfToken.token;
    }
  }

  // Generate new token
  const token = generateCSRFToken();
  const now = Date.now();

  // Store in request object for middleware access
  req.csrfToken = {
    token,
    createdAt: now,
    expiresAt: now + TOKEN_EXPIRATION_MS,
  };

  // Set secure httpOnly cookie
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: true, // Not accessible from JavaScript
    secure: process.env.NODE_ENV === "production", // HTTPS only in production
    sameSite: "strict", // Only send in same-site requests
    maxAge: TOKEN_EXPIRATION_MS, // 1 hour
    path: "/", // Cookie applies to entire app
  });

  logger.debug("CSRF token initialized", {
    expiresIn: TOKEN_EXPIRATION_MS / 1000,
  });

  return token;
}

/**
 * Middleware that provides CSRF token for safe requests
 * GET, HEAD, OPTIONS requests don't need CSRF protection
 * but we provide token for subsequent POST/PUT/DELETE requests
 *
 * Response includes:
 * - httpOnly cookie with token
 * - X-CSRF-Token header
 * - /api/csrf-token endpoint returns JSON
 *
 * @returns Express middleware
 */
export function csrfTokenProvider() {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Always ensure we have a CSRF token
    const token = initializeCSRFToken(req, res);

    // Add token to response headers
    res.setHeader(CSRF_HEADER_NAME, token);

    next();
  };
}

/**
 * Middleware that validates CSRF token on state-changing requests
 * Protects: POST, PUT, PATCH, DELETE requests
 *
 * Validation process:
 * 1. Extract token from X-CSRF-Token header
 * 2. Extract token from CSRF cookie
 * 3. Compare both values (must match exactly)
 * 4. Verify token is not expired
 * 5. Allow request or reject with 403
 *
 * @returns Express middleware
 */
export function validateCSRFToken() {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Safe methods don't need CSRF protection
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      next();
      return;
    }

    // Extract CSRF token from header
    const headerToken = req.headers[CSRF_HEADER_NAME.toLowerCase()] as string | undefined;

    // Extract CSRF token from cookie
    const cookieToken = req.cookies[CSRF_COOKIE_NAME];

    // Log for debugging
    logger.debug("CSRF validation attempt", {
      method: req.method,
      path: req.path,
      hasHeaderToken: !!headerToken,
      hasCookieToken: !!cookieToken,
    });

    // Validate both tokens are present
    if (!headerToken) {
      logger.warn("CSRF validation failed: missing header token", {
        method: req.method,
        path: req.path,
        ip: req.ip,
      });

      throw new ValidationError(
        "CSRF token missing from X-CSRF-Token header",
        {
          required: CSRF_HEADER_NAME,
          endpoint: req.path,
          code: "CSRF_MISSING_HEADER",
        },
      );
    }

    if (!cookieToken) {
      logger.warn("CSRF validation failed: missing cookie token", {
        method: req.method,
        path: req.path,
        ip: req.ip,
      });

      throw new ValidationError(
        "CSRF token missing from cookie",
        {
          required: CSRF_COOKIE_NAME,
          endpoint: req.path,
          code: "CSRF_MISSING_COOKIE",
        },
      );
    }

    // Validate tokens match (constant-time comparison)
    if (!crypto.timingSafeEqual(Buffer.from(headerToken), Buffer.from(cookieToken))) {
      logger.warn("CSRF validation failed: token mismatch", {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userId: req.agent?.agentId,
      });

      throw new ValidationError(
        "CSRF token validation failed",
        {
          code: "CSRF_TOKEN_MISMATCH",
          endpoint: req.path,
          reason: "Header token does not match cookie token",
        },
      );
    }

    // Validate token is not expired
    if (req.csrfToken && req.csrfToken.expiresAt < Date.now()) {
      logger.warn("CSRF validation failed: token expired", {
        method: req.method,
        path: req.path,
        expiresAt: req.csrfToken.expiresAt,
        now: Date.now(),
      });

      throw new ValidationError(
        "CSRF token has expired",
        {
          code: "CSRF_TOKEN_EXPIRED",
          endpoint: req.path,
          expiresAt: req.csrfToken.expiresAt,
        },
      );
    }

    logger.debug("CSRF validation passed", {
      method: req.method,
      path: req.path,
    });

    next();
  };
}

/**
 * Regenerate CSRF token after sensitive operations
 * Recommended for: login, logout, password change, permission changes
 *
 * @param res Express response object
 * @returns New CSRF token
 */
export function regenerateCSRFToken(res: Response): string {
  const token = generateCSRFToken();
  const now = Date.now();

  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: TOKEN_EXPIRATION_MS,
    path: "/",
  });

  res.setHeader(CSRF_HEADER_NAME, token);

  logger.info("CSRF token regenerated after sensitive operation");

  return token;
}

/**
 * Extend Express Request type to include CSRF token
 * (Type definition for TypeScript)
 */
declare global {
  namespace Express {
    interface Request {
      csrfToken?: CSRFToken;
    }
  }
}
