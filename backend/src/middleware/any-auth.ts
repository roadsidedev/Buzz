/**
 * Any Auth Middleware
 *
 * Supports both JWT (Privy access tokens for human users) and
 * API key (beely_xxx for agent/bot users) authentication.
 *
 * Chain:
 * 1. Try JWT verification first (human/Privy users)
 * 2. Fall back to API key auth (agent/bot users)
 * 3. Return 401 only if both methods fail
 */

import { Request, Response, NextFunction } from "express";
import { requireJwt, optionalJwt } from "./jwt-auth.js";
import { requireApiKey } from "./api-key-auth.js";
import { logger } from "../utils/logger.js";

/**
 * Extract raw Bearer token to determine auth type.
 * Returns "jwt" if token doesn't start with "beely_", "api_key" if it does, null if missing.
 */
function detectAuthType(req: Request): "jwt" | "api_key" | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  return token.startsWith("beely_") ? "api_key" : "jwt";
}

/**
 * Required authentication — accepts either JWT or API key.
 */
export const requireAnyAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const authType = detectAuthType(req);

  if (authType === "jwt") {
    logger.debug("Any auth: routing to JWT verification", { path: req.path });
    return requireJwt(req, res, next);
  }

  if (authType === "api_key") {
    logger.debug("Any auth: routing to API key verification", { path: req.path });
    return requireApiKey(req, res, next);
  }

  // No token at all — try JWT first, then API key fallback
  let jwtResponded = false;

  const jwtResult = await new Promise<boolean>((resolve) => {
    const originalStatus = res.status.bind(res);
    const originalJson = res.json.bind(res);
    const originalEnd = res.end.bind(res);

    let chainResolve: ((result: boolean) => void) | null = resolve;

    const mockStatus = (code: number) => {
      if (code === 401) {
        // JWT returned 401, try API key fallback
        if (chainResolve) {
          chainResolve(false);
          chainResolve = null;
        }
        return {
          json: (body: unknown) => {
            if (chainResolve) {
              chainResolve(false);
              chainResolve = null;
            }
          },
        };
      }
      // Other status — let it through
      if (chainResolve) {
        chainResolve(true);
        chainResolve = null;
      }
      return { json: () => {} };
    };

    const mockJson = (body: unknown) => {
      if (chainResolve) {
        chainResolve(false);
        chainResolve = null;
      }
    };

    res.status = mockStatus as typeof res.status;
    res.json = mockJson as typeof res.json;

    requireJwt(req, res, () => {
      if (chainResolve) {
        chainResolve(true);
        chainResolve = null;
      }
    }).catch(() => {
      if (chainResolve) {
        chainResolve(false);
        chainResolve = null;
      }
    });
  });

  if (jwtResponded || jwtResult) return;

  // JWT failed, try API key
  return requireApiKey(req, res, next);
};

/**
 * Optional authentication — tries JWT, then API key, continues either way.
 */
export const optionalAnyAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const authType = detectAuthType(req);

  if (authType === "jwt") {
    return optionalJwt(req, res, next);
  }

  if (authType === "api_key") {
    try {
      const { buzzAuthService } = await import("../services/index.js");
      const authHeader = req.headers.authorization;
      const apiKey = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

      if (apiKey?.startsWith("beely_")) {
        const agent = await buzzAuthService.getAgentByApiKey(apiKey);
        if (agent && !agent.suspendedAt) {
          req.agent = {
            id: agent.id,
            agentId: agent.id,
            username: agent.username,
            name: agent.name,
            role: agent.role,
            claimStatus: agent.claimStatus,
            description: agent.description,
            badges: (agent.badges || []).map((b: any) => ({
              provider: b.provider,
              verified: b.verified,
              reputationScore: b.reputationScore || 0,
            })),
          };
        }
      }
    } catch {
      // Ignore errors in optional mode
    }
    return next();
  }

  // No auth provided, continue without attaching agent
  return next();
};

// Re-export for backward compatibility
export { requireApiKey } from "./api-key-auth.js";
export { requireJwt, optionalJwt } from "./jwt-auth.js";
