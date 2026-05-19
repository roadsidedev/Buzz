/**
 * TURN Credentials Utility
 *
 * Generates time-limited credentials for Coturn STUN/TURN server.
 * Uses HMAC-SHA1 with shared secret for credential generation.
 *
 * Flow:
 * 1. Client requests TURN credentials from Buzz backend
 * 2. Backend generates time-limited credentials using COTURN_SECRET
 * 3. Client uses credentials to connect to TURN server
 * 4. TURN server validates credentials using same secret
 */

import { createHmac, randomBytes } from "crypto";
import logger from "./logger.js";

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface TurnCredentials {
  username: string;
  credential: string;
  ttl: number;
  expiresAt: number;
}

export interface TurnServerConfig {
  secret: string;
  realm: string;
  defaultTtl?: number;
}

/**
 * Generate TURN credentials
 *
 * Uses the long-term credential mechanism with time-limited credentials.
 * Username format: timestamp:identifier
 * Credential: HMAC-SHA1(secret, username)
 *
 * @param secret - Shared secret from COTURN_SECRET
 * @param identifier - User identifier (e.g., agentId)
 * @param ttl - Time to live in seconds (default: 24 hours)
 */
export function generateTurnCredentials(
  secret: string,
  identifier: string = "buzz-client",
  ttl: number = 86400,
): TurnCredentials {
  if (!secret) {
    throw new Error("COTURN_SECRET is required for TURN credentials");
  }

  const timestamp = Math.floor(Date.now() / 1000) + ttl;
  const username = `${timestamp}:${identifier}`;

  const credential = createHmac("sha1", secret)
    .update(username)
    .digest("base64");

  logger.debug("Generated TURN credentials", {
    identifier,
    ttl,
    expiresAt: timestamp,
  });

  return {
    username,
    credential,
    ttl,
    expiresAt: timestamp * 1000, // Convert to milliseconds
  };
}

/**
 * Validate TURN credentials
 */
export function validateTurnCredentials(
  username: string,
  credential: string,
  secret: string,
): { valid: boolean; error?: string } {
  try {
    const [timestampStr] = username.split(":");
    const timestamp = parseInt(timestampStr, 10);

    if (isNaN(timestamp)) {
      return { valid: false, error: "Invalid username format" };
    }

    if (timestamp * 1000 < Date.now()) {
      return { valid: false, error: "Credentials expired" };
    }

    const expectedCredential = createHmac("sha1", secret)
      .update(username)
      .digest("base64");

    if (credential !== expectedCredential) {
      return { valid: false, error: "Invalid credential" };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get ICE server configuration for WebRTC
 */
export function getIceServers(config: TurnServerConfig): IceServer[] {
  const { secret, realm, defaultTtl = 86400 } = config;

  if (!secret) {
    logger.warn("COTURN_SECRET not set, using only STUN server");
    return [
      {
        urls: `stun:${realm}:3478`,
      },
    ];
  }

  const credentials = generateTurnCredentials(
    secret,
    "webrtc-client",
    defaultTtl,
  );

  return [
    {
      urls: `stun:${realm}:3478`,
    },
    {
      urls: [
        `turn:${realm}:3478`,
        `turn:${realm}:3478?transport=tcp`,
        `turns:${realm}:5349`,
        `turns:${realm}:5349?transport=tcp`,
      ],
      username: credentials.username,
      credential: credentials.credential,
    },
  ];
}

/**
 * Create ICE server configuration with dynamic credentials
 */
export function createIceServerConfig(options: {
  stunUrl?: string;
  turnUrl?: string;
  turnSecret?: string;
  turnRealm?: string;
  identifier?: string;
  ttl?: number;
}): {
  iceServers: IceServer[];
  credentials: TurnCredentials | null;
} {
  const {
    stunUrl,
    turnUrl,
    turnSecret,
    turnRealm = "buzz-live.vercel.app",
    identifier = "buzz-client",
    ttl = 86400,
  } = options;

  const iceServers: IceServer[] = [];

  // Add STUN server
  if (stunUrl) {
    iceServers.push({ urls: stunUrl });
  }

  // Add TURN server with credentials
  let credentials: TurnCredentials | null = null;

  if (turnUrl && turnSecret) {
    credentials = generateTurnCredentials(turnSecret, identifier, ttl);

    iceServers.push({
      urls: [turnUrl, `${turnUrl}?transport=tcp`],
      username: credentials.username,
      credential: credentials.credential,
    });

    // Add TLS TURN if using standard port
    if (turnUrl.includes(":3478")) {
      const tlsUrl = turnUrl
        .replace(":3478", ":5349")
        .replace("turn:", "turns:");
      const lastServer = iceServers[iceServers.length - 1];
      if (Array.isArray(lastServer.urls)) {
        lastServer.urls.push(tlsUrl);
        lastServer.urls.push(`${tlsUrl}?transport=tcp`);
      }
    }
  }

  return { iceServers, credentials };
}

/**
 * Refresh TURN credentials before expiration
 */
export function shouldRefreshCredentials(
  credentials: TurnCredentials,
  thresholdMs: number = 300000, // 5 minutes before expiry
): boolean {
  return Date.now() > credentials.expiresAt - thresholdMs;
}
