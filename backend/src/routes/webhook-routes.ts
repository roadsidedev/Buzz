// @ts-nocheck
/**
 * Webhook Routes
 *
 * Handles incoming webhooks from external services:
 * - x402 payment confirmations
 * - Future: Jam room events, Orchestrator notifications
 *
 * Phase 2 (Day 4): 7.6 - Implement payment webhook handling
 */

import { Router, Request, Response } from "express";
import { RoomStatus } from "@common/types/index";
import { getX402PaymentService } from "../services/x402-payment-service.js";
import { getJamService } from "../services/jam-service.js";
import { getJamWebhookHandler } from "../services/jam-webhook-handler.js";
import { roomService } from "../services/room-service.js";
import { paymentRepository } from "../repositories/payment-repository.js";
import { logger } from "../utils/logger.js";
import { asyncHandler } from "../middleware/index.js";
import { SecurityError } from "../utils/errors.js";

const router = Router();

/**
 * POST /webhooks/payment
 *
 * Handles payment status updates from x402
 *
 * Request body:
 * {
 *   "paymentId": "uuid",
 *   "status": "confirmed|failed|pending",
 *   "txHash": "0x...",
 *   "blockNumber": 12345,
 *   "timestamp": 1234567890
 * }
 */
router.post(
  "/webhooks/payment",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const signature = req.headers["x-x402-signature"];
    const body = JSON.stringify(req.body);

    if (!signature || typeof signature !== "string") {
      throw new SecurityError("Missing x-x402-signature header", {
        code: "MISSING_SIGNATURE",
      });
    }

    const paymentService = getX402PaymentService();

    // Verify webhook signature
    if (!paymentService.verifyWebhookSignature(body, signature)) {
      logger.warn("Invalid webhook signature", {
        ip: req.ip,
        signature: signature.slice(0, 20) + "...",
      });

      throw new SecurityError("Invalid webhook signature", {
        code: "INVALID_SIGNATURE",
      });
    }

    // Parse payment update
    const { paymentId, status, txHash, blockNumber } = req.body;

    if (!paymentId || !status) {
      logger.warn("Invalid webhook payload", { paymentId, status });
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_PAYLOAD",
          message: "Missing paymentId or status",
        },
      });
      return;
    }

    try {
      // Process the webhook update
      await paymentService.processWebhookPayment(paymentId, status, txHash);

      // If payment confirmed, update room status to 'live'
      if (status === "confirmed") {
        try {
          const payment = await paymentRepository.getById(paymentId);
          if (payment && payment.roomId) {
            await roomService.updateRoomStatus(payment.roomId, RoomStatus.LIVE);

            logger.info("Room activated after payment confirmation", {
              roomId: payment.roomId,
              paymentId,
              txHash: txHash ? `${txHash.slice(0, 10)}...` : undefined,
            });
          }
        } catch (roomErr) {
          logger.error("Failed to activate room after payment confirmation", {
            paymentId,
            error: roomErr instanceof Error ? roomErr.message : String(roomErr),
          });
          // Don't fail the webhook - log and continue
        }
      }

      logger.info("Payment webhook processed", {
        paymentId,
        status,
        blockNumber,
      });

      res.json({
        success: true,
        data: {
          paymentId,
          acknowledged: true,
        },
      });
    } catch (err) {
      logger.error("Failed to process payment webhook", {
        paymentId,
        error: err instanceof Error ? err.message : String(err),
      });

      res.status(500).json({
        success: false,
        error: {
          code: "WEBHOOK_PROCESSING_ERROR",
          message: "Failed to process webhook",
        },
      });
    }
  }),
);

/**
 * POST /webhooks/jam
 *
 * Handles room lifecycle events from Jam audio system
 *
 * Events:
 * - room_started: Audio room opened, accepting participants
 * - room_ended: Audio room closed, archived
 * - user_joined: Participant connected
 * - user_left: Participant disconnected
 *
 * Request body:
 * {
 *   "roomId": "jam_room_id",
 *   "externalId": "clawhouse_room_id",
 *   "event": "room_started|room_ended|user_joined|user_left",
 *   "timestamp": 1234567890,
 *   "metadata": {
 *     "userId": "agent_id",
 *     "userName": "agent_name"
 *   }
 * }
 */
router.post(
  "/webhooks/jam",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const handler = getJamWebhookHandler();
    const result = await handler.process(req);

    res.json({
      success: result.success,
      data: {
        roomId: result.roomId,
        event: result.event,
        acknowledged: result.acknowledged,
      },
    });
  }),
);

/**
 * POST /webhooks/orchestrator
 *
 * Handles orchestration events (message selected, room complete, etc.)
 *
 * Request body:
 * {
 *   "roomId": "uuid",
 *   "event": "message_selected|contract_fulfilled|room_complete",
 *   "data": {}
 * }
 */
router.post(
  "/webhooks/orchestrator",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { roomId, event, data } = req.body;

    if (!roomId || !event) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_PAYLOAD",
          message: "Missing roomId or event",
        },
      });
      return;
    }

    logger.info("Orchestrator webhook received", {
      roomId,
      event,
    });

    // TODO: Handle orchestrator events
    // switch (event) {
    //   case 'message_selected':
    //     await roomService.updateLastMessage(roomId, data.messageId);
    //     break;
    //   case 'contract_fulfilled':
    //     await roomService.fulfillContract(roomId, data.contractId);
    //     break;
    //   case 'room_complete':
    //     await roomService.completeRoom(roomId, data.summary);
    //     break;
    // }

    res.json({
      success: true,
      data: {
        roomId,
        acknowledged: true,
      },
    });
  }),
);

export default router;
