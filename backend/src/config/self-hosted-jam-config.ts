/**
 * Self-Hosted Jam Configuration
 *
 * Configuration for self-hosted Jam audio rooms.
 * Includes Pantry, SFU, and Coturn settings.
 */

import crypto from "crypto";
import logger from "../utils/logger.js";

export interface SelfHostedJamConfig {
  pantry: {
    url: string;
    healthCheckIntervalMs: number;
  };
  sfu: {
    enabled: boolean;
    externalIp?: string;
    minPort: number;
    maxPort: number;
  };
  coturn: {
    realm: string;
    secret: string;
    externalIp?: string;
    stunPort: number;
    turnPort: number;
    tlsPort: number;
  };
  redis: {
    url: string;
    jamEventsChannel: string;
    beelyEventsChannel: string;
  };
  fallback: {
    enabled: boolean;
    jamUrl: string;
    jamApiKey: string;
    webhookSecret: string;
  };
}

/**
 * Get self-hosted Jam configuration from environment
 */
export function getSelfHostedJamConfig(): SelfHostedJamConfig {
  const config: SelfHostedJamConfig = {
    pantry: {
      url: process.env.PANTRY_URL || "http://localhost:3003",
      healthCheckIntervalMs: parseInt(
        process.env.JAM_HEALTH_CHECK_INTERVAL_MS || "30000",
        10,
      ),
    },
    sfu: {
      enabled: true,
      externalIp: process.env.COTURN_EXTERNAL_IP,
      minPort: parseInt(process.env.MEDIASOUP_MIN_PORT || "30000", 10),
      maxPort: parseInt(process.env.MEDIASOUP_MAX_PORT || "39999", 10),
    },
    coturn: {
      realm: process.env.COTURN_REALM || "beely-live.vercel.app",
      secret: process.env.COTURN_SECRET || "",
      externalIp: process.env.COTURN_EXTERNAL_IP,
      stunPort: 3478,
      turnPort: 3478,
      tlsPort: 5349,
    },
    redis: {
      url: process.env.REDIS_URL || "redis://localhost:6379",
      jamEventsChannel: "jam:events",
      beelyEventsChannel: "beely:room:events",
    },
    fallback: {
      enabled: process.env.JAM_FALLBACK_ENABLED !== "false",
      jamUrl: process.env.JAM_URL || "http://localhost:3001",
      jamApiKey: process.env.JAM_API_KEY || "",
      webhookSecret: process.env.JAM_WEBHOOK_SECRET || "",
    },
  };

  return config;
}

/**
 * Validate self-hosted Jam configuration
 */
export function validateSelfHostedJamConfig(config: SelfHostedJamConfig): {
  valid: boolean;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check Pantry URL
  if (!config.pantry.url) {
    errors.push("PANTRY_URL is not set");
  }

  // Check Coturn configuration
  if (!config.coturn.secret) {
    warnings.push("COTURN_SECRET is not set - TURN relay will not work");
  }

  if (!config.coturn.externalIp) {
    warnings.push(
      "COTURN_EXTERNAL_IP is not set - may cause NAT traversal issues in production",
    );
  }

  // Check fallback configuration
  if (config.fallback.enabled) {
    if (!config.fallback.jamApiKey) {
      warnings.push("JAM_FALLBACK_ENABLED is true but JAM_API_KEY is not set");
    }
    if (!config.fallback.webhookSecret) {
      warnings.push(
        "JAM_FALLBACK_ENABLED is true but JAM_WEBHOOK_SECRET is not set",
      );
    }
  }

  // Log results
  if (errors.length > 0) {
    logger.error("Self-hosted Jam configuration errors", { errors });
  }
  if (warnings.length > 0) {
    logger.warn("Self-hosted Jam configuration warnings", { warnings });
  }
  if (errors.length === 0) {
    logger.info("✅ Self-hosted Jam configuration validated", {
      pantryUrl: config.pantry.url,
      sfuEnabled: config.sfu.enabled,
      hasTurnSecret: !!config.coturn.secret,
      fallbackEnabled: config.fallback.enabled,
    });
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}

/**
 * Get ICE server configuration for WebRTC clients
 */
export function getIceServerConfig(config: SelfHostedJamConfig): {
  iceServers: Array<{
    urls: string | string[];
    username?: string;
    credential?: string;
  }>;
} {
  const stunUrl = `stun:${config.coturn.realm}:${config.coturn.stunPort}`;
  const turnUrl = `turn:${config.coturn.realm}:${config.coturn.turnPort}`;

  if (!config.coturn.secret) {
    return {
      iceServers: [{ urls: stunUrl }],
    };
  }

  // Generate time-limited credentials
  const ttl = 86400; // 24 hours
  const timestamp = Math.floor(Date.now() / 1000) + ttl;
  const username = `${timestamp}:beely-client`;

  const credential = crypto
    .createHmac("sha1", config.coturn.secret)
    .update(username)
    .digest("base64");

  return {
    iceServers: [
      { urls: stunUrl },
      {
        urls: [
          turnUrl,
          `${turnUrl}?transport=tcp`,
          `turns:${config.coturn.realm}:${config.coturn.tlsPort}`,
          `turns:${config.coturn.realm}:${config.coturn.tlsPort}?transport=tcp`,
        ],
        username,
        credential,
      },
    ],
  };
}

/**
 * Get Jam room URL
 */
export function getJamRoomUrl(
  config: SelfHostedJamConfig,
  roomId: string,
): string {
  const baseUrl = config.pantry.url.replace("/_/pantry", "");
  return `${baseUrl}/${roomId}`;
}
