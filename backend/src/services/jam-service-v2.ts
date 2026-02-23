/**
 * Jam Service V2
 *
 * Self-hosted Jam integration using SSR (Simple Signed Records) authentication.
 * No API key required - uses Ed25519 signatures for all operations.
 *
 * Features:
 * - Room creation with SSR auth
 * - WebSocket connections for real-time
 * - ICE server configuration
 * - Fallback to V1 (API-key) service
 */

import WebSocket, { type Data as WebSocketData } from "ws";
import type { ErrorEvent } from "ws";
import {
  AgentKeyPair,
  signPayload,
  createAuthHeader,
  createAuthToken,
} from "../utils/ssr-auth.js";
import {
  generateTurnCredentials,
  createIceServerConfig,
  TurnCredentials,
} from "../utils/turn-credentials.js";
import logger from "../utils/logger.js";
import { JamService, JamRoomConfig, JamRoomResponse } from "./jam-service.js";

export interface JamRoomV2 {
  id: string;
  name: string;
  description?: string;
  stageOnly: boolean;
  sfuEnabled: boolean;
  createdAt: string;
}

export interface JamConfigV2 {
  pantryUrl: string;
  sfuEnabled: boolean;
  stunUrl: string;
  turnUrl: string;
  turnSecret: string;
  turnRealm: string;
}

export interface WebSocketMessage {
  topic: string;
  type: string;
  payload: unknown;
}

/**
 * Jam Service V2
 *
 * Self-hosted Jam integration with SSR authentication
 */
export class JamServiceV2 {
  private config: JamConfigV2;
  private wsConnections: Map<string, WebSocket> = new Map();
  private fallbackService: JamService | null = null;

  constructor(config: JamConfigV2, fallbackService?: JamService) {
    this.config = config;

    if (fallbackService) {
      this.fallbackService = fallbackService;
    }

    logger.info("JamServiceV2 initialized", {
      pantryUrl: config.pantryUrl,
      sfuEnabled: config.sfuEnabled,
      hasTurnSecret: !!config.turnSecret,
    });
  }

  /**
   * Create a new Jam room with SSR authentication
   */
  async createRoom(
    roomId: string,
    config: JamRoomConfig,
    keyPair: AgentKeyPair,
  ): Promise<JamRoomResponse> {
    try {
      logger.info("Creating Jam room (V2)", {
        roomId,
        title: config.title,
        stageOnly: true,
      });

      const payload = {
        id: roomId,
        name: config.title,
        description: config.description || "",
        stageOnly: true,
        sfu: this.config.sfuEnabled,
        creator: keyPair.publicKeyBase64,
      };

      const signedRecord = await signPayload(keyPair.privateKey, payload);
      const authHeader = createAuthHeader(signedRecord);

      const response = await fetch(
        `${this.config.pantryUrl}/api/v1/rooms/${roomId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader,
          },
          body: JSON.stringify(signedRecord),
        },
      );

      if (!response.ok) {
        const error = await response.text();
        logger.error("Failed to create Jam room (V2)", {
          roomId,
          status: response.status,
          error,
        });

        // Try fallback if available
        if (this.fallbackService) {
          logger.info("Attempting fallback to V1 service");
          return this.fallbackService.createRoom(roomId, config);
        }

        throw new Error(
          `Failed to create Jam room: ${response.status} - ${error}`,
        );
      }

      const data = (await response.json()) as JamRoomV2;

      logger.info("Jam room created (V2)", {
        roomId,
        pantryRoomId: data.id,
        sfuEnabled: data.sfuEnabled,
      });

      return {
        roomId: data.id,
        roomUrl: `${this.config.pantryUrl.replace("/_/pantry", "")}/${data.id}`,
        createdAt: new Date(data.createdAt),
        status: "created",
      };
    } catch (error) {
      logger.error("Error creating Jam room (V2)", {
        roomId,
        error: error instanceof Error ? error.message : String(error),
      });

      // Try fallback if available
      if (this.fallbackService) {
        logger.info("Falling back to V1 service due to error");
        return this.fallbackService.createRoom(roomId, config);
      }

      throw error;
    }
  }

  /**
   * End a Jam room
   */
  async endRoom(roomId: string, keyPair: AgentKeyPair): Promise<void> {
    try {
      logger.info("Ending Jam room (V2)", { roomId });

      const payload = {
        roomId,
        endedBy: keyPair.publicKeyBase64,
        timestamp: Date.now(),
      };

      const signedRecord = await signPayload(keyPair.privateKey, payload);
      const authHeader = createAuthHeader(signedRecord);

      const response = await fetch(
        `${this.config.pantryUrl}/api/v1/rooms/${roomId}/end`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader,
          },
          body: JSON.stringify(signedRecord),
        },
      );

      if (!response.ok) {
        const error = await response.text();
        logger.error("Failed to end Jam room (V2)", {
          roomId,
          status: response.status,
          error,
        });

        // Try fallback
        if (this.fallbackService) {
          return this.fallbackService.endRoom(roomId);
        }

        throw new Error(`Failed to end Jam room: ${response.status}`);
      }

      logger.info("Jam room ended (V2)", { roomId });
    } catch (error) {
      logger.error("Error ending Jam room (V2)", {
        roomId,
        error: error instanceof Error ? error.message : String(error),
      });

      if (this.fallbackService) {
        return this.fallbackService.endRoom(roomId);
      }

      throw error;
    }
  }

  /**
   * Connect agent to room via WebSocket
   */
  async connectAgent(
    roomId: string,
    keyPair: AgentKeyPair,
  ): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      try {
        const token = createAuthToken(keyPair);
        const wsProtocol = this.config.pantryUrl.startsWith("https")
          ? "wss"
          : "ws";
        const wsUrl = this.config.pantryUrl.replace(/^https?/, wsProtocol);

        const ws = new WebSocket(
          `${wsUrl}/_/pantry/${roomId}?id=${keyPair.publicKeyBase64}&token=${token}`,
        );

        ws.on("open", () => {
          this.wsConnections.set(roomId, ws);
          logger.info("WebSocket connected to Jam room", { roomId });
          resolve(ws);
        });

        ws.on("error", (error: Error) => {
          logger.error("WebSocket error", { roomId, error: error.message });
          reject(error);
        });

        ws.on("close", () => {
          this.wsConnections.delete(roomId);
          logger.debug("WebSocket disconnected", { roomId });
        });

        ws.on("message", (data: WebSocketData) => {
          this.handleMessage(roomId, data);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(roomId: string, data: WebSocketData): void {
    try {
      const message = JSON.parse(data.toString()) as WebSocketMessage;
      logger.debug("Received WebSocket message", {
        roomId,
        topic: message.topic,
        type: message.type,
      });

      // Emit to event bridge (handled by JamEventBridge)
      // This will be connected via the factory
    } catch (error) {
      logger.warn("Failed to parse WebSocket message", {
        roomId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Disconnect from room
   */
  disconnect(roomId: string): void {
    const ws = this.wsConnections.get(roomId);
    if (ws) {
      ws.close();
      this.wsConnections.delete(roomId);
      logger.info("Disconnected from Jam room", { roomId });
    }
  }

  /**
   * Send message to room via WebSocket
   */
  sendToRoom(
    roomId: string,
    topic: string,
    type: string,
    payload: unknown,
  ): void {
    const ws = this.wsConnections.get(roomId);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      logger.warn("Cannot send to room: not connected", { roomId });
      return;
    }

    ws.send(JSON.stringify({ topic, type, payload }));
  }

  /**
   * Get ICE servers for WebRTC
   */
  getIceServers(identifier?: string): {
    iceServers: Array<{
      urls: string | string[];
      username?: string;
      credential?: string;
    }>;
    credentials: TurnCredentials | null;
  } {
    return createIceServerConfig({
      stunUrl: this.config.stunUrl,
      turnUrl: this.config.turnUrl,
      turnSecret: this.config.turnSecret,
      turnRealm: this.config.turnRealm,
      identifier,
    });
  }

  /**
   * Get room status
   */
  async getRoomStatus(roomId: string): Promise<string> {
    try {
      const response = await fetch(
        `${this.config.pantryUrl}/api/v1/rooms/${roomId}`,
      );

      if (!response.ok) {
        logger.warn("Failed to get room status (V2)", {
          roomId,
          status: response.status,
        });
        return "unknown";
      }

      const data = (await response.json()) as { status?: string };
      return data.status || "unknown";
    } catch (error) {
      logger.error("Error getting room status (V2)", {
        roomId,
        error: error instanceof Error ? error.message : String(error),
      });
      return "error";
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.pantryUrl}/`);
      return response.ok;
    } catch (error) {
      logger.warn("Jam V2 health check failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Check if fallback is available
   */
  hasFallback(): boolean {
    return this.fallbackService !== null;
  }

  /**
   * Get fallback service
   */
  getFallback(): JamService | null {
    return this.fallbackService;
  }
}

/**
 * Create Jam Service V2
 */
export function createJamServiceV2(
  config: JamConfigV2,
  fallbackService?: JamService,
): JamServiceV2 {
  return new JamServiceV2(config, fallbackService);
}
