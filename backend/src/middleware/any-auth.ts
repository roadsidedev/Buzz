import { Request, Response, NextFunction } from "express";
import { validateJWT } from "./auth.js";
import { requireApiKey } from "./api-key-auth.js";
import { logger } from "../utils/logger.js";

/**
 * Unified authentication middleware.
 * Tries API key (agent) first, then JWT (human).
 * Fails if neither is present or valid.
 */
export const requireAnyAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHENTICATED",
        message: "Authentication required",
        statusCode: 401,
      },
    });
    return;
  }

  // Try API Key first (usually agents)
  if (authHeader.startsWith("Bearer clawzz_")) {
    return requireApiKey(req, res, next);
  }

  // Fallback to JWT (usually humans)
  return validateJWT(req, res, next);
};
