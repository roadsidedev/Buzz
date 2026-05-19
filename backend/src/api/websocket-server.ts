import { Server as SocketIOServer } from "socket.io";
import { Server as HttpServer } from "http";
import { logger } from "../utils/logger.js";
import {
  createValidatedHandler,
  cleanupSocketRateLimit,
} from "../middleware/websocket-validation.js";
import { messageService } from "../services/message-service.js";
import { orchestratorClient } from "../services/orchestrator-client.js";

let io: SocketIOServer | null = null;

/**
 * Initialize WebSocket server
 */
export function initializeWebSocket(server: HttpServer): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: {
      origin: process.env.CORS_ALLOWED_ORIGINS
        ? process.env.CORS_ALLOWED_ORIGINS.split(",").map((o) => o.trim())
        : [
            "http://localhost:3000",
            "http://localhost:5173",
            "https://buzz-live.vercel.app",
            "https://www.Buzz.io",
            "https://Buzz.io",
          ],
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  setupRoomNamespace(io);
  setupMainNamespace(io);

  return io;
}

/**
 * Setup regex-based namespace for agent room connections
 */
function setupRoomNamespace(io: SocketIOServer): void {
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

        // Store agentId on socket for use in subsequent events
        sock.data.agentId = data.agentId;

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
      createValidatedHandler("submit-message", async (data, sock) => {
        const agentId = sock.data.agentId as string | undefined;

        if (!agentId) {
          sock.emit("error", {
            code: "NOT_JOINED",
            message: "Must join the room before submitting messages",
          });
          return;
        }

        logger.debug("Message submitted", {
          socketId: sock.id,
          roomId,
          agentId,
          textLength: data.text.length,
        });

        // Persist to database
        const message = await messageService.createMessage(roomId, agentId, data.text);

        // Forward to orchestrator for scoring queue
        try {
          await orchestratorClient.submitMessage(roomId, message);
        } catch (orchErr) {
          logger.warn("Failed to submit message to orchestrator (will retry on next turn)", {
            roomId,
            messageId: message.id,
            error: orchErr instanceof Error ? orchErr.message : String(orchErr),
          });
        }

        sock.emit("message:queued", {
          messageId: message.id,
          status: message.status,
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

    // Handle host heartbeat — agents send this every ~30s to signal liveness
    socket.on("room:heartbeat", async () => {
      try {
        const { roomService } = await import("../services/room-service.js");
        await roomService.recordHeartbeat(roomId);
        logger.debug("Heartbeat recorded", { socketId: socket.id, roomId });
      } catch (err) {
        logger.warn("Failed to record heartbeat", {
          socketId: socket.id,
          roomId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });

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
}

/**
 * Setup main namespace for browser client subscriptions
 */
function setupMainNamespace(io: SocketIOServer): void {
  io.on("connection", (socket) => {
    // Track which rooms this socket has joined so we can emit leave on disconnect
    const joinedRooms = new Set<string>();

    socket.on("room:join", async (data: { roomId?: string; agentId?: string; role?: string }) => {
      if (typeof data?.roomId === "string" && data.roomId) {
        const roomId = data.roomId;
        const role = data.role || "spectator";
        socket.join(`room:${roomId}`);
        joinedRooms.add(roomId);

        logger.debug("Browser client joined room socket", {
          socketId: socket.id,
          roomId,
          role,
        });

        // Resolve agent identity from the provided agentId.
        // If a valid UUID agentId is supplied, look up the full profile
        // (name + avatar) from the database so the frontend can display
        // the real username and profile picture immediately without an
        // extra HTTP fetch.
        const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const rawAgentId = data.agentId && UUID_RE.test(data.agentId) ? data.agentId : undefined;

        let agentName: string | undefined;
        let agentAvatar: string | undefined;

        if (rawAgentId) {
          try {
            const { buzzAuthService } = await import("../services/index.js");
            const agent = await buzzAuthService.getAgentById(rawAgentId);
            if (agent) {
              agentName = agent.name;
              agentAvatar = agent.avatar;
            }
          } catch (err) {
            logger.warn("Failed to resolve agent for room join", {
              roomId,
              agentId: rawAgentId,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }

        io.to(`room:${roomId}`).emit("participant:joined", {
          roomId,
          agentId: rawAgentId,
          agentName: agentName || (rawAgentId ? undefined : "Anonymous Listener"),
          agentAvatar,
          role,
          timestamp: new Date().toISOString(),
        });
      }
    });

    socket.on("room:leave", (data: { roomId?: string }) => {
      if (typeof data?.roomId === "string" && data.roomId) {
        const roomId = data.roomId;
        socket.leave(`room:${roomId}`);
        joinedRooms.delete(roomId);

        io.to(`room:${roomId}`).emit("participant:left", {
          roomId,
          agentId: socket.id,
          timestamp: new Date().toISOString(),
        });
      }
    });

    socket.on("disconnect", () => {
      // Emit participant:left for every room this socket was in
      joinedRooms.forEach((roomId) => {
        io.to(`room:${roomId}`).emit("participant:left", {
          roomId,
          agentId: socket.id,
          timestamp: new Date().toISOString(),
        });
      });
      joinedRooms.clear();
    });
  });
}

/**
 * Get Socket.IO instance
 */
export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error("Socket.IO not initialized");
  }
  return io;
}
