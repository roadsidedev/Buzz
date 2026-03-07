/**
 * Livestream Routes
 *
 * REST endpoints for livestream management:
 * - POST   /api/v1/livestreams/create    — Create programmatic video stream
 * - GET    /api/v1/livestreams           — Fetch live video streams
 * - PUT    /api/v1/livestreams/:id       — Update a livestream
 * - GET    /api/v1/livestreams/:id       — Fetch a single livestream
 */

import { Router, Request, Response } from "express";
import { asyncHandler, requireApiKey } from "../middleware/index.js";
import { logger } from "../utils/logger.js";
import { pool } from "../config/database.js";
import crypto from "crypto";

const router = Router();

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

  const streamId = crypto.randomUUID();
  const streamKey = crypto.randomBytes(16).toString("hex");
  const capabilities = streamCapabilities || ["video", "audio", "chat"];

  await pool.query(
    `INSERT INTO livestream (
      id, host_agent_id, host_agent_name, title, description,
      category, stream_capabilities, status, viewer_count, stream_key
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'live', 0, $8)`,
    [
      streamId,
      agent.id,
      agent.name || "Unknown Agent",
      title,
      description || "",
      category,
      capabilities,
      streamKey,
    ],
  );

  logger.info("Agent started programmatic livestream", {
    agentId: agent.id,
    streamId,
    title,
  });

  res.status(201).json({
    success: true,
    data: {
      stream: {
        id: streamId,
        hostAgentId: agent.id,
        hostAgentName: agent.name || "Unknown Agent",
        title,
        description: description || "",
        category,
        streamCapabilities: capabilities,
        status: "live",
        viewerCount: 0,
        createdAt: new Date().toISOString(),
      },
      streamServerUrl: `rtmp://live.clawzz.app/app/${streamId}`,
      streamKey,
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
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const category = req.query.category as string | undefined;

    const params: unknown[] = ["live"];
    let categoryClause = "";
    if (category) {
      params.push(category);
      categoryClause = `AND category = $${params.length}`;
    }
    params.push(limit);

    const result = await pool.query(
      `SELECT id, host_agent_id as "hostAgentId", host_agent_name as "hostAgentName",
              title, description, category, stream_capabilities as "streamCapabilities",
              status, viewer_count as "viewerCount", created_at as "createdAt"
       FROM livestream
       WHERE status = $1 ${categoryClause}
       ORDER BY viewer_count DESC, created_at DESC
       LIMIT $${params.length}`,
      params,
    );

    res.json({
      success: true,
      data: { streams: result.rows },
    });
  }),
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

    // Verify ownership
    const streamResult = await pool.query(
      "SELECT id, host_agent_id FROM livestream WHERE id = $1",
      [id],
    );

    if (streamResult.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Livestream not found", statusCode: 404 },
      });
      return;
    }

    if (streamResult.rows[0].host_agent_id !== agent.id) {
      res.status(403).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Only the stream host can update the livestream", statusCode: 403 },
      });
      return;
    }

    const { title, description, status } = req.body;
    const validStatuses = ["live", "ended", "paused"];
    if (status && !validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`, statusCode: 400 },
      });
      return;
    }

    const setClauses: string[] = ["updated_at = NOW()"];
    const values: unknown[] = [];
    if (title !== undefined) { values.push(title); setClauses.push(`title = $${values.length}`); }
    if (description !== undefined) { values.push(description); setClauses.push(`description = $${values.length}`); }
    if (status !== undefined) { values.push(status); setClauses.push(`status = $${values.length}`); }

    values.push(id);
    const updatedResult = await pool.query(
      `UPDATE livestream SET ${setClauses.join(", ")}
       WHERE id = $${values.length}
       RETURNING id, host_agent_id as "hostAgentId", host_agent_name as "hostAgentName",
                 title, description, category, status, viewer_count as "viewerCount",
                 created_at as "createdAt"`,
      values,
    );

    logger.info("Livestream updated", { agentId: agent.id, streamId: id });

    res.json({ success: true, data: { stream: updatedResult.rows[0] } });
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

    const result = await pool.query(
      `SELECT id, host_agent_id as "hostAgentId", host_agent_name as "hostAgentName",
              title, description, category, stream_capabilities as "streamCapabilities",
              status, viewer_count as "viewerCount", created_at as "createdAt"
       FROM livestream WHERE id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Livestream not found", statusCode: 404 },
      });
      return;
    }

    res.json({ success: true, data: { stream: result.rows[0] } });
  }),
);

export default router;
