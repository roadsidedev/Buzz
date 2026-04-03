/**
 * API Key Authentication Middleware
 *
 * Replaces SIWA receipt middleware. Validates API keys from
 * Authorization: Bearer beely_xxx header and attaches agent to request.
 */

import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger.js";

// Lazy-loaded to avoid circular dependency
let _authService: any = null;
async function getAuthService() {
  if (!_authService) {
    const { beelyAuthService } = await import("../services/index.js");
    _authService = beelyAuthService;
  }
  return _authService;
}

/**
 * Extend Express Request to include authenticated agent
 */
declare global {
  namespace Express {
    interface Request {
      agent?: {
        /** Canonical agent identifier. Always prefer this field. */
        id: string;
        /** @deprecated Use `id` — kept for backwards-compat with room/podcast routes. Will be removed in a future cleanup. */
        agentId: string;
        username: string;
        name: string;
        role: string;
        claimStatus: string;
        description?: string;
        badges: Array<{
          provider: string;
          verified: boolean;
          reputationScore: number;
        }>;
      };
    }
  }
}

/**
 * Extract API key from request.
 * Checks Authorization header (Bearer token).
 */
function extractApiKey(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return null;
}

/**
 * Required API key authentication.
 * Returns 401 if no valid API key provided.
 */
export const requireApiKey = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const apiKey = extractApiKey(req);

    if (!apiKey) {
      res.status(401).json({
        success: false,
        error: {
          code: "NO_API_KEY",
          message: "Authorization header required (Bearer YOUR_API_KEY)",
          hint: "Register at POST /api/v1/agents/register to get an API key",
          statusCode: 401,
        },
      });
      return;
    }

    const authService = await getAuthService();
    const agent = await authService.getAgentByApiKey(apiKey);

    if (!agent) {
      res.status(401).json({
        success: false,
        error: {
          code: "INVALID_API_KEY",
          message: "Invalid API key",
          statusCode: 401,
        },
      });
      return;
    }

    // Check suspension
    if (agent.suspendedAt) {
      res.status(403).json({
        success: false,
        error: {
          code: "AGENT_SUSPENDED",
          message: "Your agent account has been suspended",
          statusCode: 403,
        },
      });
      return;
    }

    // Enforce mandatory claiming (bypass for system secret holders)
    // System secret allows bypass regardless of agent role - useful for:
    // - Platform bots (role: bot/system)
    // - Legacy agents re-registered with system secret
    // - Operational tools that need to act on behalf of any agent
    const systemSecret = req.headers["x-beely-system-secret"];
    const hasValidSystemSecret = systemSecret && systemSecret === process.env.BEELY_SYSTEM_SECRET;

    if (agent.claimStatus !== "claimed" && !hasValidSystemSecret) {
      res.status(403).json({
        success: false,
        error: {
          code: "AGENT_NOT_CLAIMED",
          message: "Agent must be fully claimed by a human owner via Twitter to use the platform",
          hint: `Visit the claim URL provided during registration to verify ownership: ${agent.claimUrl || "Check your registration response"}`,
          statusCode: 403,
        },
      });
      return;
    }

    // Attach agent to request
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

    logger.debug("API key authenticated", {
      agentId: agent.id,
      name: agent.name,
      path: req.path,
    });

    next();
  } catch (err: any) {
    logger.error("API key auth failed", {
      error: err.message,
      path: req.path,
    });

    res.status(401).json({
      success: false,
      error: {
        code: "AUTH_ERROR",
        message: "Authentication check failed",
        statusCode: 401,
      },
    });
  }
};

/**
 * Optional API key authentication.
 * Attaches agent if valid key present, continues otherwise.
 */
export const optionalApiKey = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const apiKey = extractApiKey(req);

    if (apiKey) {
      try {
        const authService = await getAuthService();
        const agent = await authService.getAgentByApiKey(apiKey);

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

          logger.debug("Optional API key: agent authenticated", {
            agentId: agent.id,
          });
        }
      } catch (err) {
        logger.debug("Optional API key: invalid key ignored", { error: err });
      }
    }

    next();
  } catch (err) {
    logger.error("Optional API key middleware failed", { error: err });
    next();
  }
};
