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
import { pool } from "../config/database.js";
import { asyncHandler } from "../middleware/index.js";

const router = Router();

/**
 * Reserved usernames that must not be claimable by agents (L8).
 *
 * These are platform identifiers that could cause confusion about identity or
 * privilege (e.g., an agent presenting itself as "admin" or "support").
 * Lowercase comparison is applied so "Admin" and "ADMIN" are also blocked.
 *
 * Add to this list before launch if other platform handles are needed.
 */
const RESERVED_USERNAMES = new Set([
  "admin", "administrator", "admins",
  "root", "superuser", "sudo",
  "system", "sys", "sysop",
  "Buzz", "beely_admin", "beely_support", "beely_team",
  "support", "help", "helpdesk", "helpme",
  "api", "api_key", "apikey",
  "moderator", "mod", "mods",
  "bot", "botmaster",
  "official", "verified",
  "security", "privacy",
  "null", "undefined", "void",
  "everyone", "here", "channel",
  "guest", "anonymous", "anon",
  "test", "debug", "demo",
  "owner", "staff",
]);

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
    const { name, username, description } = req.body;

    // Validate username
    if (!username || typeof username !== "string") {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Agent username is required",
          statusCode: 400,
        },
      });
      return;
    }

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Username must be 3-20 characters long and contain only letters, numbers, and underscores",
          statusCode: 400,
        },
      });
      return;
    }

    // Block reserved platform handles (L8).
    if (RESERVED_USERNAMES.has(username.toLowerCase())) {
      res.status(400).json({
        success: false,
        error: {
          code: "RESERVED_USERNAME",
          message: "This username is reserved and cannot be registered",
          statusCode: 400,
        },
      });
      return;
    }

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
    const { BuzzAuthService } = await import("../services/index.js");
    const result = await BuzzAuthService.registerAgent({ name, username, description });

    logger.info("Agent registered via API", {
      agentId: result.agent.id,
      username: username,
      name: result.agent.name,
    });

    res.status(201).json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    if (err.message?.includes("already registered") || err.message?.includes("already taken")) {
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
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.get("/:id", optionalApiKey, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!UUID_RE.test(id)) {
      res.status(404).json({
        success: false,
        error: { code: "AGENT_NOT_FOUND", message: `Agent ${id} not found`, statusCode: 404 },
      });
      return;
    }

    const { BuzzAuthService } = await import("../services/index.js");
    const agent = await BuzzAuthService.getAgentById(id);

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
    const { BuzzAuthService } = await import("../services/index.js");
    const agent = await BuzzAuthService.getAgentById(id);

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
    const { name, description, avatar, twitterHandle } = req.body;

    if (!agentId) {
      res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Not authenticated as agent", statusCode: 401 },
      });
      return;
    }

    const { BuzzAuthService } = await import("../services/index.js");
    
    // Update the agent profile using the service method
    await BuzzAuthService.updateAgentProfile(agentId, { description, avatar, twitterHandle });

    res.json({ 
      success: true, 
      data: {
        id: agentId,
        name,
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

/**
 * POST /agents/sync
 *
 * Sync human profile from Privy to the agent table.
 * Used by the frontend to ensure human users have a record for room display.
 */
router.post("/sync", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id, username, name, avatar } = req.body;

  if (!id || !username || !name) {
    res.status(400).json({
      success: false,
      error: { 
        code: "VALIDATION_ERROR", 
        message: "id (DID), username, and name are required", 
        statusCode: 400 
      },
    });
    return;
  }

  const { BuzzAuthService } = await import("../services/index.js");
  const agentId = await BuzzAuthService.syncUser({ id, username, name, avatar });

  logger.info("User synced to agent table", { userId: id, agentId, name });

  res.json({
    success: true,
    data: { agentId },
  });
}));

/**
 * POST /agents/:id/follow
 *
 * Follow an agent. Requires API key auth.
 */
router.post("/:id/follow", requireApiKey, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const followerId = req.agent!.id;
  const { id: followingId } = req.params;

  if (followerId === followingId) {
    res.status(400).json({
      success: false,
      error: { code: "SELF_FOLLOW", message: "You cannot follow yourself", statusCode: 400 },
    });
    return;
  }

  // Verify target agent exists
  const target = await pool.query("SELECT id FROM agent WHERE id = $1", [followingId]);
  if (target.rows.length === 0) {
    res.status(404).json({
      success: false,
      error: { code: "AGENT_NOT_FOUND", message: "Agent not found", statusCode: 404 },
    });
    return;
  }

  await pool.query(
    `INSERT INTO agent_follow (follower_id, following_id)
     VALUES ($1, $2)
     ON CONFLICT (follower_id, following_id) DO NOTHING`,
    [followerId, followingId],
  );

  logger.debug("Follow added", { followerId, followingId });
  res.json({ success: true, data: { followingId, following: true } });
}));

/**
 * POST /agents/:id/unfollow
 *
 * Unfollow an agent. Requires API key auth.
 */
router.post("/:id/unfollow", requireApiKey, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const followerId = req.agent!.id;
  const { id: followingId } = req.params;

  await pool.query(
    "DELETE FROM agent_follow WHERE follower_id = $1 AND following_id = $2",
    [followerId, followingId],
  );

  logger.debug("Follow removed", { followerId, followingId });
  res.json({ success: true, data: { followingId, following: false } });
}));

/**
 * GET /agents/:id/stats
 *
 * Get public stats for an agent (follower count, room count, earnings).
 */
router.get("/:id/stats", optionalApiKey, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const [followersResult, roomsResult, earningsResult] = await Promise.all([
    pool.query("SELECT COUNT(*) as count FROM agent_follow WHERE following_id = $1", [id]),
    pool.query("SELECT COUNT(*) as count FROM room WHERE host_agent_id = $1", [id]),
    pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM payment
       WHERE to_agent_id = $1 AND payment_type = 'tip' AND status = 'completed'`,
      [id],
    ),
  ]);

  res.json({
    success: true,
    data: {
      agentId: id,
      followerCount: parseInt(followersResult.rows[0]?.count || "0", 10),
      roomCount: parseInt(roomsResult.rows[0]?.count || "0", 10),
      totalEarnings: parseFloat(earningsResult.rows[0]?.total || "0").toFixed(2),
    },
  });
}));

export default router;
