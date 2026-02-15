/**
 * Authentication Middleware
 * 
 * Middleware for protecting routes and validating JWT tokens.
 * Extends Express Request type to include authenticated user payload.
 */

import { Request, Response, NextFunction } from "express";
import { AuthService } from "@/services/auth-service";
import { JWTPayload, InvalidTokenError } from "@/types/auth";
import logger from "@/utils/logger";
import { db } from "@/config/database";

/**
 * Extend Express Request to include authenticated user
 * 
 * This allows protected routes to access req.user
 */
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

const authService = new AuthService(db);

/**
 * Extract Bearer token from Authorization header
 * 
 * Expected format: "Bearer <token>"
 * 
 * @param req - Express request
 * @returns Token string or null if not present
 */
function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.substring(7); // Remove "Bearer " prefix
}

/**
 * Validate JWT token and attach user to request
 * 
 * Middleware that:
 * 1. Extracts Bearer token from Authorization header
 * 2. Validates JWT signature and expiration
 * 3. Attaches decoded payload to req.user
 * 4. Calls next() if valid
 * 5. Returns 401 if invalid/missing
 * 
 * Usage:
 * ```
 * // Protect all routes under /api/v1
 * app.use("/api/v1", validateJWT);
 * 
 * // Protect specific route
 * router.get("/protected", validateJWT, handler);
 * ```
 * 
 * @param req - Express request
 * @param res - Express response
 * @param next - Express next
 */
export const validateJWT = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const token = extractBearerToken(req);

    if (!token) {
      logger.warn("Missing authorization token", {
        path: req.path,
        method: req.method,
      });
      res.status(401).json({
        error: "No authorization token provided",
        code: "MISSING_TOKEN",
      });
      return;
    }

    // Validate and decode token
    const payload = authService.validateAccessToken(token);
    req.user = payload;

    logger.debug("Token validated", {
      userId: payload.sub,
      path: req.path,
      method: req.method,
    });

    next();
  } catch (err) {
    if (err instanceof InvalidTokenError) {
      logger.warn("Invalid token", {
        error: err.message,
        path: req.path,
      });
      res.status(401).json({
        error: err.message,
        code: err.code,
      });
    } else {
      logger.error("Auth validation failed", {
        error: err,
        path: req.path,
      });
      res.status(500).json({ error: "Internal server error" });
    }
  }
};

/**
 * Require specific role(s) for endpoint access
 * 
 * Middleware that restricts access to users with specific roles.
 * Must be used AFTER validateJWT middleware.
 * 
 * Usage:
 * ```
 * // Require admin role
 * router.delete("/users/:id", validateJWT, requireRole(["admin"]), handler);
 * 
 * // Require admin or moderator
 * router.post("/moderate", validateJWT, requireRole(["admin", "moderator"]), handler);
 * ```
 * 
 * @param allowedRoles - Array of roles that are allowed
 * @returns Middleware function
 */
export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Check if user is authenticated
    if (!req.user) {
      logger.warn("Unauthenticated access attempt", {
        path: req.path,
        method: req.method,
      });
      res.status(401).json({
        error: "Not authenticated",
        code: "UNAUTHENTICATED",
      });
      return;
    }

    // Check if user has required role
    if (!allowedRoles.includes(req.user.role)) {
      logger.warn("Unauthorized role access", {
        userId: req.user.sub,
        role: req.user.role,
        requiredRoles: allowedRoles,
        path: req.path,
      });
      res.status(403).json({
        error: "Insufficient permissions",
        code: "FORBIDDEN",
      });
      return;
    }

    logger.debug("Role authorized", {
      userId: req.user.sub,
      role: req.user.role,
      path: req.path,
    });

    next();
  };
};

/**
 * Optional authentication middleware
 * 
 * Attaches user to request if token present, but does NOT require it.
 * Useful for endpoints that work both authenticated and unauthenticated.
 * 
 * Usage:
 * ```
 * // Get public data (optionally personalized if authenticated)
 * router.get("/content", optionalAuth, handler);
 * ```
 * 
 * @param req - Express request
 * @param res - Express response
 * @param next - Express next
 */
export const optionalAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const token = extractBearerToken(req);

    if (token) {
      try {
        req.user = authService.validateAccessToken(token);
        logger.debug("Optional auth: user authenticated", {
          userId: req.user.sub,
        });
      } catch (err) {
        // Token invalid but that's okay - just continue without user
        logger.debug("Optional auth: invalid token ignored", {
          error: err,
        });
      }
    }

    next();
  } catch (err) {
    logger.error("Optional auth failed", { error: err });
    next();
  }
};
