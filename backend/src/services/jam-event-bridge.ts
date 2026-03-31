/**
 * Jam Event Bridge
 *
 * Redis-based event bridge for communication between Beely and Jam services.
 * Replaces webhook-based events with real-time pub/sub.
 *
 * Event Flow:
 * 1. Pantry publishes events to 'jam:events' channel
 * 2. Beely backend subscribes and handles events
 * 3. Beely can publish to 'beely:room:events' for Pantry
 */

import Redis from "ioredis";
import logger from "../utils/logger.js";

export type JamEventType =
  | "room_created"
  | "room_ended"
  | "peer_joined"
  | "peer_left"
  | "audio_started"
  | "audio_ended"
  | "turn_started"
  | "turn_ended"
  | "room_closing"
  | "turn_selected";

export interface JamEvent {
  type: JamEventType;
  roomId: string;
  peerId?: string;
  agentId?: string;
  data?: Record<string, unknown>;
  timestamp: number;
}

export type JamEventHandler = (event: JamEvent) => void | Promise<void>;

export interface JamEventBridgeConfig {
  redisUrl: string;
  channels?: {
    jamEvents?: string;
    beelyEvents?: string;
  };
}

/**
 * Jam Event Bridge
 *
 * Manages Redis pub/sub for Jam events
 */
export class JamEventBridge {
  private redis: Redis;
  private subscriber: Redis;
  private handlers: Map<JamEventType, Set<JamEventHandler>> = new Map();
  private jamChannel: string;
  private beelyChannel: string;
  private isConnected: boolean = false;

  constructor(config: JamEventBridgeConfig) {
    this.jamChannel = config.channels?.jamEvents || "jam:events";
    this.beelyChannel = config.channels?.beelyEvents || "beely:room:events";

    this.redis = new Redis(config.redisUrl);
    this.subscriber = new Redis(config.redisUrl);

    this.subscriber.on("connect", () => {
      logger.info("JamEventBridge connected to Redis");
      this.isConnected = true;
    });

    this.subscriber.on("error", (error: Error) => {
      logger.error("JamEventBridge Redis error", { error: error.message });
    });

    this.subscriber.on("message", (channel: string, message: string) => {
      if (channel === this.jamChannel) {
        this.handleJamEvent(message);
      }
    });
  }

  /**
   * Subscribe to Jam events channel
   */
  async subscribe(): Promise<void> {
    try {
      await this.subscriber.subscribe(this.jamChannel);
      logger.info("Subscribed to Jam events channel", {
        channel: this.jamChannel,
      });
    } catch (error) {
      logger.error("Failed to subscribe to Jam events", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Unsubscribe from Jam events
   */
  async unsubscribe(): Promise<void> {
    try {
      await this.subscriber.unsubscribe(this.jamChannel);
      logger.info("Unsubscribed from Jam events channel");
    } catch (error) {
      logger.error("Failed to unsubscribe from Jam events", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Register handler for specific event type
   */
  on(eventType: JamEventType, handler: JamEventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
    logger.debug("Registered Jam event handler", { eventType });
  }

  /**
   * Remove handler for specific event type
   */
  off(eventType: JamEventType, handler: JamEventHandler): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
      logger.debug("Removed Jam event handler", { eventType });
    }
  }

  /**
   * Handle incoming Jam event
   */
  private async handleJamEvent(message: string): Promise<void> {
    try {
      const event = JSON.parse(message) as JamEvent;

      logger.debug("Received Jam event", {
        type: event.type,
        roomId: event.roomId,
        peerId: event.peerId,
      });

      const handlers = this.handlers.get(event.type);
      if (handlers) {
        for (const handler of handlers) {
          try {
            await handler(event);
          } catch (error) {
            logger.error("Error in Jam event handler", {
              eventType: event.type,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }
    } catch (error) {
      logger.error("Failed to handle Jam event", {
        error: error instanceof Error ? error.message : String(error),
        message: message.slice(0, 100),
      });
    }
  }

  /**
   * Publish event to Beely channel (for Pantry to consume)
   */
  async publish(event: JamEvent): Promise<void> {
    try {
      const message = JSON.stringify(event);
      await this.redis.publish(this.beelyChannel, message);

      logger.debug("Published event to Beely channel", {
        type: event.type,
        roomId: event.roomId,
      });
    } catch (error) {
      logger.error("Failed to publish event", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Publish event directly to Jam channel (for testing)
   */
  async publishToJam(event: JamEvent): Promise<void> {
    try {
      const message = JSON.stringify(event);
      await this.redis.publish(this.jamChannel, message);

      logger.debug("Published event to Jam channel", {
        type: event.type,
        roomId: event.roomId,
      });
    } catch (error) {
      logger.error("Failed to publish to Jam channel", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get connection status
   */
  isReady(): boolean {
    return this.isConnected;
  }

  /**
   * Disconnect and cleanup
   */
  async disconnect(): Promise<void> {
    await this.unsubscribe();
    this.redis.disconnect();
    this.subscriber.disconnect();
    logger.info("JamEventBridge disconnected");
  }

  /**
   * Get event history (requires Redis Streams - optional)
   */
  async getEventHistory(
    roomId: string,
    count: number = 50,
  ): Promise<JamEvent[]> {
    try {
      const key = `jam:events:${roomId}`;
      const events = await this.redis.lrange(key, 0, count - 1);

      return events.map((e: string) => JSON.parse(e) as JamEvent);
    } catch (error) {
      logger.error("Failed to get event history", {
        roomId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Store event in history (optional)
   */
  async storeEvent(event: JamEvent): Promise<void> {
    try {
      const key = `jam:events:${event.roomId}`;
      await this.redis.lpush(key, JSON.stringify(event));
      await this.redis.ltrim(key, 0, 99); // Keep last 100 events
    } catch (error) {
      logger.error("Failed to store event", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

// Singleton instance
let eventBridgeInstance: JamEventBridge | null = null;

/**
 * Create Jam Event Bridge
 */
export function createJamEventBridge(
  config: JamEventBridgeConfig,
): JamEventBridge {
  if (!eventBridgeInstance) {
    eventBridgeInstance = new JamEventBridge(config);
  }
  return eventBridgeInstance;
}

/**
 * Get Jam Event Bridge singleton
 */
export function getJamEventBridge(): JamEventBridge | null {
  return eventBridgeInstance;
}
