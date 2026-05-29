/**
 * Buzz API Gateway
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

import crypto from "crypto";
import express, { Express, Request, Response, NextFunction } from "express";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import { securityHeaders, cspReportRoutes } from "./middleware/security-headers.js";

// ============================================================================
// Utils & Config
// ============================================================================
import { logger } from "./utils/logger.js";
import { initializeSentry } from "./config/sentry-config.js";
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
import { notificationService } from "./services/notification-service.js";
import {
  sentryTransactionMiddleware,
  sentrySecurityContextMiddleware,
  sentryAuthTrackingMiddleware,
} from "./middleware/sentry-middleware.js";

// ============================================================================
// Routes
// ============================================================================
import skillRoutes from "./routes/skill-routes.js";
import authRoutes from "./routes/auth-routes.js";
import agentRoutes from "./routes/agent-routes.js";
import roomRoutes from "./routes/room-routes.js";
import discoveryRoutes from "./routes/discovery-routes.js";
// DEPRECATED — podcasts extracted to standalone product
// import podcastRoutes from "./routes/podcast-routes.js";
import badgeRoutes from "./routes/badge-routes.js";
import contentVerificationRoutes from "./routes/content-verification-routes.js";
import livestreamRoutes from "./routes/livestream-routes.js";
import claimRoutes from "./routes/claim-routes.js";
import walletRoutes from "./routes/wallet-routes.js";
import interactionRoutes from "./routes/interaction-routes.js";
import notificationRoutes from "./routes/notification-routes.js";
import mediaRoutes from "./routes/media-routes.js";

// ============================================================================
// CRITICAL SECURITY VALIDATION (Must run before server starts)
// ============================================================================

try {
  // Validate all critical security configurations
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

  // Initialize JamServiceFactory eagerly so TTS can signal audio to rooms
  try {
    const { initializeJamServiceFactory } = await import("./services/jam-service-factory.js");
    initializeJamServiceFactory();
    logger.info("JamServiceFactory initialized at startup");
  } catch (jamFactoryErr) {
    logger.warn("JamServiceFactory initialization failed — audio signaling will be unavailable", {
      error: jamFactoryErr instanceof Error ? jamFactoryErr.message : String(jamFactoryErr),
    });
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
const port = parseInt(process.env.PORT || process.env.API_PORT || "4000", 10);
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

// CORS: restrict to configured allowed origins
const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : [
      "http://localhost:3000",
      "http://localhost:5173",
      "https://buzz-live.vercel.app",
      "https://beely-live.vercel.app",
      "https://www.Buzz.io",
      "https://Buzz.io",
    ];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server requests (no origin) or listed origins
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn("CORS rejection", { origin, allowed: allowedOrigins });
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
  }),
);

// Custom security headers (CSP, Permissions-Policy, HSTS, etc.)
app.use(securityHeaders);

// Logging
app.use(morgan("combined"));

// Phase 1 (Day 3): Sentry transaction tracking
app.use(sentryTransactionMiddleware);
app.use(sentrySecurityContextMiddleware);
app.use(sentryAuthTrackingMiddleware);

// Body parsing — 10mb limit to support base64 image uploads (cover art, etc.)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

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
    requestId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    service: "Buzz-api",
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
 * CSP violation report endpoint
 * Receives Content-Security-Policy violation reports from browsers
 */
cspReportRoutes(app);

/**
 * Skill documentation (agent onboarding)
 * Accessible at /skill.md, /skill.json, /heartbeat.md, /rules.md
 */
app.use("/", skillRoutes);

/**
 * Message routes (Internal orchestrator callbacks)
 */
import messageRoutes from "./routes/message-routes.js";
app.use(`/api/${apiVersion}/messages`, messageRoutes);

/**
 * Authentication routes (API key + claim flow)
 */
app.use(`/api/${apiVersion}/auth`, authRoutes);

/**
 * Agent routes (registration, profiles)
 */
app.use(`/api/${apiVersion}/agents`, agentRoutes);

/**
 * Verification badge routes (ERC-8004, 8004-Solana)
 */
app.use(`/api/${apiVersion}`, badgeRoutes);

/**
 * Content verification challenge routes
 */
app.use(`/api/${apiVersion}`, contentVerificationRoutes);

/**
 * Room routes
 */
app.use(`/api/${apiVersion}/rooms`, roomRoutes);

/**
 * Discovery routes
 */
app.use(`/api/${apiVersion}/discover`, discoveryRoutes);

// DEPRECATED — podcasts extracted to standalone product
// app.use(`/api/${apiVersion}/podcasts`, podcastRoutes);

/**
 * Livestream routes
 */
app.use(`/api/${apiVersion}/livestreams`, livestreamRoutes);

/**
 * TTS routes (standalone synthesize endpoint for video-runner, radio-runner)
 */
import ttsRoutes from "./routes/tts-routes.js";
app.use(`/api/${apiVersion}/tts`, ttsRoutes);

/**
 * Claim routes
 */
app.use(`/api/${apiVersion}/claim`, claimRoutes);

/**
 * Wallet routes (balance, deposit, tip)
 */
app.use(`/api/${apiVersion}/wallet`, walletRoutes);

/**
 * Interaction routes (like, save, reshare)
 */
app.use(`/api/${apiVersion}/interactions`, interactionRoutes);

/**
 * Notification routes (Human user notifications)
 */
app.use(`/api/${apiVersion}/notifications`, notificationRoutes);

/**
 * Media routes (file uploads)
 */
app.use(`/api/${apiVersion}/media`, mediaRoutes);

// ============================================================================
// WEBSOCKET SETUP
// ============================================================================

const server = http.createServer(app);

import { initializeWebSocket, getIO as getSocketIO } from "./api/websocket-server.js";
const io = initializeWebSocket(server);

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

import { roomOrchestrationService } from "./services/room-orchestration-service.js";
import { runStartupMigrations } from "./config/database.js";

// Apply idempotent schema migrations BEFORE accepting traffic.
// Previously this was fire-and-forget (no await), which caused
// "column last_seen_at does not exist" errors because the server
// started serving queries before migrations completed.
(async () => {
  try {
    await runStartupMigrations();
  } catch (err) {
    logger.warn("Startup migrations failed (non-fatal)", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  server.listen(port, "0.0.0.0", () => {
    logger.info(`🚀 Buzz API Gateway started`, {
      port,
      environment: process.env.NODE_ENV || "development",
      apiVersion,
    });
    logger.info(`📡 WebSocket ready at /rooms/:roomId`, {
      port,
    });

    // Start Orchestrator Loop (local in-process, always enabled)
    roomOrchestrationService.start().catch((err) => {
      logger.error("Failed to start room orchestration service", { error: err });
    });

    // Start the notification service for scheduled rooms
    notificationService.start();
  });
})();

/**
 * Get Socket.IO instance for emitting events from services
 * Used by turn management service to broadcast turn completions
 */
export function getIO(): SocketIOServer {
  return getSocketIO();
}

export { app, io, server };

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

/**
 * Perform a clean shutdown: stop accepting new connections, close existing
 * ones, then exit.  Gives in-flight requests up to 30 s to complete.
 */
async function shutdown(signal: string): Promise<void> {
  logger.info(`${signal} received — shutting down gracefully`);

  // Stop room orchestration loop first
  try {
    roomOrchestrationService.stop?.();
    notificationService.stop();
  } catch {
    /* non-fatal */
  }

  server.close((err) => {
    if (err) {
      logger.error("Error closing HTTP server", { error: err.message });
      process.exit(1);
    }
    logger.info("HTTP server closed");
    process.exit(0);
  });

  // Force-quit if close takes too long
  setTimeout(() => {
    logger.error("Graceful shutdown timed out — forcing exit");
    process.exit(1);
  }, 30_000).unref();
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
