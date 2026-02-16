/**
 * HTTP-Only Cookies Middleware
 *
 * Secure token storage in httpOnly cookies instead of localStorage
 * Benefits:
 * - Protected from XSS attacks (JS cannot access httpOnly cookies)
 * - Sent automatically with requests (no manual header injection needed)
 * - Can be cleared server-side on logout
 *
 * @see https://owasp.org/www-community/attacks/xss/
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
 */

import { Request, Response, NextFunction } from "express";

/**
 * Cookie options for secure token storage
 */
export const tokenCookieOptions = {
  // Security flags
  httpOnly: true, // Prevent JavaScript access (XSS protection)
  secure: process.env.NODE_ENV === "production", // HTTPS only in production
  sameSite: "strict" as const, // Prevent CSRF attacks

  // Expiry
  maxAge: 3600 * 1000, // 1 hour for access token
};

export const refreshTokenCookieOptions = {
  // Security flags
  httpOnly: true, // Prevent JavaScript access
  secure: process.env.NODE_ENV === "production", // HTTPS only in production
  sameSite: "strict" as const, // Prevent CSRF attacks

  // Expiry
  maxAge: 7 * 24 * 3600 * 1000, // 7 days for refresh token

  // Optional: separate path to reduce exposure
  path: "/api/v1/auth/refresh",
};

/**
 * Set access token in httpOnly cookie
 *
 * @param res - Express response object
 * @param token - JWT token to store
 * @param expiresIn - Token expiry in seconds
 *
 * Example:
 * ```typescript
 * const token = jwt.sign(payload, secret, { expiresIn: "1h" });
 * setAccessTokenCookie(res, token, 3600);
 * ```
 */
export function setAccessTokenCookie(
  res: Response,
  token: string,
  expiresIn: number
): void {
  const options = {
    ...tokenCookieOptions,
    maxAge: expiresIn * 1000, // Convert seconds to milliseconds
  };

  res.cookie("accessToken", token, options);
}

/**
 * Set refresh token in httpOnly cookie
 *
 * Refresh tokens are stored separately with longer expiry
 * and restricted path for better security
 *
 * @param res - Express response object
 * @param token - JWT refresh token to store
 * @param expiresIn - Token expiry in seconds
 */
export function setRefreshTokenCookie(
  res: Response,
  token: string,
  expiresIn: number
): void {
  const options = {
    ...refreshTokenCookieOptions,
    maxAge: expiresIn * 1000, // Convert seconds to milliseconds
  };

  res.cookie("refreshToken", token, options);
}

/**
 * Clear all auth cookies on logout
 *
 * @param res - Express response object
 */
export function clearAuthCookies(res: Response): void {
  res.clearCookie("accessToken", { httpOnly: true, sameSite: "strict" });
  res.clearCookie("refreshToken", { httpOnly: true, sameSite: "strict", path: "/api/v1/auth/refresh" });
}

/**
 * Extract tokens from cookies (called by auth middleware)
 *
 * Express doesn't parse cookies by default; use cookie-parser middleware
 * @see https://expressjs.com/en/resources/middleware/cookie-parser.html
 *
 * @param req - Express request object (must have req.cookies populated)
 * @returns { accessToken, refreshToken } or null if not present
 */
export function extractTokensFromCookies(
  req: Request
): { accessToken?: string; refreshToken?: string } | null {
  const cookies = req.cookies || {};

  return {
    accessToken: cookies.accessToken,
    refreshToken: cookies.refreshToken,
  };
}

/**
 * Middleware to extract tokens from cookies
 * Adds to req.tokens for use in auth middleware
 *
 * Must be used after cookie-parser middleware
 */
export function cookieTokenExtractor(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const tokens = extractTokensFromCookies(req);

  // Add to request object for auth middleware
  (req as any).tokens = tokens;

  next();
}

/**
 * Fallback: Allow tokens in Authorization header for API clients
 * (Some clients like mobile apps can't use cookies)
 *
 * Authorization header takes precedence over cookies if both present
 */
export function extractTokenFromHeader(req: Request): string | null {
  const authHeader = req.get("Authorization");

  if (!authHeader) {
    return null;
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

/**
 * Combined token extractor: cookies first, then Authorization header
 *
 * @param req - Express request object
 * @returns Extracted token or null
 */
export function extractToken(req: Request): string | null {
  const cookies = extractTokensFromCookies(req);

  // Prefer header token (more secure for API clients)
  const headerToken = extractTokenFromHeader(req);
  if (headerToken) {
    return headerToken;
  }

  // Fall back to cookie token
  if (cookies?.accessToken) {
    return cookies.accessToken;
  }

  return null;
}

/**
 * Phase 5: Token Rotation
 *
 * For enhanced security, refresh tokens should be rotated on each use:
 * 1. Client sends refresh token
 * 2. Server validates and issues new access token + new refresh token
 * 3. Old refresh token is invalidated
 * 4. Prevents token theft: if attacker uses stolen token, legitimate user's token becomes invalid
 *
 * Implementation approach:
 * - Store refresh token version in database
 * - Increment version on each refresh
 * - Accept only latest version
 * - Detect token reuse (potential breach)
 */
export interface RefreshTokenPayload {
  userId: string;
  version: number; // Token version for rotation detection
  iat: number; // Issued at
  exp: number; // Expiration
}

/**
 * SameSite Cookie Protection Details
 *
 * SameSite has 3 levels:
 * - "Strict": Cookie only sent to same-site requests (safest, may break legitimate flows)
 * - "Lax": Cookie sent in top-level navigation (default in modern browsers)
 * - "None": Cookie sent everywhere (only with Secure flag for HTTPS)
 *
 * For ClawZz:
 * - Access Token: SameSite=Strict (API calls only)
 * - Refresh Token: SameSite=Strict with restricted path (refresh endpoint only)
 *
 * This prevents CSRF attacks where attacker tricks user into making request
 * that would automatically include their authentication cookie.
 */
