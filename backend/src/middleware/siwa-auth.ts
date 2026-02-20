/**
 * SIWA Receipt Verification Middleware
 *
 * Validates SIWA receipts in Authorization header or cookies
 * Attaches decoded agent info to request
 */

import { Request, Response, NextFunction } from "express";
import { siwaAuthService } from "../services/index.js";
import { logger } from "../utils/logger.js";

/**
 * Extend Express Request to include authenticated agent
 */
declare global {
  namespace Express {
    interface Request {
      agent?: {
        id: string;
        name: string;
        walletAddress: string;
        agentId: number;
        verified: boolean;
      };
    }
  }
}

/**
 * Verify SIWA receipt and attach agent to request
 *
 * Extracts receipt from:
 * 1. Authorization header (Bearer <receipt>)
 * 2. siwa_receipt cookie
 *
 * @param req - Express request
 * @param res - Express response
 * @param next - Express next
 */
export const verifySIWAReceipt = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // Extract receipt from Authorization header or cookie
    const authHeader = req.headers.authorization;
    const receipt = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : (req.cookies?.siwa_receipt as string | undefined);

    if (!receipt) {
      logger.warn("Missing SIWA receipt", {
        path: req.path,
        method: req.method,
      });
      res.status(401).json({
        success: false,
        error: {
          code: "NO_RECEIPT",
          message: "No SIWA receipt provided",
          statusCode: 401,
        },
      });
      return;
    }

    // Verify receipt signature and expiry
    const decoded = await siwaAuthService.verifyReceipt(receipt);

    // Fetch full agent profile - SDK uses 'address' not 'walletAddress'
    const agentProfile = await siwaAuthService.getAgentByWallet(
      decoded.address,
    );

    if (!agentProfile) {
      logger.warn("Agent not found for wallet", {
        walletAddress: decoded.address,
      });
      res.status(401).json({
        success: false,
        error: {
          code: "AGENT_NOT_FOUND",
          message: "Agent not found",
          statusCode: 401,
        },
      });
      return;
    }

    // Attach agent to request
    req.agent = {
      id: agentProfile.id,
      name: agentProfile.name,
      walletAddress: agentProfile.walletAddress,
      agentId: agentProfile.erc8004AgentId,
      verified: agentProfile.erc8004Verified,
    };

    logger.debug("SIWA receipt verified", {
      agentId: req.agent.id,
      walletAddress: req.agent.walletAddress,
    });

    next();
  } catch (err: any) {
    logger.error("SIWA receipt verification failed", {
      error: err.message,
      path: req.path,
    });

    res.status(401).json({
      success: false,
      error: {
        code: "RECEIPT_VERIFICATION_FAILED",
        message: err.message || "Receipt verification failed",
        statusCode: 401,
      },
    });
  }
};

/**
 * Optional SIWA authentication
 *
 * Verifies receipt if present, but doesn't require it
 * Useful for endpoints that work both authenticated and unauthenticated
 *
 * @param req - Express request
 * @param res - Express response
 * @param next - Express next
 */
export const optionalSIWA = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // Extract receipt from Authorization header or cookie
    const authHeader = req.headers.authorization;
    const receipt = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : (req.cookies?.siwa_receipt as string | undefined);

    if (receipt) {
      try {
        // Verify receipt
        const decoded = await siwaAuthService.verifyReceipt(receipt);

        // Fetch agent profile
        const agentProfile = await siwaAuthService.getAgentByWallet(
          decoded.address,
        );

        if (agentProfile) {
          // Attach agent to request
          req.agent = {
            id: agentProfile.id,
            name: agentProfile.name,
            walletAddress: agentProfile.walletAddress,
            agentId: agentProfile.erc8004AgentId,
            verified: agentProfile.erc8004Verified,
          };

          logger.debug("Optional SIWA: agent authenticated", {
            agentId: req.agent.id,
          });
        }
      } catch (err) {
        // Receipt invalid but that's okay - just continue without agent
        logger.debug("Optional SIWA: invalid receipt ignored", {
          error: err,
        });
      }
    }

    next();
  } catch (err) {
    logger.error("Optional SIWA failed", { error: err });
    next();
  }
};
