/**
 * Verify Agent Status Middleware
 *
 * Middleware to enforce agent verification status checks
 * Used to prevent unverified agents from creating rooms or other privileged operations
 */

import { Request, Response, NextFunction } from "express";
import { agentRepository } from "../../repositories/index.js";
import { logger } from "../../utils/logger.js";

/**
 * Enforce agent verification status
 *
 * Checks if the authenticated agent has a specific verification status.
 * Allows operations only if status matches the allowed statuses.
 *
 * @param allowedStatuses - Array of allowed verification statuses
 * @returns Express middleware
 *
 * Example:
 *   router.post("/create-room", verifyAgentStatus(["verified"]), createRoomHandler)
 */
export function verifyAgentStatus(allowedStatuses: string[] = ["verified"]) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const agentId = (req as any).user?.agentId;

      if (!agentId) {
        logger.warn("Verification check: Missing agent ID", {
          path: req.path,
        });
        res.status(401).json({
          success: false,
          error: {
            code: "MISSING_AUTH",
            message: "Authentication required",
            statusCode: 401,
          },
        });
        return;
      }

      const agent = await agentRepository.getById(agentId);
      if (!agent) {
        logger.warn("Verification check: Agent not found", {
          agentId,
          path: req.path,
        });
        res.status(404).json({
          success: false,
          error: {
            code: "AGENT_NOT_FOUND",
            message: "Agent not found",
            statusCode: 404,
          },
        });
        return;
      }

      const status = agent.verification_status || "unverified";
      if (!allowedStatuses.includes(status)) {
        logger.warn("Verification check failed", {
          agentId,
          currentStatus: status,
          allowedStatuses,
          path: req.path,
        });

        res.status(403).json({
          success: false,
          error: {
            code: "AGENT_NOT_VERIFIED",
            message: `Agent verification required. Current status: ${status}. This operation requires one of: ${allowedStatuses.join(", ")}`,
            statusCode: 403,
            context: {
              currentStatus: status,
              allowedStatuses,
              action: "Verify your agent identity to perform this action",
            },
          },
        });
        return;
      }

      logger.debug("Verification check passed", {
        agentId,
        status,
      });

      (req as any).agent = agent;

      next();
    } catch (err) {
      logger.error("Verification middleware error", {
        error: err instanceof Error ? err.message : String(err),
        path: req.path,
      });

      res.status(500).json({
        success: false,
        error: {
          code: "VERIFICATION_ERROR",
          message: "An error occurred during verification check",
          statusCode: 500,
        },
      });
    }
  };
}

/**
 * Optional: Check verification status without blocking
 *
 * Attaches verification info to request but doesn't block
 */
export function attachVerificationStatus() {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const agentId = (req as any).user?.agentId;

      if (!agentId) {
        next();
        return;
      }

      const agent = await agentRepository.getById(agentId);
      if (agent) {
        const status = agent.verification_status || "unverified";
        (req as any).verificationStatus = status;
        (req as any).isVerified = status === "verified";
      }

      next();
    } catch (err) {
      logger.debug("Error attaching verification status", {
        error: err instanceof Error ? err.message : String(err),
      });
      next();
    }
  };
}
