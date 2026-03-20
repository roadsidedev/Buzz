import { Router, Request, Response } from "express";
import { asyncHandler } from "../middleware/error-handler.js";
import { requireAnyAuth } from "../middleware/any-auth.js";
import { db } from "../config/database.js";
import { logger } from "../utils/logger.js";
import { v4 as uuidv4 } from "uuid";

const router = Router();

/**
 * Helper to get agent/user ID from request
 */
function getAuthId(req: Request): string {
  const id = req.agent?.id || req.user?.agentId;
  return id ? String(id) : "";
}

/**
 * Interaction Routes
 *
 * REST endpoints for social interactions:
 * - POST /api/v1/interactions/like       — Like an item
 * - POST /api/v1/interactions/unlike     — Unlike an item
 * - POST /api/v1/interactions/save       — Save an item
 * - POST /api/v1/interactions/unsave     — Unsave an item
 * - GET  /api/v1/interactions/mine       — Get current user's interactions
 */

/**
 * POST /api/v1/interactions/like
 */
router.post(
  "/like",
  requireAnyAuth,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const agentId = getAuthId(req);
    const { itemId, itemType = "room" } = req.body;

    if (!itemId) {
      res.status(400).json({ success: false, error: "itemId required" });
      return;
    }

    try {
      await db.query(
        `INSERT INTO interaction (id, agent_id, item_id, item_type, action)
         VALUES ($1, $2, $3, $4, 'like')
         ON CONFLICT (agent_id, item_id, action) DO NOTHING`,
        [uuidv4(), agentId, itemId, itemType]
      );

      res.json({ success: true });
    } catch (err) {
      logger.error("Like interaction failed", { error: err, agentId, itemId });
      res.status(500).json({ success: false, error: "Database error" });
    }
  }),
);

/**
 * POST /api/v1/interactions/unlike
 */
router.post(
  "/unlike",
  requireAnyAuth,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const agentId = getAuthId(req);
    const { itemId } = req.body;

    await db.query(
      "DELETE FROM interaction WHERE agent_id = $1 AND item_id = $2 AND action = 'like'",
      [agentId, itemId]
    );

    res.json({ success: true });
  }),
);

/**
 * POST /api/v1/interactions/save
 */
router.post(
  "/save",
  requireAnyAuth,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const agentId = getAuthId(req);
    const { itemId, itemType = "room" } = req.body;

    if (!itemId) {
      res.status(400).json({ success: false, error: "itemId required" });
      return;
    }

    await db.query(
      `INSERT INTO interaction (id, agent_id, item_id, item_type, action)
       VALUES ($1, $2, $3, $4, 'save')
       ON CONFLICT (agent_id, item_id, action) DO NOTHING`,
      [uuidv4(), agentId, itemId, itemType]
    );

    res.json({ success: true });
  }),
);

/**
 * POST /api/v1/interactions/unsave
 */
router.post(
  "/unsave",
  requireAnyAuth,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const agentId = getAuthId(req);
    const { itemId } = req.body;

    await db.query(
      "DELETE FROM interaction WHERE agent_id = $1 AND item_id = $2 AND action = 'save'",
      [agentId, itemId]
    );

    res.json({ success: true });
  }),
);

/**
 * GET /api/v1/interactions/mine
 * Fetch all likes and saves for the current user
 */
router.get(
  "/mine",
  requireAnyAuth,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const agentId = getAuthId(req);

    const result = await db.query(
      "SELECT item_id, item_type, action FROM interaction WHERE agent_id = $1",
      [agentId]
    );

    const likes = result.rows.filter(r => r.action === 'like').map(r => r.item_id);
    const saves = result.rows.filter(r => r.action === 'save').map(r => ({ id: r.item_id, type: r.item_type }));

    res.json({
      success: true,
      data: { likes, saves }
    });
  }),
);

/**
 * GET /api/v1/interactions/saved-details
 * Fetch detailed info for saved items
 */
router.get(
  "/saved-details",
  requireAnyAuth,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const agentId = getAuthId(req);

    const result = await db.query(
      "SELECT item_id, item_type FROM interaction WHERE agent_id = $1 AND action = 'save'",
      [agentId]
    );

    const detailedSaves = [];

    for (const row of result.rows) {
      let details = { id: row.item_id, type: row.item_type, title: "Unknown Item" };
      
      try {
        if (row.item_type === 'room') {
          const roomRes = await db.query("SELECT title FROM room WHERE id = $1", [row.item_id]);
          if (roomRes.rows[0]) details.title = roomRes.rows[0].title;
        } else if (row.item_type === 'podcast') {
          const podRes = await db.query("SELECT title FROM podcast WHERE id = $1", [row.item_id]);
          if (podRes.rows[0]) details.title = podRes.rows[0].title;
        } else if (row.item_type === 'livestream') {
          const streamRes = await db.query("SELECT title FROM livestream WHERE id = $1", [row.item_id]);
          if (streamRes.rows[0]) details.title = streamRes.rows[0].title;
        }
      } catch (err) {
        logger.error("Failed to fetch saved item details", { itemId: row.item_id, error: err });
      }
      
      detailedSaves.push(details);
    }

    res.json({
      success: true,
      data: { saves: detailedSaves }
    });
  }),
);

/**
 * GET /api/v1/interactions/:itemId
 * Get counts for a specific item
 */
router.get(
  "/:itemId",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { itemId } = req.params;

    const result = await db.query(
      "SELECT action, COUNT(*) as count FROM interaction WHERE item_id = $1 GROUP BY action",
      [itemId]
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
