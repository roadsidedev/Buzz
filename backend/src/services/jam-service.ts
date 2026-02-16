/**
 * Jam Service
 * Real-time audio room creation and management via Jam API
 *
 * Handles:
 * - Room creation upon successful payment
 * - Audio streaming setup
 * - Participant management
 * - Webhook event processing
 */

import logger from "../utils/logger.js";
import { ValidationError } from "../utils/errors.js";

export interface JamRoomConfig {
  title: string;
  description?: string;
  hostId: string;
  roomType: "debate" | "coding" | "trading" | "research";
  maxParticipants?: number;
  metadata?: Record<string, unknown>;
}

export interface JamRoomResponse {
  roomId: string;
  roomUrl: string;
  createdAt: Date;
  status: "created" | "active" | "ended";
}

export interface JamWebhookEvent {
  roomId: string;
  event: "room_started" | "room_ended" | "user_joined" | "user_left";
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/**
 * Jam Service
 * Manages real-time audio room lifecycle
 */
export class JamService {
  private apiUrl: string;
  private apiKey: string;

  constructor(apiUrl: string, apiKey: string) {
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;

    if (!apiUrl || !apiKey) {
      logger.warn("JamService initialized with missing configuration", {
        hasUrl: !!apiUrl,
        hasKey: !!apiKey,
      });
    }
  }

  /**
   * Create a new Jam audio room
   *
   * Called after x402 payment confirmation to spawn the room
   * and start accepting participants.
   *
   * @param roomId - ClawZz room ID
   * @param config - Room configuration
   * @returns Jam room details
   * @throws ValidationError if config invalid
   */
  async createRoom(roomId: string, config: JamRoomConfig): Promise<JamRoomResponse> {
    if (!roomId || !config.title) {
      throw new ValidationError("Missing required room parameters", {
        roomId,
        title: config.title,
      });
    }

    if (config.title.length < 5 || config.title.length > 200) {
      throw new ValidationError("Room title must be 5-200 characters", {
        provided: config.title.length,
      });
    }

    try {
      logger.info("Creating Jam room", {
        roomId,
        title: config.title,
        type: config.roomType,
      });

      // Call Jam API to create room
      const response = await fetch(`${this.apiUrl}/rooms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          externalId: roomId, // Link to ClawZz room
          name: config.title,
          description: config.description || "",
          roomType: config.roomType,
          maxParticipants: config.maxParticipants || 50,
          metadata: {
            ...config.metadata,
            createdBy: config.hostId,
            platform: "clawzz",
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error("Jam API error", {
          roomId,
          status: response.status,
          error,
        });
        throw new Error(`Jam API error: ${response.status} - ${error}`);
      }

      const data = await response.json() as {
        id: string;
        url: string;
        createdAt: string;
      };

      logger.info("Jam room created", {
        roomId,
        jamRoomId: data.id,
        url: data.url,
      });

      return {
        roomId: data.id,
        roomUrl: data.url,
        createdAt: new Date(data.createdAt),
        status: "created",
      };
    } catch (err) {
      logger.error("Failed to create Jam room", {
        roomId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  /**
   * End a Jam audio room
   *
   * Called when room is closed on ClawZz side.
   * Stops accepting participants and archives recording.
   *
   * @param jamRoomId - Jam room ID
   * @throws Error if API call fails
   */
  async endRoom(jamRoomId: string): Promise<void> {
    if (!jamRoomId) {
      throw new ValidationError("Missing Jam room ID");
    }

    try {
      logger.info("Ending Jam room", { jamRoomId });

      const response = await fetch(`${this.apiUrl}/rooms/${jamRoomId}/end`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error("Failed to end Jam room", {
          jamRoomId,
          status: response.status,
          error,
        });
        throw new Error(`Failed to end Jam room: ${response.status}`);
      }

      logger.info("Jam room ended", { jamRoomId });
    } catch (err) {
      logger.error("Error ending Jam room", {
        jamRoomId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  /**
   * Get room status
   *
   * @param jamRoomId - Jam room ID
   * @returns Room status
   */
  async getRoomStatus(jamRoomId: string): Promise<string> {
    try {
      const response = await fetch(`${this.apiUrl}/rooms/${jamRoomId}`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        logger.warn("Failed to get room status", {
          jamRoomId,
          status: response.status,
        });
        return "unknown";
      }

      const data = await response.json() as { status: string };
      return data.status;
    } catch (err) {
      logger.error("Error getting room status", {
        jamRoomId,
        error: err instanceof Error ? err.message : String(err),
      });
      return "error";
    }
  }

  /**
   * Validate webhook signature from Jam
   *
   * @param payload - Raw webhook body
   * @param signature - X-Jam-Signature header
   * @returns true if signature valid
   */
  validateWebhookSignature(payload: string, signature: string): boolean {
    try {
      // TODO: Implement HMAC signature verification
      // For now, accept all (placeholder)
      logger.debug("Webhook signature validation (placeholder)", {
        hasPayload: !!payload,
        hasSignature: !!signature,
      });
      return true;
    } catch (err) {
      logger.error("Webhook signature validation error", {
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }

  /**
   * Health check: verify Jam API is reachable
   *
   * @returns true if Jam API is accessible
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/health`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });
      return response.ok;
    } catch (err) {
      logger.warn("Jam health check failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }
}

/**
 * Factory function to create Jam service
 *
 * @returns Initialized Jam service
 */
export function createJamService(): JamService {
  const apiUrl = process.env.JAM_URL || "http://localhost:3001";
  const apiKey = process.env.JAM_API_KEY || "jam-dev-key";

  return new JamService(apiUrl, apiKey);
}

// Singleton instance
let jamServiceInstance: JamService | null = null;

export function getJamService(): JamService {
  if (!jamServiceInstance) {
    jamServiceInstance = createJamService();
  }
  return jamServiceInstance;
}
