/**
 * ClawHouse API Gateway
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
  requireAuth,
  startRateLimitCleanup,
} from "./middleware/index.js";
import { logger } from "./utils/logger.js";
import authRoutes from "./routes/auth-routes.js";
import roomRoutes from "./routes/room-routes.js";
import discoveryRoutes from "./routes/discovery-routes.js";
import agentRoutes from "./routes/agent-routes.js";
import podcastRoutes from "./routes/podcast-routes.js";

dotenv.config();

const app: Express = express();
const port = process.env.API_PORT || 4000;
const apiVersion = "v1";

// ============================================================================
// MIDDLEWARE SETUP
// ============================================================================

// Security
app.use(helmet());
app.use(cors());

// Logging
app.use(morgan("combined"));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting cleanup
startRateLimitCleanup();

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
    service: "clawhouse-api",
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

// ============================================================================
// API ROUTES
// ============================================================================

/**
 * Authentication routes
 */
app.use(`/api/${apiVersion}/auth`, authRoutes);

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
  socket.on("submit-message", (data: { text: string }) => {
    logger.debug("Message submitted", {
      socketId: socket.id,
      roomId,
      textLength: data.text.length,
    });

    socket.emit("message:queued", {
      messageId: crypto.randomUUID(),
      status: "candidate",
      timestamp: new Date().toISOString(),
    });
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
  logger.info(`🚀 ClawHouse API Gateway started`, {
    port,
    environment: process.env.NODE_ENV || "development",
    apiVersion,
  });
  logger.info(`📡 WebSocket ready at /rooms/:roomId`, {
    port,
  });
});

export { app, io, server };
