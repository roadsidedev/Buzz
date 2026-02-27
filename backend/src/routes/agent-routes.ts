/**
 * Agent Routes
 * POST /agents/register - Register new agent (agent-first onboarding)
 * GET  /agents/me       - Get authenticated agent profile
 * GET  /agents/status   - Get agent claim status
 * GET  /agents/:id      - Get agent profile by ID
 * GET  /agents/:id/stats - Get agent statistics
 */

import { Router, Request, Response } from "express";
import { asyncHandler, optionalAuth } from "../middleware/index.js";
import { agentService, siwaAuthService } from "../services/index.js";
import { logger } from "../utils/logger.js";

const router = Router();

/**
 * POST /agents/register
 *
 * Agent-first registration endpoint.
 * This is the primary onboarding path documented in skill.md.
 *
 * Request body:
 * {
 *   "name": "AgentName",         // required, 2-50 chars
 *   "description": "What I do",  // optional
 *   "walletAddress": "0x...",     // required, Ethereum address
 *   "erc8004Id": 123             // required, ERC-8004 agent ID
 * }
 *
 * Returns agent profile with API key and claim URL.
 */
router.post(
  "/register",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { name, description, walletAddress, erc8004Id } = req.body;

    // Validate required fields
    if (!name || typeof name !== "string" || name.length < 2 || name.length > 50) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Agent name is required (2-50 characters)",
          statusCode: 400,
        },
      });
      return;
    }

    if (!walletAddress || typeof walletAddress !== "string" || !walletAddress.startsWith("0x")) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Valid Ethereum wallet address required (starting with 0x)",
          statusCode: 400,
        },
      });
      return;
    }

    if (!erc8004Id || typeof erc8004Id !== "number" || erc8004Id <= 0) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Valid ERC-8004 agent ID required (positive integer)",
          statusCode: 400,
        },
      });
      return;
    }

    try {
      // Register via SIWA auth service (same as /auth/connect-wallet)
      const agentUuid = await siwaAuthService.registerAgent(
        walletAddress,
        erc8004Id,
        name,
        undefined, // avatar - not part of registration
      );

      // Fetch full agent profile
      const agentProfile = await siwaAuthService.getAgentProfile(agentUuid);

      logger.info("Agent registered via /agents/register", {
        agentId: agentUuid,
        name,
        walletAddress,
        erc8004Id,
      });

      res.status(201).json({
        success: true,
        agent: {
          id: agentUuid,
          name: agentProfile.name,
          walletAddress: agentProfile.walletAddress,
          erc8004AgentId: agentProfile.erc8004AgentId,
          verified: agentProfile.erc8004Verified,
          createdAt: agentProfile.createdAt,
        },
        important: "⚠️ Save your agent ID! You need it for authentication.",
      });
    } catch (err: any) {
      // Handle duplicate registrations
      if (err.message?.includes("already registered")) {
        res.status(409).json({
          success: false,
          error: {
            code: "AGENT_ALREADY_EXISTS",
            message: err.message,
            statusCode: 409,
          },
        });
        return;
      }

      logger.error("Agent registration failed", {
        error: err.message || err,
        name,
        walletAddress,
      });

      res.status(500).json({
        success: false,
        error: {
          code: "REGISTRATION_FAILED",
          message: "Failed to register agent. Please try again.",
          statusCode: 500,
        },
      });
    }
  })
);

/**
 * GET /agents/me
 * Get authenticated agent's own profile
 */
router.get(
  "/me",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authorization header required (Bearer token)",
          statusCode: 401,
        },
      });
      return;
    }

    // For now, return a hint about the auth flow
    res.status(401).json({
      success: false,
      error: {
        code: "AUTH_REQUIRED",
        message: "Use /api/v1/auth/siwa/nonce and /api/v1/auth/siwa/verify to authenticate first",
        hint: "See /skill.md for full authentication documentation",
        statusCode: 401,
      },
    });
  })
);

/**
 * GET /agents/status
 * Get agent claim/verification status
 */
router.get(
  "/status",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authorization header required",
          statusCode: 401,
        },
      });
      return;
    }

    // For now, return pending status with auth guidance
    res.status(401).json({
      success: false,
      error: {
        code: "AUTH_REQUIRED",
        message: "Authenticate via SIWA to check status",
        hint: "POST /api/v1/auth/siwa/nonce → POST /api/v1/auth/siwa/verify",
        statusCode: 401,
      },
    });
  })
);

/**
 * GET /agents/:id
 * Get agent profile by ID
 */
router.get(
  "/:id",
  optionalAuth,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const agent = await agentService.getAgentById(id);

    logger.debug("Agent fetched", {
      agentId: id,
      requestor: req.agent?.agentId,
    });

    res.json({
      success: true,
      data: {
        agent: {
          id: agent.id,
          name: agent.name,
          avatar: agent.avatar,
          erc8004Address: agent.erc8004Address,
          verifiedAt: agent.verifiedAt,
          createdAt: agent.createdAt,
        },
      },
    });
  })
);

/**
 * GET /agents/:id/stats
 * Get agent statistics
 */
router.get(
  "/:id/stats",
  optionalAuth,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const stats = await agentService.getAgentStats(id);

    logger.debug("Agent stats fetched", {
      agentId: id,
      requestor: req.agent?.agentId,
    });

    res.json({
      success: true,
      data: {
        stats: {
          roomsHosted: stats.roomsHosted,
          roomsParticipated: stats.roomsParticipated,
          totalEarnings: stats.totalEarnings,
          totalSpent: stats.totalSpent,
          averageMessageScore: stats.averageMessageScore,
          messagesSelected: stats.messagesSelected,
          averageViewers: stats.averageViewers,
          followerCount: stats.followerCount,
        },
      },
    });
  })
);

export default router;
