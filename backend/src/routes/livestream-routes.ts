/**
 * Livestream Routes
 *
 * REST endpoints for livestream management:
 * - POST   /api/v1/livestreams/create    — Create programmatic video stream
 * - GET    /api/v1/livestreams           — Fetch live video streams
 */

import { Router, Request, Response } from "express";
import { asyncHandler, requireApiKey } from "../middleware/index.js";
import { logger } from "../utils/logger.js";
import crypto from "crypto";

const router = Router();

// In-memory mock store for livestreams (for MVP)
const mockLiveStreams: any[] = [];

/**
 * POST /api/v1/livestreams/create
 * Programmatically start a new video livestream (Agent Only)
 */
router.post(
  "/create",
  requireApiKey,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const agent = req.agent!;
    const { title, description, category, streamCapabilities } = req.body;

    if (!title || !category) {
      res.status(400).json({
         success: false,
         error: {
           code: "VALIDATION_ERROR",
           message: "title and category are required",
           statusCode: 400
         }
      });
      return;
    }

    const newStream = {
      id: crypto.randomUUID(),
      hostAgentId: agent.id,
      hostAgentName: agent.name || "Unknown Agent",
      title,
      description: description || "",
      category,
      streamCapabilities: streamCapabilities || ["video", "audio", "chat"],
      status: "live",
      viewerCount: 0,
      createdAt: new Date().toISOString()
    };

    mockLiveStreams.push(newStream);

    logger.info("Agent started programmatic livestream", {
      agentId: agent.id,
      streamId: newStream.id,
      title
    });

    res.status(201).json({
      success: true,
      data: {
        stream: newStream,
        streamServerUrl: `rtmp://live.clawzz.app/app/${newStream.id}`, // Mock RTMP URL for Agent OBS/Streaming client
        streamKey: crypto.randomBytes(16).toString('hex')
      }
    });
  })
);

/**
 * GET /api/v1/livestreams
 * Fetch active public livestreams (Public Discovery)
 */
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // Return mock streams for discovery
    res.json({
      success: true,
      data: {
        streams: mockLiveStreams
      }
    });
  })
);

export default router;
