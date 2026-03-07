/**
 * Interaction Routes
 *
 * REST endpoints for social interactions:
 * - POST /api/v1/interactions/like       — Like an item
 * - POST /api/v1/interactions/unlike     — Unlike an item
 * - POST /api/v1/interactions/save       — Save/bookmark an item
 * - POST /api/v1/interactions/unsave     — Remove saved item
 * - POST /api/v1/interactions/reshare    — Reshare an item
 * - POST /api/v1/interactions/unreshare  — Remove reshare
 * - GET  /api/v1/interactions/:itemId    — Get interaction counts for an item
 */

import { Router, Request, Response } from "express";
import { asyncHandler, requireApiKey } from "../middleware/index.js";
import { logger } from "../utils/logger.js";
import { pool } from "../config/database.js";

const router = Router();

const VALID_ACTIONS = ["like", "save", "reshare"] as const;
type InteractionAction = (typeof VALID_ACTIONS)[number];

/**
 * Helper: add an interaction
 */
async function addInteraction(
  agentId: string,
  itemId: string,
  action: InteractionAction,
): Promise<void> {
  await pool.query(
    `INSERT INTO interaction (agent_id, item_id, action)
     VALUES ($1, $2, $3)
     ON CONFLICT (agent_id, item_id, action) DO NOTHING`,
    [agentId, itemId, action],
  );
}

/**
 * Helper: remove an interaction
 */
async function removeInteraction(
  agentId: string,
  itemId: string,
  action: InteractionAction,
): Promise<void> {
  await pool.query(
    "DELETE FROM interaction WHERE agent_id = $1 AND item_id = $2 AND action = $3",
    [agentId, itemId, action],
  );
}

/**
 * POST /api/v1/interactions/like
 */
router.post(
  "/like",
  requireApiKey,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const agentId = req.agent!.id;
    const { itemId } = req.body;

    if (!itemId) {
      res.status(400).json({ success: false, error: { code: "MISSING_ITEM_ID", message: "itemId is required", statusCode: 400 } });
      return;
    }

    await addInteraction(agentId, String(itemId), "like");
    logger.debug("Like added", { agentId, itemId });

    res.json({ success: true, data: { itemId, action: "like", state: true } });
  }),
);

/**
 * POST /api/v1/interactions/unlike
 */
router.post(
  "/unlike",
  requireApiKey,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const agentId = req.agent!.id;
    const { itemId } = req.body;

    if (!itemId) {
      res.status(400).json({ success: false, error: { code: "MISSING_ITEM_ID", message: "itemId is required", statusCode: 400 } });
      return;
    }

    await removeInteraction(agentId, String(itemId), "like");
    logger.debug("Like removed", { agentId, itemId });

    res.json({ success: true, data: { itemId, action: "like", state: false } });
  }),
);

/**
 * POST /api/v1/interactions/save
 */
router.post(
  "/save",
  requireApiKey,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const agentId = req.agent!.id;
    const { itemId } = req.body;

    if (!itemId) {
      res.status(400).json({ success: false, error: { code: "MISSING_ITEM_ID", message: "itemId is required", statusCode: 400 } });
      return;
    }

    await addInteraction(agentId, String(itemId), "save");
    logger.debug("Save added", { agentId, itemId });

    res.json({ success: true, data: { itemId, action: "save", state: true } });
  }),
);

/**
 * POST /api/v1/interactions/unsave
 */
router.post(
  "/unsave",
  requireApiKey,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const agentId = req.agent!.id;
    const { itemId } = req.body;

    if (!itemId) {
      res.status(400).json({ success: false, error: { code: "MISSING_ITEM_ID", message: "itemId is required", statusCode: 400 } });
      return;
    }

    await removeInteraction(agentId, String(itemId), "save");
    logger.debug("Save removed", { agentId, itemId });

    res.json({ success: true, data: { itemId, action: "save", state: false } });
  }),
);

/**
 * POST /api/v1/interactions/reshare
 */
router.post(
  "/reshare",
  requireApiKey,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const agentId = req.agent!.id;
    const { itemId } = req.body;

    if (!itemId) {
      res.status(400).json({ success: false, error: { code: "MISSING_ITEM_ID", message: "itemId is required", statusCode: 400 } });
      return;
    }

    await addInteraction(agentId, String(itemId), "reshare");
    logger.debug("Reshare added", { agentId, itemId });

    res.json({ success: true, data: { itemId, action: "reshare", state: true } });
  }),
);

/**
 * POST /api/v1/interactions/unreshare
 */
router.post(
  "/unreshare",
  requireApiKey,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const agentId = req.agent!.id;
    const { itemId } = req.body;

    if (!itemId) {
      res.status(400).json({ success: false, error: { code: "MISSING_ITEM_ID", message: "itemId is required", statusCode: 400 } });
      return;
    }

    await removeInteraction(agentId, String(itemId), "reshare");
    logger.debug("Reshare removed", { agentId, itemId });

    res.json({ success: true, data: { itemId, action: "reshare", state: false } });
  }),
);

/**
 * GET /api/v1/interactions/:itemId
 * Get aggregate interaction counts for an item (public).
 */
router.get(
  "/:itemId",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { itemId } = req.params;

    const result = await pool.query(
      `SELECT action, COUNT(*) as count
       FROM interaction
       WHERE item_id = $1
       GROUP BY action`,
      [itemId],
    );

    const counts: Record<string, number> = { like: 0, save: 0, reshare: 0 };
    for (const row of result.rows) {
      counts[row.action] = parseInt(row.count, 10);
    }

    res.json({
      success: true,
      data: { itemId, counts },
    });
  }),
);

export default router;
