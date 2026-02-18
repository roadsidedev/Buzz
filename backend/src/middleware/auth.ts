/**
 * Authentication Middleware
 * 
 * Middleware for protecting routes and validating JWT tokens.
 * Extends Express Request type to include authenticated user payload.
 */

import { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth-service.js";
import { JWTPayload, InvalidTokenError } from "../types/auth.js";
import { logger } from "../utils/logger.js";
import { extractToken } from "./http-only-cookies.js";

/**
 * Extend Express Request to include authenticated user
 */
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

// Injected via factory or singleton
const authService = new AuthService();

/**
 * Validate JWT token and attach user to request
 * 
 * Middleware that:
 * 1. Extracts token from __Host-accessToken cookie or Authorization header
 * 2. Validates JWT signature and expiration
 * 3. Attaches decoded payload to req.user
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
    const token = extractToken(req);

    if (!token) {
      logger.warn("Missing authorization token", {
        path: req.path,
        method: req.method,
      });
      res.status(401).json({
        success: false,
        error: {
          code: "MISSING_TOKEN",
          message: "No authorization token provided",
          statusCode: 401,
        },
      });
      return;
    }

    // Validate and decode token
    const payload = authService.validateAccessToken(token);
    req.user = payload;

    logger.debug("Token validated", {
      userId: payload.agentId,
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
        success: false,
        error: {
          code: err.code,
          message: err.message,
          statusCode: 401,
        },
      });
    } else {
      logger.error("Auth validation failed", {
        error: err instanceof Error ? err.message : String(err),
        path: req.path,
      });
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Authentication validation failed",
          statusCode: 500,
        },
      });
    }
  }
};

/**
 * Optional authentication middleware
 */
export const optionalAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const token = extractToken(req);

    if (token) {
      try {
        req.user = authService.validateAccessToken(token);
        logger.debug("Optional auth: user authenticated", {
          userId: req.user.agentId,
        });
      } catch (err) {
        // Token invalid but that's okay - just continue without user
        logger.debug("Optional auth: invalid token ignored", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    next();
  } catch (err) {
    logger.error("Optional auth failed", {
      error: err instanceof Error ? err.message : String(err)
    });
    next();
  }
};

/**
 * Legacy support/helper for generating tokens
 * (Move to AuthService in production)
 */
export const generateToken = (payload: any): string => {
  return authService.generateAccessToken(payload);
};
