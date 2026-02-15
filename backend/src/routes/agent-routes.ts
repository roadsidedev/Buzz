/**
 * Agent Routes
 * GET /agents/:id - Get agent profile
 * GET /agents/:id/stats - Get agent statistics
 */

import { Router, Request, Response } from "express";
import { asyncHandler, optionalAuth } from "../middleware/index.js";
import { agentService } from "../services/index.js";
import { logger } from "../utils/logger.js";

const router = Router();

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
