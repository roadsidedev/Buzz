/**
 * WebSocket Validation Middleware
 *
 * Provides Zod schema validation for Socket.IO events
 * to prevent injection attacks and ensure data integrity.
 *
 * Security Features:
 * - Zod schema validation for all payloads
 * - Payload size limits
 * - Rate limiting per socket
 * - Input sanitization
 * - Error handling with safe error messages
 */

import { z } from "zod";
import type { Socket } from "socket.io";
import { logger } from "../utils/logger.js";

/**
 * Maximum payload sizes (in bytes)
 */
const MAX_PAYLOAD_SIZES = {
  "join-room": 1024, // 1KB
  "submit-message": 10011, // 10KB (allows exactly 10000 chars in text field)
  "leave-room": 1024, // 1KB
  default: 10240, // 10KB default
};

/**
 * Rate limiting configuration
 */
const RATE_LIMITS = {
  "join-room": { max: 5, windowMs: 60000 }, // 5 per minute
  "submit-message": { max: 30, windowMs: 60000 }, // 30 per minute
  default: { max: 60, windowMs: 60000 }, // 60 per minute
};

/**
 * Zod schemas for WebSocket events
 */
export const WebSocketSchemas = {
  // Join room event
  "join-room": z.object({
    agentId: z
      .string()
      .uuid("Invalid agent ID format")
      .min(1, "Agent ID is required"),
  }),

  // Submit message event
  "submit-message": z.object({
    text: z
      .string()
      .min(1, "Message cannot be empty")
      .max(5000, "Message too long (max 5000 characters)")
      .refine((val) => !containsDangerousPatterns(val), {
        message: "Message contains invalid characters",
      }),
  }),

  // Leave room event
  "leave-room": z.object({
    agentId: z.string().uuid("Invalid agent ID format").optional(),
    reason: z.string().max(200, "Reason too long").optional(),
  }),

  // Heartbeat/Ping event
  ping: z.object({
    timestamp: z.number().optional(),
  }),
};

/**
 * Check if text contains dangerous patterns
 */
function containsDangerousPatterns(text: string): boolean {
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+=/i, // onclick, onload, etc.
    /eval\s*\(/i,
    /Function\s*\(/i,
    /setTimeout\s*\(/i,
    /setInterval\s*\(/i,
  ];

  return dangerousPatterns.some((pattern) => pattern.test(text));
}

/**
 * Sanitize string input
 */
function sanitizeString(input: string): string {
  return (
    input
      // Remove null bytes
      .replace(/\x00/g, "")
      // Normalize whitespace
      .replace(/\s+/g, " ")
      // Remove control characters
      .replace(/[\x00-\x1F\x7F-\x9F]/g, "")
      .trim()
  );
}

// Maximum rate-limit window across all event types — used as the TTL for
// stale socket entries so the GC sweep can reclaim them without evicting
// entries that are still within an active window.
const MAX_WINDOW_MS = Math.max(...Object.values(RATE_LIMITS).map((r) => r.windowMs));

/**
 * Rate limiter for WebSocket events (M1 — memory-leak fix).
 *
 * The previous implementation kept socket entries in `sockets` forever;
 * disconnected sockets accumulated unboundedly because `cleanup()` was not
 * always called on abnormal disconnects.
 *
 * Fix: a periodic GC sweep (every MAX_WINDOW_MS) removes sockets whose most
 * recently active rate-limit window has expired, capping memory usage to
 * O(active_sockets × event_types) rather than O(all_ever_connected).
 */
class WebSocketRateLimiter {
  private sockets = new Map<
    string,
    Map<string, { count: number; resetAt: number }>
  >();

  // Track the latest resetAt across all events per socket so the GC can
  // determine whether any window is still active without iterating all events.
  private socketLastActive = new Map<string, number>();

  private gcTimer: ReturnType<typeof setInterval>;

  constructor() {
    // Run GC every full window; .unref() prevents the timer from keeping the
    // Node.js process alive during graceful shutdown.
    this.gcTimer = setInterval(() => this._gc(), MAX_WINDOW_MS).unref();
  }

  /**
   * Check if event is rate limited
   */
  isLimited(socketId: string, event: string): boolean {
    const config =
      RATE_LIMITS[event as keyof typeof RATE_LIMITS] || RATE_LIMITS.default;

    if (!this.sockets.has(socketId)) {
      this.sockets.set(socketId, new Map());
    }

    const socketLimits = this.sockets.get(socketId)!;
    const now = Date.now();

    if (!socketLimits.has(event)) {
      const resetAt = now + config.windowMs;
      socketLimits.set(event, { count: 1, resetAt });
      this.socketLastActive.set(socketId, Math.max(this.socketLastActive.get(socketId) ?? 0, resetAt));
      return false;
    }

    const limit = socketLimits.get(event)!;

    // Reset if window expired
    if (now > limit.resetAt) {
      limit.count = 1;
      limit.resetAt = now + config.windowMs;
    } else if (limit.count >= config.max) {
      return true;
    } else {
      limit.count++;
    }

    this.socketLastActive.set(socketId, Math.max(this.socketLastActive.get(socketId) ?? 0, limit.resetAt));
    return false;
  }

  /**
   * Eagerly release all state for a disconnected socket.
   * Called on a clean Socket.IO disconnect event.
   */
  cleanup(socketId: string): void {
    this.sockets.delete(socketId);
    this.socketLastActive.delete(socketId);
  }

  /**
   * Periodic GC: evict entries whose last active window has fully expired.
   * This provides a safety net for sockets that disconnect without emitting
   * a clean disconnect event (network drops, process kills, etc.).
   */
  private _gc(): void {
    const now = Date.now();
    let evicted = 0;
    for (const [socketId, lastActive] of this.socketLastActive) {
      if (now > lastActive) {
        this.sockets.delete(socketId);
        this.socketLastActive.delete(socketId);
        evicted++;
      }
    }
    if (evicted > 0) {
      // Avoid importing logger here to keep this file self-contained;
      // use console.debug which is stripped in production log levels.
      // eslint-disable-next-line no-console
      console.debug(`[WebSocketRateLimiter] GC evicted ${evicted} stale socket(s); remaining: ${this.sockets.size}`);
    }
  }

  /** Stop the background GC timer (used in tests). */
  destroy(): void {
    clearInterval(this.gcTimer);
  }
}

const rateLimiter = new WebSocketRateLimiter();

/**
 * WebSocket validation error
 */
export class WebSocketValidationError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: z.ZodError,
  ) {
    super(message);
    this.name = "WebSocketValidationError";
  }
}

/**
 * Validate WebSocket event payload
 *
 * @param event - Event name
 * @param data - Payload data
 * @returns Validated and sanitized data
 * @throws WebSocketValidationError if validation fails
 */
export function validateWebSocketEvent<T extends keyof typeof WebSocketSchemas>(
  event: T,
  data: unknown,
): z.infer<(typeof WebSocketSchemas)[T]> {
  const schema = WebSocketSchemas[event];

  if (!schema) {
    throw new WebSocketValidationError(
      `Unknown event type: ${event}`,
      "UNKNOWN_EVENT",
    );
  }

  try {
    const result = schema.parse(data);

    // Sanitize string fields
    if (typeof result === "object" && result !== null) {
      for (const [key, value] of Object.entries(result)) {
        if (typeof value === "string") {
          (result as any)[key] = sanitizeString(value);
        }
      }
    }

    return result;
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw new WebSocketValidationError(
        `Validation failed for ${event}`,
        "VALIDATION_ERROR",
        err,
      );
    }
    throw err;
  }
}

/**
 * Check payload size
 */
export function checkPayloadSize(event: string, data: unknown): boolean {
  const maxSize =
    MAX_PAYLOAD_SIZES[event as keyof typeof MAX_PAYLOAD_SIZES] ||
    MAX_PAYLOAD_SIZES.default;

  const size = JSON.stringify(data).length;
  return size <= maxSize;
}

/**
 * Create validated event handler wrapper
 *
 * Usage:
 * ```typescript
 * socket.on('submit-message', createValidatedHandler('submit-message', (data, socket) => {
 *   // Handle validated data
 * }));
 * ```
 */
export function createValidatedHandler<T extends keyof typeof WebSocketSchemas>(
  event: T,
  handler: (
    data: z.infer<(typeof WebSocketSchemas)[T]>,
    socket: Socket,
  ) => void | Promise<void>,
) {
  return function (this: Socket, data: unknown) {
    const socket = this;

    try {
      // Check rate limit
      if (rateLimiter.isLimited(socket.id, event)) {
        logger.warn("WebSocket rate limit exceeded", {
          socketId: socket.id,
          event,
        });
        socket.emit("error", {
          code: "RATE_LIMITED",
          message: "Too many requests. Please slow down.",
        });
        return;
      }

      // Check payload size
      if (!checkPayloadSize(event, data)) {
        logger.warn("WebSocket payload too large", {
          socketId: socket.id,
          event,
        });
        socket.emit("error", {
          code: "PAYLOAD_TOO_LARGE",
          message: "Message too large",
        });
        return;
      }

      // Validate payload
      const validatedData = validateWebSocketEvent(event, data);

      // Call handler with validated data
      const result = handler(validatedData, socket);

      // Handle async handlers
      if (result instanceof Promise) {
        result.catch((err) => {
          logger.error("WebSocket handler error", {
            socketId: socket.id,
            event,
            error: err instanceof Error ? err.message : String(err),
          });
          socket.emit("error", {
            code: "INTERNAL_ERROR",
            message: "An error occurred processing your request",
          });
        });
      }
    } catch (err) {
      if (err instanceof WebSocketValidationError) {
        logger.warn("WebSocket validation failed", {
          socketId: socket.id,
          event,
          code: err.code,
          errors: err.details?.errors,
        });
        socket.emit("error", {
          code: err.code,
          message: "Invalid message format",
          details: err.details?.errors.map((e) => ({
            path: e.path.join("."),
            message: e.message,
          })),
        });
      } else {
        logger.error("WebSocket unexpected error", {
          socketId: socket.id,
          event,
          error: err instanceof Error ? err.message : String(err),
        });
        socket.emit("error", {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred",
        });
      }
    }
  };
}

/**
 * Cleanup rate limiter for a socket
 */
export function cleanupSocketRateLimit(socketId: string): void {
  rateLimiter.cleanup(socketId);
}


