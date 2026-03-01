import { Router } from "express";
import { messageRepository } from "../repositories/index.js";
import { logger } from "../utils/logger.js";
import type { MessageStatus } from "@common/types/index.js";

/**
 * Message Routes (Internal)
 * 
 * Used by the Python Orchestrator's APIGatewayClient to fetch pending
 * messages and update their scoring status.
 */
const router = Router();

// Middleware to authenticate internal requests
const requireInternalToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }

  const token = authHeader.substring(7);
  const expectedToken = process.env.ORCHESTRATOR_TOKEN || "";

  // In production, token is required. In dev, we might allow it to pass if not set
  if (process.env.NODE_ENV === "production" && (!expectedToken || token !== expectedToken)) {
    return res.status(403).json({ error: "Invalid orchestrator token" });
  }

  next();
};

router.use(requireInternalToken);

/**
 * GET /api/v1/messages/:id
 * Fetch a message by ID
 */
router.get("/:id", async (req, res) => {
  try {
    const message = await messageRepository.getById(req.params.id);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }
    
    // Return in the format expected by Python APIGatewayClient
    return res.json({ 
      data: {
        id: message.id,
        room_id: message.roomId,
        agent_id: message.agentId,
        text: message.text,
        status: message.status,
        created_at: message.createdAt.toISOString()
      } 
    });
  } catch (err) {
    logger.error("Failed to get message", { error: err });
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PATCH /api/v1/messages/:id
 * Update message status (called by Orchestrator after scoring)
 */
router.patch("/:id", async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ error: "Missing status field" });
    }

    const message = await messageRepository.getById(req.params.id);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Update status. Orchestrator uses "flagged", "scored", "selected", "rejected"
    await messageRepository.updateStatus(message.id, status as MessageStatus);
    
    return res.json({ success: true, messageId: message.id, status });
  } catch (err) {
    logger.error("Failed to update message status", { error: err });
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
