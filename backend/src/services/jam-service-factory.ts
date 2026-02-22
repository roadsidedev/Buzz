/**
 * Jam Service Factory
 *
 * Factory for creating and managing Jam service instances.
 * Handles V1 (API-key) and V2 (SSR) service selection with fallback.
 *
 * Selection Logic:
 * 1. If JAM_SELF_HOSTED_ENABLED=true, use V2
 * 2. If V2 fails and JAM_FALLBACK_ENABLED=true, use V1
 * 3. If neither configured, throw error
 */

import logger from "../utils/logger.js";
import { JamService, createJamService, getJamService } from "./jam-service.js";
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
  selfHostedEnabled: boolean;
  fallbackEnabled: boolean;
  pantryUrl: string;
  sfuEnabled: boolean;
  stunUrl: string;
  turnUrl: string;
  turnSecret: string;
  turnRealm: string;
  redisUrl: string;
  // Legacy V1 config
  jamUrl: string;
  jamApiKey: string;
  jamWebhookSecret: string;
}

export type JamServiceType = "v2" | "v1" | "hybrid";

/**
 * Jam Service Factory
 */
export class JamServiceFactory {
  private config: JamServiceConfig;
  private v2Service: JamServiceV2 | null = null;
  private v1Service: JamService | null = null;
  private eventBridge: JamEventBridge | null = null;

  constructor(config: JamServiceConfig) {
    this.config = config;
    this.initializeServices();
  }

  private initializeServices(): void {
    // Initialize V2 service if self-hosted enabled
    if (this.config.selfHostedEnabled) {
      const v2Config: JamConfigV2 = {
        pantryUrl: this.config.pantryUrl,
        sfuEnabled: this.config.sfuEnabled,
        stunUrl: this.config.stunUrl,
        turnUrl: this.config.turnUrl,
        turnSecret: this.config.turnSecret,
        turnRealm: this.config.turnRealm,
      };

      // Create V1 fallback if enabled
      let fallbackService: JamService | undefined;
      if (this.config.fallbackEnabled && this.config.jamApiKey) {
        fallbackService = new JamService(
          this.config.jamUrl,
          this.config.jamApiKey,
        );
        this.v1Service = fallbackService;
      }

      this.v2Service = createJamServiceV2(v2Config, fallbackService);

      // Initialize event bridge
      this.eventBridge = createJamEventBridge({
        redisUrl: this.config.redisUrl,
      });

      logger.info("JamServiceFactory initialized with V2 (self-hosted)", {
        pantryUrl: this.config.pantryUrl,
        fallbackEnabled: this.config.fallbackEnabled,
      });
    } else if (this.config.jamApiKey) {
      // Use V1 only
      this.v1Service = new JamService(
        this.config.jamUrl,
        this.config.jamApiKey,
      );
      logger.info("JamServiceFactory initialized with V1 (API-key)", {
        jamUrl: this.config.jamUrl,
      });
    } else {
      logger.warn("JamServiceFactory initialized without any service");
    }
  }

  /**
   * Get the appropriate Jam service
   *
   * Returns V2 if self-hosted enabled, otherwise V1
   */
  getService(): JamServiceV2 | JamService {
    if (this.config.selfHostedEnabled && this.v2Service) {
      return this.v2Service;
    }

    if (this.v1Service) {
      return this.v1Service;
    }

    throw new Error(
      "No Jam service configured. Check JAM_SELF_HOSTED_ENABLED or JAM_API_KEY",
    );
  }

  /**
   * Get V2 service specifically
   */
  getV2Service(): JamServiceV2 | null {
    return this.v2Service;
  }

  /**
   * Get V1 service specifically
   */
  getV1Service(): JamService | null {
    return this.v1Service;
  }

  /**
   * Get event bridge
   */
  getEventBridge(): JamEventBridge | null {
    return this.eventBridge;
  }

  /**
   * Get service type being used
   */
  getServiceType(): JamServiceType {
    if (this.v2Service && this.v1Service) {
      return "hybrid";
    }
    if (this.v2Service) {
      return "v2";
    }
    if (this.v1Service) {
      return "v1";
    }
    throw new Error("No Jam service configured");
  }

  /**
   * Check if V2 is available
   */
  isV2Available(): boolean {
    return this.v2Service !== null;
  }

  /**
   * Check if V1 fallback is available
   */
  isV1FallbackAvailable(): boolean {
    return this.v1Service !== null;
  }

  /**
   * Check if service is configured
   */
  isConfigured(): boolean {
    return this.v2Service !== null || this.v1Service !== null;
  }

  /**
   * Subscribe to Jam events (V2 only)
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
 * Get Jam Service (convenience function)
 */
export function getJam(): JamServiceV2 | JamService {
  const factory = getJamServiceFactory();
  if (!factory) {
    throw new Error(
      "JamServiceFactory not initialized. Call createJamServiceFactory first.",
    );
  }
  return factory.getService();
}

/**
 * Initialize Jam Service Factory from environment
 */
export function initializeJamServiceFactory(): JamServiceFactory {
  const config: JamServiceConfig = {
    selfHostedEnabled: process.env.JAM_SELF_HOSTED_ENABLED === "true",
    fallbackEnabled: process.env.JAM_FALLBACK_ENABLED !== "false",
    pantryUrl: process.env.PANTRY_URL || "http://localhost:3003",
    sfuEnabled: true,
    stunUrl: process.env.VITE_STUN_URL || "stun:localhost:3478",
    turnUrl: process.env.VITE_TURN_URL || "turn:localhost:3478",
    turnSecret: process.env.COTURN_SECRET || "",
    turnRealm: process.env.COTURN_REALM || "clawzz.dev",
    redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
    jamUrl: process.env.JAM_URL || "http://localhost:3001",
    jamApiKey: process.env.JAM_API_KEY || "",
    jamWebhookSecret: process.env.JAM_WEBHOOK_SECRET || "",
  };

  return createJamServiceFactory(config);
}
