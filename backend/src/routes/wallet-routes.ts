/**
 * Wallet Routes
 *
 * REST endpoints for USDC wallet management:
 * - GET  /api/v1/wallet/balance   — Get agent's USDC balance
 * - POST /api/v1/wallet/deposit   — Deposit USDC to wallet
 * - POST /api/v1/wallet/tip       — Tip another agent
 * - GET  /api/v1/wallet/tips      — Get tip history
 */

import { Router, Request, Response } from "express";
import { asyncHandler } from "../middleware/index.js";
import { requireAnyAuth } from "../middleware/any-auth.js";
import { logger } from "../utils/logger.js";
import { pool } from "../config/database.js";
import crypto from "crypto";

const router = Router();

/**
 * GET /api/v1/wallet/balance
 * Get the authenticated agent's USDC balance.
 */
router.get(
  "/balance",
  requireAnyAuth,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const agentId = req.agent!.id;

    const result = await pool.query(
      "SELECT usdc_balance FROM agent WHERE id = $1",
      [agentId],
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: { code: "AGENT_NOT_FOUND", message: "Agent not found", statusCode: 404 },
      });
      return;
    }

    const balance = parseFloat(result.rows[0].usdc_balance) || 0;

    res.json({
      success: true,
      data: { balance: balance.toFixed(6) },
    });
  }),
);

/**
 * POST /api/v1/wallet/deposit
 * Record a USDC deposit and update the agent's balance.
 */
router.post(
  "/deposit",
  requireAnyAuth,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const agentId = req.agent!.id;
    const { amount, token = "USDC", txHash } = req.body;

    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_AMOUNT", message: "amount must be a positive number", statusCode: 400 },
      });
      return;
    }

    if (parsedAmount > 10000) {
      res.status(400).json({
        success: false,
        error: { code: "AMOUNT_TOO_LARGE", message: "Maximum single deposit is $10,000 USDC", statusCode: 400 },
      });
      return;
    }

    const updateResult = await pool.query(
      `UPDATE agent
       SET usdc_balance = usdc_balance + $1, updated_at = NOW()
       WHERE id = $2
       RETURNING usdc_balance`,
      [parsedAmount, agentId],
    );

    if (updateResult.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: { code: "AGENT_NOT_FOUND", message: "Agent not found", statusCode: 404 },
      });
      return;
    }

    const newBalance = parseFloat(updateResult.rows[0].usdc_balance);

    const depositTxHash = txHash || `deposit-${crypto.randomBytes(16).toString("hex")}`;
    await pool.query(
      `INSERT INTO payment (
        from_agent_id, to_agent_id, payment_type, status,
        amount, token_address, token_symbol, token_decimals,
        tx_hash, created_at
      ) VALUES ($1, $1, 'subscription', 'completed', $2, '', $3, 6, $4, NOW())
      ON CONFLICT (tx_hash) DO NOTHING`,
      [agentId, parsedAmount, token, depositTxHash],
    );

    logger.info("Wallet deposit recorded", { agentId, amount: parsedAmount, newBalance });

    res.json({
      success: true,
      data: {
        txHash: depositTxHash,
        amount: parsedAmount,
        newBalance: newBalance.toFixed(6),
        token,
      },
    });
  }),
);

/**
 * POST /api/v1/wallet/tip
 * Send a USDC tip from the authenticated agent to a recipient agent.
 */
router.post(
  "/tip",
  requireAnyAuth,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const senderId = req.agent!.id;
    const { recipientId, amount, token = "USDC" } = req.body;

    if (!recipientId) {
      res.status(400).json({
        success: false,
        error: { code: "MISSING_RECIPIENT", message: "recipientId is required", statusCode: 400 },
      });
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_AMOUNT", message: "amount must be a positive number", statusCode: 400 },
      });
      return;
    }

    if (senderId === recipientId) {
      res.status(400).json({
        success: false,
        error: { code: "SELF_TIP", message: "You cannot tip yourself", statusCode: 400 },
      });
      return;
    }

    const recipientResult = await pool.query(
      "SELECT id, name FROM agent WHERE id = $1",
      [recipientId],
    );
    if (recipientResult.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: { code: "RECIPIENT_NOT_FOUND", message: "Recipient agent not found", statusCode: 404 },
      });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const senderResult = await client.query(
        `UPDATE agent
         SET usdc_balance = usdc_balance - $1, updated_at = NOW()
         WHERE id = $2 AND usdc_balance >= $1
         RETURNING usdc_balance`,
        [parsedAmount, senderId],
      );

      if (senderResult.rows.length === 0) {
        await client.query("ROLLBACK");
        res.status(402).json({
          success: false,
          error: { code: "INSUFFICIENT_BALANCE", message: "Insufficient USDC balance", statusCode: 402 },
        });
        return;
      }

      await client.query(
        `UPDATE agent
         SET usdc_balance = usdc_balance + $1, updated_at = NOW()
         WHERE id = $2`,
        [parsedAmount, recipientId],
      );

      const txHash = `tip-${crypto.randomBytes(16).toString("hex")}`;
      await client.query(
        `INSERT INTO payment (
          from_agent_id, to_agent_id, payment_type, status,
          amount, token_address, token_symbol, token_decimals,
          tx_hash, created_at, completed_at
        ) VALUES ($1, $2, 'tip', 'completed', $3, '', $4, 6, $5, NOW(), NOW())`,
        [senderId, recipientId, parsedAmount, token, txHash],
      );

      await client.query("COMMIT");

      const newBalance = parseFloat(senderResult.rows[0].usdc_balance);

      logger.info("Tip sent", { senderId, recipientId, amount: parsedAmount });

      res.json({
        success: true,
        data: {
          txHash,
          amount: parsedAmount,
          recipientId,
          newBalance: newBalance.toFixed(6),
          token,
        },
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }),
);

/**
 * GET /api/v1/wallet/tips
 * Get the authenticated agent's tip history (sent and received).
 */
router.get(
  "/tips",
  requireAnyAuth,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const agentId = req.agent!.id;

    const [sentResult, receivedResult] = await Promise.all([
      pool.query(
        `SELECT p.id, p.to_agent_id as "recipientId", a.name as "recipientName",
                p.amount, p.token_symbol as token, p.tx_hash as "txHash", p.created_at as timestamp
         FROM payment p
         JOIN agent a ON a.id = p.to_agent_id
         WHERE p.from_agent_id = $1 AND p.payment_type = 'tip' AND p.status = 'completed'
         ORDER BY p.created_at DESC
         LIMIT 50`,
        [agentId],
      ),
      pool.query(
        `SELECT p.id, p.from_agent_id as "senderId", a.name as "senderName",
                p.amount, p.token_symbol as token, p.tx_hash as "txHash", p.created_at as timestamp
         FROM payment p
         JOIN agent a ON a.id = p.from_agent_id
         WHERE p.to_agent_id = $1 AND p.payment_type = 'tip' AND p.status = 'completed'
         ORDER BY p.created_at DESC
         LIMIT 50`,
        [agentId],
      ),
    ]);

    res.json({
      success: true,
      data: {
        sent: sentResult.rows,
        received: receivedResult.rows,
      },
    });
  }),
);

export default router;
