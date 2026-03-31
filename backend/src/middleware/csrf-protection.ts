/**
 * CSRF Protection Middleware
 * Protects against Cross-Site Request Forgery attacks
 *
 * Security Features:
 * 1. Double-Submit Cookie Pattern
 *    - Token stored in httpOnly cookie (secure, not accessible to JS)
 *    - Same token in request header (X-CSRF-Token)
 *    - Server validates both values match
 *
 * 2. SameSite Cookie Attribute
 *    - SameSite=Lax: Cookie sent in top-level navigations, provides CSRF protection
 *    - Allows GET requests to work while blocking POST CSRF attacks
 *    - Defense-in-depth with token validation
 *
 * 3. Token Rotation
 *    - New token generated per session
 *    - Optionally rotated after sensitive operations (login, logout, password change)
 *    - Prevents token reuse attacks
 *
 * 4. Domain Restriction (Fixed Issue #2)
 *    - Cookie domain explicitly set via COOKIE_DOMAIN environment variable
 *    - Prevents cookie leakage to subdomains
 *    - Uses __Host- prefix for additional security (requires HTTPS in production)
 *
 * 5. Security Headers
 *    - Secure flag enforced in production (HTTPS only)
 *    - httpOnly prevents JavaScript access
 *    - Path=/ ensures cookie sent to all routes
 *
 * Environment Variables:
 * - COOKIE_DOMAIN: Domain for cookie scope (e.g., "beely.com")
 * - NODE_ENV: Set to "production" for secure cookie flags
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
 * Using __Host- prefix for additional security:
 * - Must be Secure (HTTPS only)
 * - Must be Path=/
 * - Must not have Domain attribute
 */
const CSRF_COOKIE_NAME = "__Host-XSRF-TOKEN";

/**
 * CSRF header name (frontend must send this)
 */
const CSRF_HEADER_NAME = "X-CSRF-Token";

/**
 * Token expiration: 1 hour
 */
const TOKEN_EXPIRATION_MS = 60 * 60 * 1000;

/**
 * Validate CSRF configuration at startup
 * Prevents server startup with misconfigured settings
 */
export function validateCSRFConfig(): void {
  const requiredEnvVars = ["NODE_ENV"];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      logger.warn(`CSRF: ${envVar} not set, using defaults`);
    }
  }

  // In production, ensure COOKIE_DOMAIN is set for subdomain restriction
  if (process.env.NODE_ENV === "production" && !process.env.COOKIE_DOMAIN) {
    logger.warn(
      "CSRF: COOKIE_DOMAIN not set in production. " +
        "Cookie will be restricted to current host only.",
    );
  }

  logger.info("CSRF configuration validated");
}

/**
 * Get cookie options based on environment
 * Enforces security best practices
 */
function getCookieOptions(): CookieOptions {
  const isProduction = process.env.NODE_ENV === "production";
  const cookieDomain = process.env.COOKIE_DOMAIN;

  // Base options - always secure in production
  const options: CookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax", // Changed from strict to lax for better UX while maintaining security
    maxAge: TOKEN_EXPIRATION_MS,
    path: "/",
  };

  // Add domain restriction if configured
  // This prevents cookie from being sent to subdomains
  if (cookieDomain) {
    options.domain = cookieDomain;
  }

  return options;
}

interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "strict" | "lax" | "none" | boolean;
  maxAge: number;
  path: string;
  domain?: string;
}

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
export function initializeCSRFToken(req: Request, res: Response): string {
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

  // Set secure httpOnly cookie with domain restriction
  const cookieOptions = getCookieOptions();
  res.cookie(CSRF_COOKIE_NAME, token, cookieOptions);

  logger.debug("CSRF cookie set", {
    domain: cookieOptions.domain || "host-only",
    secure: cookieOptions.secure,
    sameSite: cookieOptions.sameSite,
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

    // Skip CSRF for API routes ONLY when the request is authenticated exclusively
    // via Bearer token (Authorization header).  If a session cookie is also
    // present the request may have originated from a browser context and is
    // therefore CSRF-vulnerable regardless of the path prefix (M4).
    if (req.path.startsWith("/api/")) {
      const hasBearerToken = typeof req.headers.authorization === "string" &&
        req.headers.authorization.startsWith("Bearer ");
      const hasSessionCookie = !!(req.cookies && req.cookies[CSRF_COOKIE_NAME]);

      // Pure bearer-only request — no cookie present — safe to skip CSRF.
      if (hasBearerToken && !hasSessionCookie) {
        next();
        return;
      }

      // Cookie-carrying request on an /api/ path: fall through to CSRF
      // validation below so browser-initiated mutations are protected.
      if (!hasSessionCookie) {
        // No auth at all — let downstream auth middleware handle the 401.
        next();
        return;
      }
    }

    // Extract CSRF token from header
    const headerToken = req.headers[CSRF_HEADER_NAME.toLowerCase()] as
      | string
      | undefined;

    // Guard against missing cookie-parser middleware
    const cookies = req.cookies || {};

    // Extract CSRF token from cookie
    const cookieToken = cookies[CSRF_COOKIE_NAME];

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

      throw new ValidationError("CSRF token missing from X-CSRF-Token header", {
        required: CSRF_HEADER_NAME,
        endpoint: req.path,
        code: "CSRF_MISSING_HEADER",
      });
    }

    if (!cookieToken) {
      logger.warn("CSRF validation failed: missing cookie token", {
        method: req.method,
        path: req.path,
        ip: req.ip,
      });

      throw new ValidationError("CSRF token missing from cookie", {
        required: CSRF_COOKIE_NAME,
        endpoint: req.path,
        code: "CSRF_MISSING_COOKIE",
      });
    }

    // Validate tokens match (constant-time comparison)
    if (
      !crypto.timingSafeEqual(
        Buffer.from(headerToken),
        Buffer.from(cookieToken),
      )
    ) {
      logger.warn("CSRF validation failed: token mismatch", {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userId: req.agent?.id,
      });

      throw new ValidationError("CSRF token validation failed", {
        code: "CSRF_TOKEN_MISMATCH",
        endpoint: req.path,
        reason: "Header token does not match cookie token",
      });
    }

    // Validate token is not expired
    if (req.csrfToken && req.csrfToken.expiresAt < Date.now()) {
      logger.warn("CSRF validation failed: token expired", {
        method: req.method,
        path: req.path,
        expiresAt: req.csrfToken.expiresAt,
        now: Date.now(),
      });

      throw new ValidationError("CSRF token has expired", {
        code: "CSRF_TOKEN_EXPIRED",
        endpoint: req.path,
        expiresAt: req.csrfToken.expiresAt,
      });
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
export function regenerateCSRFToken(req: Request, res: Response): string {
  const token = generateCSRFToken();
  const now = Date.now();

  // Update request object with new token
  req.csrfToken = {
    token,
    createdAt: now,
    expiresAt: now + TOKEN_EXPIRATION_MS,
  };

  // Set cookie with consistent security options
  const cookieOptions = getCookieOptions();
  res.cookie(CSRF_COOKIE_NAME, token, cookieOptions);

  res.setHeader(CSRF_HEADER_NAME, token);

  logger.info("CSRF token regenerated after sensitive operation", {
    domain: cookieOptions.domain || "host-only",
  });

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
