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
import { setAccessTokenCookie, setRefreshTokenCookie, clearAuthCookies } from "../middleware/http-only-cookies.js";

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

    // Set tokens in httpOnly cookies
    setAccessTokenCookie(res, response.token, 3600); // 1 hour access
    setRefreshTokenCookie(res, response.refreshToken, response.expiresIn); // 7 days refresh

    res.status(201).json({
      success: true,
      data: {
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
 * POST /auth/logout
 * Clear authentication cookies
 */
router.post(
  "/logout",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    clearAuthCookies(res);
    logger.info("Agent logged out (cookies cleared)");
    res.json({
      success: true,
      message: "Logged out successfully",
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
    const { token: bodyToken } = req.body;
    const cookieToken = req.cookies["__Host-refreshToken"];
    const token = bodyToken || cookieToken;

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

    // TODO: Validate refresh token and issue new ones
    // For now, re-issuing same token for development (as in original stub)
    setAccessTokenCookie(res, token, 3600);
    setRefreshTokenCookie(res, token, 7 * 24 * 60 * 60);

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
