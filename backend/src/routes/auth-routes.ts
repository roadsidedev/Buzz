/**
 * Authentication Routes
 * POST /auth/register - Register new agent
 * POST /auth/verify - Verify ERC-8004 identity
 * POST /auth/refresh - Refresh token
 */

import { Router, Request, Response } from "express";
import type { RegisterRequest, TokenResponse } from "../types/api.js";
import { asyncHandler, authLimiter } from "../middleware/index.js";
import { generateToken } from "../middleware/auth.js";
import { validate, RegisterRequestSchema } from "../utils/validators.js";
import { agentService } from "../services/index.js";
import { logger } from "../utils/logger.js";

const router = Router();

/**
 * POST /auth/register
 * Register new agent with ERC-8004 identity
 */
router.post(
  "/register",
  authLimiter,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // Validate request
    const input = validate(RegisterRequestSchema, req.body);

    // Check if agent already exists
    const existing = await agentService.getAgentByAddress(input.erc8004Address);
    if (existing) {
      res.status(400).json({
        success: false,
        error: {
          code: "AGENT_ALREADY_EXISTS",
          message: "An agent with this address is already registered",
          statusCode: 400,
        },
      });
      return;
    }

    // Create agent
    const agent = await agentService.createAgent({
      name: input.name,
      erc8004Address: input.erc8004Address,
      avatarUrl: input.avatarUrl,
    });

    // Generate token
    const token = generateToken({
      agentId: agent.id,
      name: agent.name,
      erc8004Address: agent.erc8004Address,
      verified: true,
    });

    logger.info("Agent registered", {
      agentId: agent.id,
      name: agent.name,
    });

    const response: TokenResponse = {
      token,
      refreshToken: token, // TODO: Implement refresh token rotation
      expiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
    };

    res.status(201).json({
      success: true,
      data: {
        token: response.token,
        agent: {
          id: agent.id,
          name: agent.name,
          erc8004Address: agent.erc8004Address,
          avatar: agent.avatar,
        },
        expiresIn: response.expiresIn,
      },
    });
  })
);

/**
 * POST /auth/verify
 * Verify agent via ERC-8004 smart contract
 */
router.post(
  "/verify",
  authLimiter,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { erc8004Address } = req.body;

    if (!erc8004Address) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Missing erc8004Address",
          statusCode: 400,
        },
      });
      return;
    }

    // TODO: Call ERC-8004 smart contract to verify
    const verified = await agentService.verifyAgent(erc8004Address);

    if (!verified) {
      res.status(403).json({
        success: false,
        error: {
          code: "VERIFICATION_FAILED",
          message: "Address verification failed",
          statusCode: 403,
        },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        verified: true,
        message: "Address verified",
      },
    });
  })
);

/**
 * POST /auth/refresh
 * Refresh JWT token
 */
router.post(
  "/refresh",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { token } = req.body;

    if (!token) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Missing token",
          statusCode: 400,
        },
      });
      return;
    }

    // TODO: Validate refresh token
    // TODO: Issue new token

    res.json({
      success: true,
      data: {
        token,
        expiresIn: 7 * 24 * 60 * 60,
      },
    });
  })
);

export default router;
