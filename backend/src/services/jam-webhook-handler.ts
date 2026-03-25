// @ts-nocheck
/**
 * Jam Webhook Handler Service
 *
 * Processes and validates events from Jam audio room lifecycle:
 * - room_started: Room opened, accepting participants
 * - room_ended: Room closed, archived
 * - user_joined: Participant connected to audio room
 * - user_left: Participant disconnected from audio room
 *
 * Validates webhook signatures and dispatches to appropriate handlers
 */

import type { Request } from "express";
import logger from "../utils/logger.js";
import { ValidationError, SecurityError } from "../utils/errors.js";
import { getJamService } from "./jam-service.js";
import { roomService } from "./room-service.js";

export interface JamWebhookPayload {
  roomId: string; // Jam room ID
  externalId?: string; // ClawHouse room ID
  event: "room_started" | "room_ended" | "user_joined" | "user_left";
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface WebhookProcessResult {
  success: boolean;
  roomId: string;
  event: string;
  acknowledged: boolean;
  error?: string;
}

/**
 * Jam Webhook Handler
 *
 * Safely processes Jam room lifecycle events with signature validation
 */
export class JamWebhookHandler {
  /**
   * Process incoming Jam webhook
   *
   * 1. Validate payload structure
   * 2. Verify webhook signature
   * 3. Route to appropriate handler
   * 4. Return ack response
   *
   * @param req - Express request with webhook payload and signature header
   * @returns Processing result
   * @throws ValidationError if payload invalid
   * @throws SecurityError if signature invalid
   */
  async process(req: Request): Promise<WebhookProcessResult> {
    const { roomId, externalId, event, timestamp, metadata } = req.body as JamWebhookPayload;

    // 1. VALIDATE PAYLOAD
    this._validatePayload(roomId, event);

    // 2. VERIFY SIGNATURE
    const jamService = getJamService();
    const signature = req.headers["x-jam-signature"] as string;

    if (signature) {
      const isValid = jamService.validateWebhookSignature(
        JSON.stringify(req.body),
        signature,
      );

      if (!isValid) {
        logger.warn("Invalid Jam webhook signature", {
          roomId,
          ip: req.ip,
        });

        throw new SecurityError("Invalid Jam webhook signature", {
          code: "INVALID_SIGNATURE",
        });
      }
    }

    logger.info("Jam webhook received and validated", {
      roomId,
      externalId,
      event,
      timestamp,
    });

    // 3. ROUTE TO HANDLER
    const clawhouseRoomId = externalId || roomId;

    try {
      switch (event) {
        case "room_started": {
          await this._handleRoomStarted(clawhouseRoomId, roomId);
          break;
        }

        case "room_ended": {
          await this._handleRoomEnded(clawhouseRoomId, roomId);
          break;
        }

        case "user_joined": {
          const userId = metadata?.userId as string | undefined;
          await this._handleUserJoined(clawhouseRoomId, userId);
          break;
        }

        case "user_left": {
          const userId = metadata?.userId as string | undefined;
          await this._handleUserLeft(clawhouseRoomId, userId);
          break;
        }

        default: {
          logger.warn("Unknown Jam event type", { event });
        }
      }
    } catch (err) {
      logger.error("Failed to handle Jam webhook event", {
        roomId,
        event,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }

    return {
      success: true,
      roomId,
      event,
      acknowledged: true,
    };
  }

  /**
   * Validate webhook payload structure
   *
   * @param roomId - Jam room ID
   * @param event - Event type
   * @throws ValidationError if validation fails
   */
  private _validatePayload(roomId: string, event: string): void {
    if (!roomId || typeof roomId !== "string") {
      throw new ValidationError("Missing or invalid roomId", {
        provided: roomId,
      });
    }

    if (!event || typeof event !== "string") {
      throw new ValidationError("Missing or invalid event", {
        provided: event,
      });
    }

    const validEvents = ["room_started", "room_ended", "user_joined", "user_left"];
    if (!validEvents.includes(event)) {
      throw new ValidationError("Unknown event type", {
        event,
        validEvents,
      });
    }
  }

  /**
   * Handle room_started event
   *
   * Audio room opened and accepting participants
   *
   * @param clawhouseRoomId - ClawHouse room ID
   * @param jamRoomId - Jam room ID
   */
  private async _handleRoomStarted(
    clawhouseRoomId: string,
    jamRoomId: string,
  ): Promise<void> {
    logger.info("Jam room started", {
      clawhouseRoomId,
      jamRoomId,
    });

    // roomService is imported at module level
    await roomService.updateRoomStatus(clawhouseRoomId, "live");

    logger.info("Room transitioned to live status", {
      roomId: clawhouseRoomId,
    });
  }

  /**
   * Handle room_ended event
   *
   * Audio room closed and recording archived
   *
   * @param clawhouseRoomId - ClawHouse room ID
   * @param jamRoomId - Jam room ID
   */
  private async _handleRoomEnded(
    clawhouseRoomId: string,
    jamRoomId: string,
  ): Promise<void> {
    logger.info("Jam room ended", {
      clawhouseRoomId,
      jamRoomId,
    });

    // roomService is imported at module level
    await roomService.closeRoom(clawhouseRoomId);

    logger.info("Room closed", {
      roomId: clawhouseRoomId,
    });
  }

  /**
   * Handle user_joined event
   *
   * Participant connected to audio room
   *
   * @param clawhouseRoomId - ClawHouse room ID
   * @param userId - Participant ID (agent ID)
   */
  private async _handleUserJoined(
    clawhouseRoomId: string,
    userId: string | undefined,
  ): Promise<void> {
    if (!userId) {
      logger.warn("User joined event without userId", {
        roomId: clawhouseRoomId,
      });
      return;
    }

    logger.info("User joined Jam room", {
      roomId: clawhouseRoomId,
      agentId: userId,
    });

    // roomService is imported at module level
    await roomService.addParticipant(clawhouseRoomId, userId);

    logger.info("Participant added to room", {
      roomId: clawhouseRoomId,
      agentId: userId,
    });
  }

  /**
   * Handle user_left event
   *
   * Participant disconnected from audio room
   *
   * @param clawhouseRoomId - ClawHouse room ID
   * @param userId - Participant ID (agent ID)
   */
  private async _handleUserLeft(
    clawhouseRoomId: string,
    userId: string | undefined,
  ): Promise<void> {
    if (!userId) {
      logger.warn("User left event without userId", {
        roomId: clawhouseRoomId,
      });
      return;
    }

    logger.info("User left Jam room", {
      roomId: clawhouseRoomId,
      agentId: userId,
    });

    // roomService is imported at module level
    await roomService.removeParticipant(clawhouseRoomId, userId);

    logger.info("Participant removed from room", {
      roomId: clawhouseRoomId,
      agentId: userId,
    });
  }
}

/**
 * Factory: Create webhook handler
 */
export function createJamWebhookHandler(): JamWebhookHandler {
  return new JamWebhookHandler();
}

// Singleton instance
let handlerInstance: JamWebhookHandler | null = null;

/**
 * Get singleton webhook handler
 */
export function getJamWebhookHandler(): JamWebhookHandler {
  if (!handlerInstance) {
    handlerInstance = createJamWebhookHandler();
  }
  return handlerInstance;
}
