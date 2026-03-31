/**
 * Jam Service Factory
 *
 * Factory for creating and managing the Jam V2 (self-hosted) service instance.
 * V1 API-key fallback has been removed; all rooms use the self-hosted pantry
 * with SSR (Ed25519) authentication.
 */

import logger from "../utils/logger.js";
import {
  JamServiceV2,
  JamConfigV2,
  createJamServiceV2,
} from "./jam-service-v2.js";
import {
  createJamEventBridge,
  getJamEventBridge,
  JamEventBridge,
} from "./jam-event-bridge.js";

export interface JamServiceConfig {
  pantryUrl: string;
  sfuEnabled: boolean;
  stunUrl: string;
  turnUrl: string;
  turnSecret: string;
  turnRealm: string;
  redisUrl: string;
}

export type JamServiceType = "v2";

/**
 * Jam Service Factory
 */
export class JamServiceFactory {
  private config: JamServiceConfig;
  private v2Service: JamServiceV2 | null = null;
  private eventBridge: JamEventBridge | null = null;

  constructor(config: JamServiceConfig) {
    this.config = config;
    this.initializeServices();
  }

  private initializeServices(): void {
    const v2Config: JamConfigV2 = {
      pantryUrl: this.config.pantryUrl,
      sfuEnabled: this.config.sfuEnabled,
      stunUrl: this.config.stunUrl,
      turnUrl: this.config.turnUrl,
      turnSecret: this.config.turnSecret,
      turnRealm: this.config.turnRealm,
    };

    this.v2Service = createJamServiceV2(v2Config);

    this.eventBridge = createJamEventBridge({
      redisUrl: this.config.redisUrl,
    });

    logger.info("JamServiceFactory initialized with V2 (self-hosted)", {
      pantryUrl: this.config.pantryUrl,
      sfuEnabled: this.config.sfuEnabled,
    });
  }

  /**
   * Get the Jam V2 service instance.
   */
  getService(): JamServiceV2 {
    if (!this.v2Service) {
      throw new Error(
        "Jam V2 service not initialized. Check PANTRY_URL configuration.",
      );
    }
    return this.v2Service;
  }

  /**
   * Get V2 service specifically (alias of getService).
   */
  getV2Service(): JamServiceV2 | null {
    return this.v2Service;
  }

  /**
   * Get event bridge
   */
  getEventBridge(): JamEventBridge | null {
    return this.eventBridge;
  }

  /**
   * Always "v2" — V1 fallback has been removed.
   */
  getServiceType(): JamServiceType {
    return "v2";
  }

  /**
   * Check if service is configured
   */
  isConfigured(): boolean {
    return this.v2Service !== null;
  }

  /**
   * Subscribe to Jam events
   */
  async subscribeToEvents(): Promise<void> {
    if (this.eventBridge) {
      await this.eventBridge.subscribe();
    }
  }

  /**
   * Disconnect all services
   */
  async disconnect(): Promise<void> {
    if (this.eventBridge) {
      await this.eventBridge.disconnect();
    }
  }
}

// Singleton instance
let factoryInstance: JamServiceFactory | null = null;

/**
 * Create Jam Service Factory
 */
export function createJamServiceFactory(
  config: JamServiceConfig,
): JamServiceFactory {
  if (!factoryInstance) {
    factoryInstance = new JamServiceFactory(config);
  }
  return factoryInstance;
}

/**
 * Get Jam Service Factory singleton
 */
export function getJamServiceFactory(): JamServiceFactory | null {
  return factoryInstance;
}

/**
 * Get Jam V2 Service (convenience function)
 */
export function getJam(): JamServiceV2 {
  const factory = getJamServiceFactory();
  if (!factory) {
    throw new Error(
      "JamServiceFactory not initialized. Call initializeJamServiceFactory first.",
    );
  }
  return factory.getService();
}

/**
 * Initialize Jam Service Factory from environment
 */
export function initializeJamServiceFactory(): JamServiceFactory {
  const config: JamServiceConfig = {
    // Pantry defaults to port 3001 (see jam/pantry/bin/www)
    pantryUrl: process.env.PANTRY_URL || "http://localhost:3001",
    sfuEnabled: process.env.JAM_SFU_ENABLED !== "false",
    stunUrl: process.env.VITE_STUN_URL || "stun:localhost:3478",
    turnUrl: process.env.VITE_TURN_URL || "turn:localhost:3478",
    turnSecret: process.env.COTURN_SECRET || "",
    turnRealm: process.env.COTURN_REALM || "beely-live.vercel.app",
    redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  };

  return createJamServiceFactory(config);
}
