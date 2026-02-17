/**
 * WebSocket Configuration
 *
 * Configuration for Socket.IO and WebSocket security settings
 */

import { logger } from "../utils/logger.js";

/**
 * WebSocket configuration
 */
export const WEBSOCKET_CONFIG = {
  // Rate limiting
  rateLimitEnabled: process.env.WS_RATE_LIMIT_ENABLED !== "false",
  maxEventsPerMinute: parseInt(process.env.WS_MAX_EVENTS_PER_MINUTE || "60"),

  // Payload limits
  maxPayloadSize: parseInt(process.env.WS_MAX_PAYLOAD_SIZE || "10240"), // 10KB
  maxMessageLength: parseInt(process.env.WS_MAX_MESSAGE_LENGTH || "5000"),

  // Connection settings
  pingTimeout: parseInt(process.env.WS_PING_TIMEOUT || "60000"),
  pingInterval: parseInt(process.env.WS_PING_INTERVAL || "25000"),

  // Security
  requireAuthentication: process.env.WS_REQUIRE_AUTH !== "false",
  allowedOrigins: process.env.WS_ALLOWED_ORIGINS?.split(",") || ["*"],
};

/**
 * Validate WebSocket configuration
 */
export function validateWebSocketConfig(): void {
  const warnings: string[] = [];

  if (WEBSOCKET_CONFIG.maxPayloadSize > 102400) {
    warnings.push("WS_MAX_PAYLOAD_SIZE exceeds 100KB - may impact performance");
  }

  if (WEBSOCKET_CONFIG.maxEventsPerMinute > 120) {
    warnings.push(
      "WS_MAX_EVENTS_PER_MINUTE is very high - consider lower limit",
    );
  }

  if (
    WEBSOCKET_CONFIG.allowedOrigins.includes("*") &&
    process.env.NODE_ENV === "production"
  ) {
    warnings.push(
      "WS_ALLOWED_ORIGINS allows all origins in production - security risk",
    );
  }

  if (warnings.length > 0) {
    logger.warn("WebSocket configuration warnings", { warnings });
  } else {
    logger.info("✅ WebSocket configuration validated", {
      rateLimitEnabled: WEBSOCKET_CONFIG.rateLimitEnabled,
      maxPayloadSize: WEBSOCKET_CONFIG.maxPayloadSize,
      requireAuth: WEBSOCKET_CONFIG.requireAuthentication,
    });
  }
}

/**
 * WebSocket rate limit configuration by event type
 */
export const WS_RATE_LIMITS = {
  "join-room": { max: 5, windowMs: 60000 },
  "submit-message": { max: 30, windowMs: 60000 },
  "leave-room": { max: 10, windowMs: 60000 },
  default: { max: 60, windowMs: 60000 },
};

/**
 * Get rate limit for event
 */
export function getRateLimit(event: string): { max: number; windowMs: number } {
  return (
    WS_RATE_LIMITS[event as keyof typeof WS_RATE_LIMITS] ||
    WS_RATE_LIMITS.default
  );
}
