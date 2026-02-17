/**
 * ClawZz API Gateway
 * Express.js server for all HTTP and WebSocket requests
 * Phase 1: Authentication and Core API Routes
 */

import express, { Express, Request, Response } from "express";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";

import {
  errorHandler,
  notFoundHandler,
  startRateLimitCleanup,
} from "./middleware/index.js";
import {
  csrfTokenProvider,
  validateCSRFToken,
  initializeCSRFToken,
} from "./middleware/csrf-protection.js";
import {
  sentryTransactionMiddleware,
  sentrySecurityContextMiddleware,
  sentryAuthTrackingMiddleware,
} from "./middleware/sentry-middleware.js";
import { initializeSentry } from "./config/sentry-config.js";
import { initializeLoginAttemptService } from "./services/login-attempt-service.js";
import { setSocketIO } from "./services/turn-management-service.js";
import { logger } from "./utils/logger.js";
import siwaAuthRoutes from "./routes/auth-routes-siwa.js";
import roomRoutes from "./routes/room-routes.js";
import discoveryRoutes from "./routes/discovery-routes.js";
import agentRoutes from "./routes/agent-routes.js";
import podcastRoutes from "./routes/podcast-routes.js";
import skillRoutes from "./routes/skill-routes.js";
import webhookRoutes from "./routes/webhook-routes.js";

dotenv.config();

const app: Express = express();
const port = process.env.API_PORT || 4000;
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

// CSRF Protection
// 1. Provide CSRF tokens on all requests
// 2. Validate tokens on state-changing requests
app.use(csrfTokenProvider());
app.use(validateCSRFToken());

// Initialize rate limiting (async, must happen before route setup)
let rateLimiterReady = false;
startRateLimitCleanup()
  .then(() => {
    rateLimiterReady = true;
    logger.info("Rate limiting initialized");
  })
  .catch((err) => {
    logger.warn("Rate limiting initialization failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    // Continue startup even if rate limiting init fails
    rateLimiterReady = true;
  });

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

/**
 * Webhook routes
 */
app.use(`/webhooks`, webhookRoutes);

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

// Initialize Socket.IO for turn management service
setSocketIO(io);

logger.info("Socket.IO initialized for orchestrator integration");

// Namespace for room connections
const roomNamespace = io.of(/^\/rooms\/[a-f0-9-]+$/);

roomNamespace.on("connection", (socket) => {
  const roomId = socket.nsp.name.replace("/rooms/", "");
  logger.info("Client connected to room", {
    socketId: socket.id,
    roomId,
  });

  // Handle join room
  socket.on("join-room", (data: { agentId: string }) => {
    logger.debug("Agent joined room socket", {
      socketId: socket.id,
      roomId,
      agentId: data.agentId,
    });

    socket.emit("room:state-change", {
      roomId,
      status: "live",
      participants: [],
      timestamp: new Date().toISOString(),
    });
  });

  // Handle message submission
  socket.on("submit-message", async (data: { text: string; agentId: string }) => {
    logger.debug("Message submitted via WebSocket", {
      socketId: socket.id,
      roomId,
      textLength: data.text.length,
      agentId: data.agentId,
    });

    try {
      // Import turn management service dynamically to avoid circular dependencies
      const { turnManagementService } = await import("./services/turn-management-service.js");
      
      const message = await turnManagementService.submitMessage(
        roomId,
        data.agentId,
        data.text,
      );

      socket.emit("message:queued", {
        messageId: message.id,
        status: message.status,
        timestamp: new Date().toISOString(),
      });

      logger.info("Message queued successfully", {
        roomId,
        messageId: message.id,
        agentId: data.agentId,
      });
    } catch (err) {
      logger.error("Failed to queue message", {
        roomId,
        error: err instanceof Error ? err.message : String(err),
      });

      socket.emit("message:error", {
        error: err instanceof Error ? err.message : "Failed to queue message",
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    logger.info("Client disconnected", {
      socketId: socket.id,
      roomId,
    });
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

export { app, io, server };
