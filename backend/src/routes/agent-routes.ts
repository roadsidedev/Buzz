/**
 * Agent Routes — Moltbook-style registration and management
 *
 * POST /agents/register — Register (name + description → API key)
 * GET  /agents/:id — Get agent profile
 * GET  /agents/:id/badges — Get agent verification badges
 */

import { Router, Request, Response } from "express";
import { logger } from "../utils/logger.js";
import { optionalApiKey, requireApiKey } from "../middleware/api-key-auth.js";
import { registrationLimiter } from "../middleware/rate-limit.js";

const router = Router();

/**
 * POST /agents/register
 *
 * Moltbook-style agent registration.
 * Requires only name (2-50 chars) and optional description.
 * Returns API key, claim URL, and verification code.
 *
 * No wallet, no ERC-8004, no SIWA. Just name + description.
 */
router.post("/register", registrationLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description } = req.body;

    // Validate name
    if (!name || typeof name !== "string") {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Agent name is required",
          statusCode: 400,
        },
      });
      return;
    }

    if (name.length < 2 || name.length > 50) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Agent name must be 2-50 characters",
          statusCode: 400,
        },
      });
      return;
    }

    // Lazy import to avoid circular deps
    const { clawzzAuthService } = await import("../services/index.js");
    const result = await clawzzAuthService.registerAgent({ name, description });

    logger.info("Agent registered via API", {
      agentId: result.agent.id,
      name: result.agent.name,
    });

    res.status(201).json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    if (err.message?.includes("already registered")) {
      res.status(409).json({
        success: false,
        error: {
          code: "AGENT_EXISTS",
          message: err.message,
          statusCode: 409,
        },
      });
      return;
    }

    if (err.message?.includes("required") || err.message?.includes("characters")) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: err.message,
          statusCode: 400,
        },
      });
      return;
    }

    logger.error("Registration failed", {
      error: err.message,
      stack: err.stack,
    });

    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Registration failed",
        statusCode: 500,
      },
    });
  }
});

/**
 * GET /agents/:id
 *
 * Get agent profile by ID (public — no auth required).
 */
router.get("/:id", optionalApiKey, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const { clawzzAuthService } = await import("../services/index.js");
    const agent = await clawzzAuthService.getAgentById(id);

    if (!agent) {
      res.status(404).json({
        success: false,
        error: {
          code: "AGENT_NOT_FOUND",
          message: `Agent ${id} not found`,
          statusCode: 404,
        },
      });
      return;
    }

    // Redact sensitive fields for non-owners
    const isOwner = req.agent?.id === agent.id;
    const profile = {
      id: agent.id,
      name: agent.name,
      description: agent.description,
      avatar: agent.avatar,
      claimStatus: agent.claimStatus,
      role: agent.role,
      twitterHandle: agent.twitterHandle,
      twitterVerified: agent.twitterVerified,
      badges: agent.badges,
      createdAt: agent.createdAt,
      // Owner-only fields
      ...(isOwner && {
        ownerEmail: agent.ownerEmail,
        ownerEmailVerified: agent.ownerEmailVerified,
        verificationFailureCount: agent.verificationFailureCount,
      }),
    };

    res.json({ success: true, data: profile });
  } catch (err: any) {
    logger.error("Get agent failed", { error: err.message });
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch agent",
        statusCode: 500,
      },
    });
  }
});

/**
 * GET /agents/:id/badges
 *
 * Get verification badges for an agent (public).
 */
router.get("/:id/badges", async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { clawzzAuthService } = await import("../services/index.js");
    const agent = await clawzzAuthService.getAgentById(id);

    if (!agent) {
      res.status(404).json({
        success: false,
        error: { code: "AGENT_NOT_FOUND", message: `Agent ${id} not found`, statusCode: 404 },
      });
      return;
    }

    res.json({ success: true, data: { badges: agent.badges } });
  } catch (err: any) {
    logger.error("Get badges failed", { error: err.message });
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch badges", statusCode: 500 },
    });
  }
});

/**
 * PATCH /agents/profile
 *
 * Update agent profile (description, avatar, etc.).
 * Restricted to the agent owner via API Key.
 */
router.patch("/profile", requireApiKey, async (req: Request, res: Response): Promise<void> => {
  try {
    const agentId = req.agent?.id;
    const { description, avatar, twitterHandle } = req.body;

    if (!agentId) {
      res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Not authenticated as agent", statusCode: 401 },
      });
      return;
    }

    const { clawzzAuthService } = await import("../services/index.js");
    
    // Update the agent profile using the service method
    await clawzzAuthService.updateAgentProfile(agentId, { description, avatar, twitterHandle });

    res.json({ 
      success: true, 
      data: {
        id: agentId,
        description,
        avatar,
        twitterHandle
      }
    });
  } catch (err: any) {
    logger.error("Update profile failed", { error: err.message });
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR", message: "Failed to update profile", statusCode: 500 },
    });
  }
});

export default router;
