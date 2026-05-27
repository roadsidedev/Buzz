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
import { paymentService } from "../services/payment-service.js";

const router = Router();

/**
 * Helper: build the HLS base URL from env vars with sensible fallback.
 * Prefers HLS_BASE_URL, then derives from RTMP_BASE_URL, then warns.
 */
function getHlsBaseUrl(): string {
  const hlsBase = process.env.HLS_BASE_URL;
  if (hlsBase) return hlsBase.replace(/\/+$/, "");

  const rtmpBase = process.env.RTMP_BASE_URL;
  if (rtmpBase) {
    // Convert rtmp://host:port/app -> https://host[:port]
    let base = rtmpBase
      .replace(/^rtmp:\/\//, "https://")
      .replace(/\/app\/?$/, "")
      .replace(/\/live\/?$/, "")
      .replace(/:1935\/?$/, "");
    // If RTMP was on a non-standard port, it stays in the URL — log a warning
    if (/:\d+$/.test(base)) {
      logger.warn(`RTMP_BASE_URL has non-default port — HLS URL may be incorrect. Set HLS_BASE_URL explicitly.`, {
        rtmpBase,
        derivedHls: base,
      });
    }
    return base;
  }

  logger.error("Neither HLS_BASE_URL nor RTMP_BASE_URL is set — video streaming will not work");
  return "https://buzz-rtmp-server-production.up.railway.app";
}

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
      category, stream_capabilities, status, viewer_count, stream_key,
      last_seen_at, ingest_active, last_ingest_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'live', 0, $8, NOW(), FALSE, NULL)`,
    [
      streamId,
      agent.id,
      agent.username || agent.name || "Unknown Agent",
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

  // SPAWN FEE — waived during trial (first 5 livestreams per agent are free)
  const FREE_LIVESTREAM_TRIAL_LIMIT = 5;
  try {
    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::int AS count FROM livestream WHERE host_agent_id = $1`,
      [agent.id],
    );
    const totalCreated = Number(countResult.rows[0]?.count ?? 0);
    const isTrialStream = totalCreated <= FREE_LIVESTREAM_TRIAL_LIMIT;

    if (!isTrialStream) {
      const agentRow = await pool.query(
        `SELECT erc8004_address FROM agent WHERE id = $1`,
        [agent.id],
      );
      const walletAddress: string | null =
        agentRow.rows[0]?.erc8004_address ?? null;
      if (walletAddress) {
        const payment = await paymentService.chargeSpawnFee(
          agent.id,
          streamId,
          walletAddress,
        );
        await pool.query(
          `UPDATE livestream SET spawn_fee_payment_id = $1 WHERE id = $2`,
          [payment.id, streamId],
        );
        logger.info("Livestream spawn fee charged", {
          streamId,
          paymentId: payment.id,
        });
      } else {
        logger.warn("Livestream spawn fee skipped: no wallet on agent", {
          agentId: agent.id,
        });
      }
    } else {
      logger.info("Trial period: livestream spawn fee waived", {
        agentId: agent.id,
        totalCreated,
        trialLimit: FREE_LIVESTREAM_TRIAL_LIMIT,
      });
    }
  } catch (feeErr) {
    // Non-blocking — livestream is created regardless of fee outcome
    logger.error("Livestream spawn fee charge failed", {
      streamId,
      error: feeErr instanceof Error ? feeErr.message : String(feeErr),
    });
  }

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
      streamServerUrl: process.env.RTMP_BASE_URL || `${getHlsBaseUrl().replace(/^https:\/\//, "rtmp://")}/app`,
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
 * Fetch public livestreams that meet quality criteria:
 * - Currently live streams (any duration)
 * - Ended streams with recording_available=true AND duration >= 2 minutes
 *
 * Streams must have actual recorded content — mock/placeholder streams
 * without recording data are excluded from discovery.
 */
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const category = req.query.category as string | undefined;

    const MIN_DURATION_SECONDS = 120; // 2 minutes minimum for ended streams

    const params: unknown[] = [];
    let categoryClause = "";

    if (category) {
      params.push(category);
      categoryClause = `AND category = $${params.length}`;
    }

    // Only show streams that meet quality criteria:
    // 1. Currently live streams with:
    //    - Recent heartbeat (last_seen_at within 90s)  AND
    //    - Evidence of actual video ingest (ingest_active OR recent last_ingest_at)
    // 2. Ended streams with recording_available = true AND duration >= 2 minutes
    //
    // This prevents the "declared live but static/no video" problem reported for Video Runner.
    const whereClause = `(
      (
        status = 'live'
        AND last_seen_at > NOW() - INTERVAL '90 seconds'
        AND (
          ingest_active = TRUE
          OR last_ingest_at > NOW() - INTERVAL '5 minutes'
        )
      )
      OR (
        status = 'ended'
        AND recording_available = TRUE
        AND recording_started_at IS NOT NULL
        AND recording_ended_at IS NOT NULL
        AND EXTRACT(EPOCH FROM (recording_ended_at - recording_started_at)) >= ${MIN_DURATION_SECONDS}
      )
    ) ${categoryClause}`;

    params.push(limit);

    const hlsBase = getHlsBaseUrl();

    const result = await pool.query(
      `SELECT id, host_agent_id as "hostAgentId", host_agent_name as "hostAgentName",
              title, description, category, stream_capabilities as "streamCapabilities",
              status, viewer_count as "viewerCount", created_at as "createdAt",
              stream_key as "streamKey",
              recording_url as "recordingUrl",
              recording_available as "recordingAvailable",
              recording_started_at as "recordingStartedAt",
              recording_ended_at as "recordingEndedAt",
              ingest_active as "ingestActive",
              last_ingest_at as "lastIngestAt",
              last_seen_at as "lastSeenAt",
              CASE
                WHEN recording_started_at IS NOT NULL AND recording_ended_at IS NOT NULL
                THEN EXTRACT(EPOCH FROM (recording_ended_at - recording_started_at))
                WHEN recording_started_at IS NOT NULL AND status = 'live'
                THEN EXTRACT(EPOCH FROM (NOW() - recording_started_at))
                ELSE 0
              END as "durationSeconds"
       FROM livestream
       WHERE ${whereClause}
       ORDER BY
         CASE WHEN status = 'live' THEN 0 ELSE 1 END,
         viewer_count DESC,
         created_at DESC
       LIMIT $${params.length}`,
      params,
    );

    const streams = result.rows.map((row: any) => ({
      ...row,
      hlsUrl: row.status === "live"
        ? `${hlsBase}/hls/${row.streamKey}.m3u8`
        : row.recordingUrl || null,
      durationSeconds: Math.round(row.durationSeconds || 0),
    }));

    res.json({
      success: true,
      data: { streams },
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
    if (status !== undefined) {
      values.push(status);
      setClauses.push(`status = $${values.length}`);
      // If the stream is being marked ended, clear ingest_active as well
      if (status === "ended") {
        setClauses.push(`ingest_active = FALSE`);
      }
    }

    values.push(id);
    const updatedResult = await pool.query(
      `UPDATE livestream SET ${setClauses.join(", ")}
       WHERE id = $${values.length}
       RETURNING id, host_agent_id as "hostAgentId", host_agent_name as "hostAgentName",
                 title, description, category, status, viewer_count as "viewerCount",
                 ingest_active as "ingestActive", created_at as "createdAt"`,
      values,
    );

    logger.info("Livestream updated", { agentId: agent.id, streamId: id });

    res.json({ success: true, data: { stream: updatedResult.rows[0] } });
  }),
);

/**
 * POST /api/v1/livestreams/:id/view
 * Register a viewer joining the stream — increments viewer_count (no auth required).
 * Returns the updated count so the frontend can sync immediately.
 */
router.post(
  "/:id/view",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE livestream
       SET viewer_count = viewer_count + 1, updated_at = NOW()
       WHERE id = $1 AND status = 'live'
       RETURNING viewer_count as "viewerCount"`,
      [id],
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Livestream not found or not live", statusCode: 404 },
      });
      return;
    }

    res.json({ success: true, data: { viewerCount: result.rows[0].viewerCount } });
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

    const hlsBase = getHlsBaseUrl();

    const result = await pool.query(
      `SELECT id, host_agent_id as "hostAgentId", host_agent_name as "hostAgentName",
              title, description, category, stream_capabilities as "streamCapabilities",
              status, viewer_count as "viewerCount", created_at as "createdAt",
              stream_key as "streamKey",
              recording_url as "recordingUrl",
              recording_available as "recordingAvailable",
              recording_started_at as "recordingStartedAt",
              recording_ended_at as "recordingEndedAt",
              ingest_active as "ingestActive",
              last_ingest_at as "lastIngestAt",
              last_seen_at as "lastSeenAt",
              CASE
                WHEN recording_started_at IS NOT NULL AND recording_ended_at IS NOT NULL
                THEN EXTRACT(EPOCH FROM (recording_ended_at - recording_started_at))
                WHEN recording_started_at IS NOT NULL AND status = 'live'
                THEN EXTRACT(EPOCH FROM (NOW() - recording_started_at))
                ELSE 0
              END as "durationSeconds"
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

    const row = result.rows[0];
    const stream = {
      ...row,
      hlsUrl: row.status === "live"
        ? `${hlsBase}/hls/${row.streamKey}.m3u8`
        : row.recordingUrl || null,
      durationSeconds: Math.round(row.durationSeconds || 0),
    };

    res.json({ success: true, data: { stream } });
  }),
);

/**
 * POST /api/v1/livestreams/:id/heartbeat
 * Keep livestream visible in discovery by updating last_seen_at.
 * Host-only: verifies the requesting agent is the stream host.
 */
router.post(
  "/:id/heartbeat",
  requireApiKey,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const agentId = req.agent?.id;

    const result = await pool.query(
      `UPDATE livestream SET last_seen_at = NOW()
       WHERE id = $1 AND host_agent_id = $2
       RETURNING id`,
      [id, agentId],
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Livestream not found or not host", statusCode: 404 },
      });
      return;
    }

    res.json({ success: true, data: { message: "Heartbeat recorded" } });
  }),
);

/**
 * POST /api/v1/livestreams/:id/ingest-started
 *
 * Called by the video runner after it confirms that the first RTMP publish
 * has succeeded and frames are flowing. This is the definitive "stream is
 * actually broadcasting" signal — separate from heartbeat (presence) and
 * auth-publish (permission-to-publish).
 *
 * Host-only: verifies the requesting agent is the stream host.
 *
 * On success: sets ingest_active = TRUE, last_ingest_at = NOW(), and
 * updates last_seen_at so the stream is immediately visible in discovery.
 */
router.post(
  "/:id/ingest-started",
  requireApiKey,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const agentId = req.agent?.id;

    const result = await pool.query(
      `UPDATE livestream
       SET ingest_active = TRUE,
           last_ingest_at = NOW(),
           last_seen_at = NOW()
       WHERE id = $1 AND host_agent_id = $2
       RETURNING id, ingest_active as "ingestActive"`,
      [id, agentId],
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Livestream not found or not host",
          statusCode: 404,
        },
      });
      return;
    }

    logger.info("Video runner confirmed ingest started", {
      streamId: id,
      agentId,
    });

    res.json({ success: true, data: { ingestActive: result.rows[0].ingestActive } });
  }),
);

/**
 * POST /api/v1/livestreams/auth-publish
 * Called by nginx-rtmp `on_publish` directive when a client attempts to publish.
 * Validates the stream_key (passed as `name` in the RTMP URL path).
 *
 * Returns 200 to allow publish, anything else denies it.
 */
router.post(
  "/auth-publish",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // nginx-rtmp sends these fields in the POST body (urlencoded)
    const streamKey = (req.body?.name as string) || (req.query?.name as string);
    const appName = (req.body?.app as string) || (req.query?.app as string);
    const clientAddr = (req.body?.addr as string) || (req.query?.addr as string) || "unknown";

    if (!streamKey) {
      logger.warn("RTMP publish attempt with missing stream key", { clientAddr });
      res.status(403).send("Forbidden");
      return;
    }

    // Optional but recommended: only allow the "app" application we configured in nginx
    if (appName && appName !== "app") {
      logger.warn("RTMP publish denied: wrong application name", { appName, clientAddr });
      res.status(403).send("Forbidden");
      return;
    }

    try {
      const result = await pool.query<{ id: string; status: string; host_agent_id: string }>(
        `SELECT id, status, host_agent_id FROM livestream WHERE stream_key = $1 LIMIT 1`,
        [streamKey],
      );

      const stream = result.rows[0];

      if (!stream || stream.status !== "live") {
        logger.warn("RTMP publish denied: invalid or inactive stream key", {
          streamKey: streamKey.substring(0, 8) + "...",
          clientAddr,
        });
        res.status(403).send("Forbidden");
        return;
      }

      // Mark as ingesting: this is the critical signal that real video is flowing.
      // Heartbeat alone (presence) is no longer sufficient for "live" in discovery.
      await pool.query(
        `UPDATE livestream
         SET last_seen_at = NOW(),
             ingest_active = TRUE,
             last_ingest_at = NOW()
         WHERE id = $1`,
        [stream.id],
      );

      logger.info("RTMP publish authorized — ingest_active=TRUE", {
        streamId: stream.id,
        hostAgentId: stream.host_agent_id,
        clientAddr,
      });

      res.status(200).send("OK");
    } catch (err) {
      logger.error("Error during RTMP publish auth", {
        error: err instanceof Error ? err.message : String(err),
        clientAddr,
      });
      res.status(500).send("Error");
    }
  }),
);

/**
 * POST /api/v1/livestreams/auth-publish-done
 * Called by nginx-rtmp when a publisher disconnects.
 * We mark the stream as ended (the stale reconciler will also catch it).
 */
router.post(
  "/auth-publish-done",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const streamKey = (req.body?.name as string) || (req.query?.name as string);

    if (streamKey) {
      await pool.query(
        `UPDATE livestream
         SET status = 'ended',
             ingest_active = FALSE,
             updated_at = NOW()
         WHERE stream_key = $1 AND status = 'live'`,
        [streamKey],
      );
    }

    res.status(200).send("OK");
  }),
);

export default router;
