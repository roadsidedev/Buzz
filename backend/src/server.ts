/**
 * ClawZz API Gateway
 * Express.js server for all HTTP and WebSocket requests
 * Phase 1: Authentication and Core API Routes
 */

import dotenv from "dotenv";
dotenv.config();

// ============================================================================
// OBSERVABILITY & TRACING (Must initialize first for auto-instrumentation)
// ============================================================================
import { initializeOTel } from "./config/otel-config.js";
initializeOTel();

import express, { Express, Request, Response, NextFunction } from "express";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";

// ============================================================================
// Utils & Config
// ============================================================================
import { logger } from "./utils/logger.js";
import { initializeSentry } from "./config/sentry-config.js";
import { validateJWTConfig } from "./services/auth-service.js";
import {
  validateCSRFConfig,
  csrfTokenProvider,
  validateCSRFToken,
  initializeCSRFToken,
} from "./middleware/csrf-protection.js";
import { validateX402Config } from "./config/x402-config.js";
import { validateJamConfig, validateTTSConfig } from "./config/media-config.js";
import { validateWebSocketConfig } from "./config/websocket-config.js";
import { startRateLimitCleanup } from "./middleware/rate-limit.js";
import { notFoundHandler, errorHandler } from "./middleware/error-handler.js";
import { initializeLoginAttemptService } from "./services/login-attempt-service.js";
import {
  sentryTransactionMiddleware,
  sentrySecurityContextMiddleware,
  sentryAuthTrackingMiddleware,
} from "./middleware/sentry-middleware.js";

// ============================================================================
// Routes
// ============================================================================
import skillRoutes from "./routes/skill-routes.js";
import siwaAuthRoutes from "./routes/auth-routes-siwa.js";
import agentRoutes from "./routes/agent-routes.js";
import roomRoutes from "./routes/room-routes.js";
import discoveryRoutes from "./routes/discovery-routes.js";
import podcastRoutes from "./routes/podcast-routes.js";

// ============================================================================
// CRITICAL SECURITY VALIDATION (Must run before server starts)
// ============================================================================

try {
  // Validate all critical security configurations
  validateJWTConfig();
  validateCSRFConfig();
  validateWebSocketConfig();

  // Validate x402 payment configuration (if payments enabled)
  try {
    validateX402Config();
  } catch (x402Error) {
    // Only fail startup if payments are enabled
    if (process.env.ENABLE_PAYMENTS !== "false") {
      throw x402Error;
    }
    logger.warn("x402 validation skipped (payments disabled)");
  }

  // Validate media service configurations (if features enabled)
  try {
    validateJamConfig();
  } catch (jamError) {
    if (process.env.ENABLE_AUDIO_STREAMING !== "false") {
      logger.warn("Jam audio streaming configuration issue", {
        error: jamError instanceof Error ? jamError.message : String(jamError),
      });
    }
  }

  try {
    validateTTSConfig();
  } catch (ttsError) {
    if (process.env.ENABLE_TTS !== "false") {
      logger.warn("TTS configuration issue", {
        error: ttsError instanceof Error ? ttsError.message : String(ttsError),
      });
    }
  }

  logger.info("✅ Security configuration validated");
} catch (error) {
  logger.error("❌ CRITICAL: Security validation failed", {
    error: error instanceof Error ? error.message : String(error),
  });
  console.error("\n" + "=".repeat(70));
  console.error("SERVER STARTUP FAILED - SECURITY CONFIGURATION ERROR");
  console.error("=".repeat(70));
  console.error(error instanceof Error ? error.message : String(error));
  console.error("=".repeat(70) + "\n");
  process.exit(1);
}

const app: Express = express();
const port = parseInt(process.env.API_PORT || "4000", 10);
const apiVersion = "v1";

// ============================================================================
// INITIALIZATION
// ============================================================================

// Phase 1 (Day 3): Initialize Sentry for error tracking and performance monitoring
initializeSentry(app);

// Phase 1 (Day 3): Initialize Login Attempt Service (Redis-backed brute force protection)
initializeLoginAttemptService().catch((err) => {
  logger.warn("Failed to initialize login attempt service", {
    error: err instanceof Error ? err.message : String(err),
  });
});

// ============================================================================
// MIDDLEWARE SETUP
// ============================================================================

// Security
app.use(helmet());
app.use(cors());

// Logging
app.use(morgan("combined"));

// Phase 1 (Day 3): Sentry transaction tracking
app.use(sentryTransactionMiddleware);
app.use(sentrySecurityContextMiddleware);
app.use(sentryAuthTrackingMiddleware);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// SQL Injection Prevention
// Validates and sanitizes inputs to prevent SQL injection attacks
import { sqlInjectionPrevention } from "./utils/sql-injection-prevention.js";
app.use(sqlInjectionPrevention());

// CSRF Protection
// 1. Provide CSRF tokens on all requests
// 2. Validate tokens on state-changing requests
app.use(csrfTokenProvider());
app.use(validateCSRFToken());

// Initialize rate limiting (async, must happen before route setup)
let rateLimiterReady = false;

/**
 * Middleware to block requests until rate limiter is ready
 * Prevents early request floods from bypassing security
 */
const rateLimiterGuard = (req: Request, res: Response, next: NextFunction) => {
  if (!rateLimiterReady) {
    logger.warn("Rate limiter not ready, rejecting request", {
      path: req.path,
    });
    res.status(503).json({
      success: false,
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "Rate limiting initialization in progress",
        statusCode: 503,
      },
    });
    return;
  }
  next();
};

startRateLimitCleanup()
  .then(() => {
    rateLimiterReady = true;
    logger.info("Rate limiting initialized");
  })
  .catch((err) => {
    logger.warn("Rate limiting initialization failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    // In production, we might want to fail startup, but for now we fallback
    rateLimiterReady = true;
  });

app.use(rateLimiterGuard);

// ============================================================================
// HEALTH & VERSION ENDPOINTS
// ============================================================================

/**
 * Health check for orchestration and load balancing
 */
app.get("/health", (req: Request, res: Response): void => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "clawzz-api",
    version: "0.0.1",
    uptime: process.uptime(),
  });
});

/**
 * API version endpoint
 */
app.get(`/api/${apiVersion}/version`, (req: Request, res: Response): void => {
  res.json({
    success: true,
    data: {
      version: "0.0.1",
      phase: "1-api-gateway",
      apiVersion,
      timestamp: new Date().toISOString(),
    },
  });
});

/**
 * CSRF token endpoint
 * Frontend calls this to get/refresh CSRF token
 * Token is also in httpOnly cookie
 */
app.get(
  `/api/${apiVersion}/csrf-token`,
  (req: Request, res: Response): void => {
    const token = initializeCSRFToken(req, res);
    res.json({
      success: true,
      data: {
        token,
        expiresIn: 3600, // 1 hour in seconds
      },
    });
  },
);

// ============================================================================
// API ROUTES
// ============================================================================

/**
 * Skill documentation (agent onboarding)
 * Accessible at /skill.md, /skill.json, /heartbeat.md, /rules.md
 */
app.use("/", skillRoutes);

/**
 * Authentication routes (SIWA + Privy)
 */
app.use(`/api/${apiVersion}/auth`, siwaAuthRoutes);

/**
 * Agent routes
 */
app.use(`/api/${apiVersion}/agents`, agentRoutes);

/**
 * Verification routes (ERC-8004 identity)
 */
import verificationRoutes from "./api/routes/verification-routes.js";
app.use(verificationRoutes);

/**
 * Room routes
 */
app.use(`/api/${apiVersion}/rooms`, roomRoutes);

/**
 * Discovery routes
 */
app.use(`/api/${apiVersion}/discover`, discoveryRoutes);

/**
 * Podcast routes
 */
app.use(`/api/${apiVersion}/podcasts`, podcastRoutes);

// ============================================================================
// WEBSOCKET SETUP
// ============================================================================

const server = http.createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.REACT_APP_API_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

// Import WebSocket validation
import {
  createValidatedHandler,
  cleanupSocketRateLimit,
} from "./middleware/websocket-validation.js";

// Namespace for room connections
const roomNamespace = io.of(/^\/rooms\/[a-f0-9-]+$/);

roomNamespace.on("connection", (socket) => {
  const roomId = socket.nsp.name.replace("/rooms/", "");
  logger.info("Client connected to room", {
    socketId: socket.id,
    roomId,
  });

  // Handle join room with validation
  socket.on(
    "join-room",
    createValidatedHandler("join-room", (data, sock) => {
      logger.debug("Agent joined room socket", {
        socketId: sock.id,
        roomId,
        agentId: data.agentId,
      });

      // Join the socket room for broadcasting
      sock.join(`room:${roomId}`);

      sock.emit("room:state-change", {
        roomId,
        status: "live",
        participants: [],
        timestamp: new Date().toISOString(),
      });
    }),
  );

  // Handle message submission with validation
  socket.on(
    "submit-message",
    createValidatedHandler("submit-message", (data, sock) => {
      logger.debug("Message submitted", {
        socketId: sock.id,
        roomId,
        textLength: data.text.length,
      });

      // TODO: Save message to database via message service
      // const messageService = getMessageService();
      // messageService.submitMessage(roomId, data.text);

      sock.emit("message:queued", {
        messageId: crypto.randomUUID(),
        status: "candidate",
        timestamp: new Date().toISOString(),
      });
    }),
  );

  // Handle leave room with validation
  socket.on(
    "leave-room",
    createValidatedHandler("leave-room", (data, sock) => {
      logger.debug("Agent left room", {
        socketId: sock.id,
        roomId,
        agentId: data.agentId,
        reason: data.reason,
      });

      sock.leave(`room:${roomId}`);

      sock.emit("room:left", {
        roomId,
        timestamp: new Date().toISOString(),
      });
    }),
  );

  // Handle disconnect
  socket.on("disconnect", () => {
    logger.info("Client disconnected", {
      socketId: socket.id,
      roomId,
    });

    // Clean up rate limiter for this socket
    cleanupSocketRateLimit(socket.id);
  });
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler (before error handler)
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// ============================================================================
// SERVER STARTUP
// ============================================================================

server.listen(port, "0.0.0.0", () => {
  logger.info(`🚀 ClawZz API Gateway started`, {
    port,
    environment: process.env.NODE_ENV || "development",
    apiVersion,
  });
  logger.info(`📡 WebSocket ready at /rooms/:roomId`, {
    port,
  });
});

/**
 * Get Socket.IO instance for emitting events from services
 * Used by turn management service to broadcast turn completions
 */
export function getIO(): SocketIOServer {
  return io;
}

export { app, io, server };
