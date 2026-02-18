/**
 * Verification Routes
 *
 * Endpoints for ERC-8004 identity verification:
 * - POST /api/v1/agents/:id/verify-identity - Verify agent ownership
 * - GET /api/v1/agents/:id/verification-status - Get verification status
 *
 * Part of ERC-8004 Agent Identity Verification
 */

import { Router, Request, Response } from "express";
import { validateJWT } from "../middleware/auth.js";
import { agentService } from "../services/agent-service.js";
import { agentRepository } from "../repositories/index.js";
import { ValidationError, NotFoundError, UnauthorizedError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import type { VerifiedAgent } from "../../common/types/index.js";

const router = Router();

/**
 * POST /api/v1/agents/:id/verify-identity
 *
 * Verify agent identity on ERC-8004 smart contract
 *
 * Auth: Required (JWT with agentId matching :id)
 * Body: {
 *   walletAddress: string (Ethereum address)
 *   proof: string (proof data from wallet)
 *   signature: string (signature from wallet)
 * }
 * Returns: {
 *   success: boolean
 *   verified: boolean
 *   message: string
 *   verificationStatus: 'verified' | 'unverified' | 'pending'
 * }
 * Status: 200 OK | 400 Validation | 401 Unauthorized | 404 Not Found | 500 Error
 */
router.post(
  "/api/v1/agents/:id/verify-identity",
  validateJWT,
  async (req: Request, res: Response) => {
    try {
      const agentId = req.params.id;
      const authenticatedAgentId = (req as any).user?.agentId;

      // Only the agent can verify their own identity
      if (authenticatedAgentId !== agentId) {
        logger.warn("Unauthorized verification attempt", {
          requestedAgentId: agentId,
          authenticatedAgentId,
          ip: req.ip,
        });
        return res.status(401).json({
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "You can only verify your own identity",
            statusCode: 401,
          },
        });
      }

      // Validate request body
      const { walletAddress, proof, signature } = req.body as {
        walletAddress?: string;
        proof?: string;
        signature?: string;
      };

      if (!walletAddress || !proof || !signature) {
        return res.status(400).json({
          success: false,
          error: {
            code: "MISSING_FIELDS",
            message: "walletAddress, proof, and signature are required",
            statusCode: 400,
          },
        });
      }

      // Validate Ethereum address format
      if (!walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_ADDRESS",
            message: "Invalid Ethereum address format",
            statusCode: 400,
          },
        });
      }

      // Verify agent exists
      const agent = await agentService.getAgentById(agentId);
      if (!agent) {
        return res.status(404).json({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Agent not found",
            statusCode: 404,
          },
        });
      }

      logger.info("Starting agent identity verification", {
        agentId,
        walletAddress,
      });

      // Call verification service
      const verified = await agentService.verifyAgent({
        agentId,
        walletAddress,
        proof,
        signature,
      });

      // Fetch updated agent status
      const updatedAgent: VerifiedAgent = await agentService.getAgentById(agentId);

      logger.info("Agent identity verification completed", {
        agentId,
        verified,
        verificationStatus: updatedAgent.verification_status,
      });

      return res.status(200).json({
        success: verified,
        verified,
        message: verified
          ? "Agent identity verified successfully"
          : "Agent identity verification failed. Please check your wallet and proof data.",
        verificationStatus: updatedAgent.verification_status,
        agent: {
          id: updatedAgent.id,
          name: updatedAgent.name,
          verificationStatus: updatedAgent.verification_status,
          verifiedAt: updatedAgent.verified_at,
        },
      });
    } catch (err) {
      if (err instanceof ValidationError) {
        logger.warn("Verification validation error", {
          agentId: req.params.id,
          error: err.message,
        });
        return res.status(400).json({
          success: false,
          error: {
            code: err.context?.code || "VALIDATION_ERROR",
            message: err.message,
            statusCode: 400,
            context: err.context,
          },
        });
      }

      if (err instanceof NotFoundError) {
        return res.status(404).json({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: err.message,
            statusCode: 404,
          },
        });
      }

      logger.error("Agent verification error", {
        agentId: req.params.id,
        error: err instanceof Error ? err.message : String(err),
      });

      return res.status(500).json({
        success: false,
        error: {
          code: "VERIFICATION_ERROR",
          message: "An error occurred during verification. Please try again.",
          statusCode: 500,
        },
      });
    }
  }
);

/**
 * GET /api/v1/agents/:id/verification-status
 *
 * Get agent verification status (public endpoint)
 *
 * Auth: Optional (JWT)
 * Returns: {
 *   agentId: string
 *   name: string
 *   verificationStatus: 'verified' | 'unverified' | 'pending' | 'suspended' | 'banned'
 *   verifiedAt: string | null
 *   badge: string | null
 * }
 * Status: 200 OK | 404 Not Found | 500 Error
 */
router.get("/api/v1/agents/:id/verification-status", async (req: Request, res: Response) => {
  try {
    const agentId = req.params.id;

    const agent: VerifiedAgent = await agentService.getAgentById(agentId);
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Agent not found",
          statusCode: 404,
        },
      });
    }

    logger.debug("Verification status retrieved", {
      agentId,
      status: agent.verification_status,
    });

    return res.status(200).json({
      success: true,
      agentId: agent.id,
      name: agent.name,
      verificationStatus: agent.verification_status,
      verifiedAt: agent.verified_at ? agent.verified_at.toISOString() : null,
      badge: agent.badge || null,
      avatar: agent.avatar || null,
    });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Agent not found",
          statusCode: 404,
        },
      });
    }

    logger.error("Failed to retrieve verification status", {
      agentId: req.params.id,
      error: err instanceof Error ? err.message : String(err),
    });

    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to retrieve verification status",
        statusCode: 500,
      },
    });
  }
});

export default router;
