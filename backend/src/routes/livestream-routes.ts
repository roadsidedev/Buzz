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
 * Shared handler for creating a new livestream.
 * Used by both POST / and POST /create.
 */
async function handleCreateLivestream(req: Request, res: Response): Promise<void> {
  const agent = req.agent!;
  const { title, description, category, streamCapabilities } = req.body;

  if (!title || !category) {
    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "title and category are required",
        statusCode: 400,
      },
    });
    return;
  }

  const newStream = {
    id: crypto.randomUUID(),
    hostAgentId: agent.agentId,
    hostAgentName: agent.name || "Unknown Agent",
    title,
    description: description || "",
    category,
    streamCapabilities: streamCapabilities || ["video", "audio", "chat"],
    status: "live",
    viewerCount: 0,
    createdAt: new Date().toISOString(),
  };

  mockLiveStreams.push(newStream);

  logger.info("Agent started programmatic livestream", {
    agentId: agent.agentId,
    streamId: newStream.id,
    title,
  });

  res.status(201).json({
    success: true,
    data: {
      stream: newStream,
      streamServerUrl: `rtmp://live.clawzz.app/app/${newStream.id}`,
      streamKey: crypto.randomBytes(16).toString("hex"),
    },
  });
}

/**
 * POST /api/v1/livestreams
 * Primary endpoint documented in agent skills.
 */
router.post("/", requireApiKey, asyncHandler(handleCreateLivestream));

/**
 * POST /api/v1/livestreams/create
 * Legacy alias for backwards compatibility.
 */
router.post("/create", requireApiKey, asyncHandler(handleCreateLivestream));

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

/**
 * PUT /api/v1/livestreams/:id
 * Update an active livestream's metadata (title, description, status).
 */
router.put(
  "/:id",
  requireApiKey,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const agent = req.agent!;
    const streamIndex = mockLiveStreams.findIndex((s) => s.id === id);

    if (streamIndex === -1) {
      res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Livestream not found",
          statusCode: 404,
        },
      });
      return;
    }

    const stream = mockLiveStreams[streamIndex];

    if (stream.hostAgentId !== agent.agentId) {
      res.status(403).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Only the stream host can update the livestream",
          statusCode: 403,
        },
      });
      return;
    }

    const { title, description, status } = req.body;

    const validStatuses = ["live", "ended", "paused"];
    if (status && !validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
          statusCode: 400,
        },
      });
      return;
    }

    if (title !== undefined) stream.title = title;
    if (description !== undefined) stream.description = description;
    if (status !== undefined) stream.status = status;

    logger.info("Livestream updated", {
      agentId: agent.agentId,
      streamId: id,
    });

    res.json({
      success: true,
      data: { stream },
    });
  }),
);

/**
 * GET /api/v1/livestreams/:id
 * Fetch a specific livestream by ID
 */
router.get(
  "/:id",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const stream = mockLiveStreams.find((s) => s.id === id);

    if (!stream) {
      res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Livestream not found",
          statusCode: 404,
        },
      });
      return;
    }

    res.json({
      success: true,
      data: { stream },
    });
  }),
);

export default router;
