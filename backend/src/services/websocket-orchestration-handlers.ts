// @ts-nocheck
/**
 * WebSocket Orchestration Handlers
 *
 * Real-time event broadcasting for turn-based room orchestration:
 * - message:submitted - Agent submitted a message
 * - turn:selected - Turn selected a message
 * - room:completion - Room progress updated
 * - room:completed - Room finished
 *
 * Part of Day 7: Task 7 - Real-time Events
 */

import type { Server as SocketIOServer, Socket } from "socket.io";
import type { RoomMessage } from "@common/types/index";
import { logger } from "../utils/logger.js";

// ===================================================================
// Type Definitions
// ===================================================================

export interface TurnSelectedEvent {
  roomId: string;
  turnNumber: number;
  messageId: string;
  agentId: string;
  text: string;
  score: number;
}

export interface RoomCompletionEvent {
  roomId: string;
  completionPercentage: number;
  completionLevel: "minimum" | "standard" | "exceptional";
  nextMilestone?: string;
}

export interface RoomCompletedEvent {
  roomId: string;
  completionLevel: "minimum" | "standard" | "exceptional";
  totalTurns: number;
  transcript: RoomMessage[];
}

// ===================================================================
// Event Emitters
// ===================================================================

/**
 * Emit when agent submits a message
 *
 * Broadcast to room subscribers
 */
export function emitMessageSubmitted(
  io: SocketIOServer,
  roomId: string,
  message: RoomMessage,
): void {
  const event = "message:submitted";

  io.to(roomId).emit(event, {
    messageId: message.id,
    agentId: message.agentId,
    text: message.text,
    createdAt: message.createdAt,
    status: message.status,
  });

  logger.debug("Emitted message:submitted", {
    roomId,
    messageId: message.id,
  });
}

/**
 * Emit when turn selection completes
 *
 * Broadcast to room subscribers with selected message details
 */
export function emitTurnSelected(
  io: SocketIOServer,
  roomId: string,
  event: TurnSelectedEvent,
): void {
  io.to(roomId).emit("turn:selected", {
    roomId: event.roomId,
    turnNumber: event.turnNumber,
    selectedMessageId: event.messageId,
    selectedAgentId: event.agentId,
    text: event.text,
    score: event.score,
    timestamp: new Date(),
  });

  logger.info("Emitted turn:selected", {
    roomId,
    turnNumber: event.turnNumber,
    messageId: event.messageId,
  });
}

/**
 * Emit when room completion percentage updates
 *
 * Broadcast to room subscribers with progress
 */
export function emitRoomCompletion(
  io: SocketIOServer,
  roomId: string,
  event: RoomCompletionEvent,
): void {
  io.to(roomId).emit("room:completion", {
    roomId: event.roomId,
    completionPercentage: event.completionPercentage,
    completionLevel: event.completionLevel,
    nextMilestone: event.nextMilestone,
    timestamp: new Date(),
  });

  logger.debug("Emitted room:completion", {
    roomId,
    completionPercentage: event.completionPercentage,
    level: event.completionLevel,
  });
}

/**
 * Emit when room finishes (completed, cancelled, or failed)
 *
 * Broadcast to all room subscribers with final data
 */
export function emitRoomCompleted(
  io: SocketIOServer,
  roomId: string,
  event: RoomCompletedEvent,
): void {
  io.to(roomId).emit("room:completed", {
    roomId: event.roomId,
    completionLevel: event.completionLevel,
    totalTurns: event.totalTurns,
    transcriptLineCount: event.transcript.length,
    finalTranscript: event.transcript,
    timestamp: new Date(),
  });

  logger.info("Emitted room:completed", {
    roomId,
    completionLevel: event.completionLevel,
    turns: event.totalTurns,
  });
}

/**
 * Emit when turn status updates
 *
 * Broadcast current turn info
 */
export function emitTurnStatusUpdate(
  io: SocketIOServer,
  roomId: string,
  data: {
    currentTurn: number;
    candidateCount: number;
    nextTurnAt: Date;
  },
): void {
  io.to(roomId).emit("turn:status", {
    roomId,
    currentTurn: data.currentTurn,
    candidateCount: data.candidateCount,
    nextTurnAt: data.nextTurnAt,
    timestamp: new Date(),
  });

  logger.debug("Emitted turn:status", {
    roomId,
    currentTurn: data.currentTurn,
    candidates: data.candidateCount,
  });
}

/**
 * Emit when orchestrator fails (graceful degradation)
 *
 * Notify subscribers of orchestrator issues
 */
export function emitOrchestratorError(
  io: SocketIOServer,
  roomId: string,
  error: string,
): void {
  io.to(roomId).emit("orchestrator:error", {
    roomId,
    error,
    timestamp: new Date(),
    severity: "warning",
  });

  logger.warn("Emitted orchestrator:error", {
    roomId,
    error,
  });
}

/**
 * Emit when agent statistics update
 *
 * Broadcast per-agent stats
 */
export function emitAgentStatsUpdate(
  io: SocketIOServer,
  roomId: string,
  data: {
    agentId: string;
    submitted: number;
    selected: number;
    selectionRate: number;
    averageScore: number;
  },
): void {
  io.to(roomId).emit("agent:stats", {
    roomId,
    agentId: data.agentId,
    submitted: data.submitted,
    selected: data.selected,
    selectionRate: data.selectionRate,
    averageScore: Math.round(data.averageScore),
    timestamp: new Date(),
  });

  logger.debug("Emitted agent:stats", {
    roomId,
    agentId: data.agentId,
    selectionRate: data.selectionRate,
  });
}

// ===================================================================
// WebSocket Handler Registration
// ===================================================================

/**
 * Register orchestration event listeners
 *
 * Called when socket connects to room
 */
export function registerOrchestratorHandlers(
  socket: Socket,
  io: SocketIOServer,
): void {
  const roomId = socket.handshake.query.roomId as string;

  if (!roomId) {
    logger.warn("Socket connected without roomId", {
      socketId: socket.id,
    });
    return;
  }

  // Join room-specific channel
  socket.join(roomId);

  logger.info("Socket subscribed to orchestration events", {
    socketId: socket.id,
    roomId,
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    logger.debug("Socket disconnected from room", {
      socketId: socket.id,
      roomId,
    });
  });

  // Handle errors
  socket.on("error", (err) => {
    logger.error("WebSocket error", {
      socketId: socket.id,
      roomId,
      error: err instanceof Error ? err.message : String(err),
    });
  });
}

/**
 * Broadcast event to all room subscribers
 *
 * Helper function for emitting to a specific room
 */
export function broadcastToRoom(
  io: SocketIOServer,
  roomId: string,
  eventName: string,
  data: unknown,
): void {
  io.to(roomId).emit(eventName, {
    ...data,
    roomId,
    timestamp: new Date(),
  });

  logger.debug("Broadcast to room", {
    roomId,
    event: eventName,
  });
}

/**
 * Notify specific agent
 *
 * Send event to agent's sockets only
 */
export function notifyAgent(
  io: SocketIOServer,
  roomId: string,
  agentId: string,
  eventName: string,
  data: unknown,
): void {
  // TODO: Implement agent-specific routing via socket.io adapter
  // For now, broadcast to room and filter on client
  io.to(roomId).emit(`agent:${eventName}`, {
    ...data,
    agentId,
    roomId,
    timestamp: new Date(),
  });

  logger.debug("Notified agent", {
    roomId,
    agentId,
    event: eventName,
  });
}

// ===================================================================
// Event Type Definitions for TypeScript
// ===================================================================

declare global {
  namespace SocketIO {
    interface ServerToClientEvents {
      "message:submitted": (data: {
        messageId: string;
        agentId: string;
        text: string;
        createdAt: Date;
        status: string;
      }) => void;

      "turn:selected": (data: TurnSelectedEvent & { timestamp: Date }) => void;

      "room:completion": (
        data: RoomCompletionEvent & { timestamp: Date }
      ) => void;

      "room:completed": (data: RoomCompletedEvent & { timestamp: Date }) => void;

      "turn:status": (data: {
        roomId: string;
        currentTurn: number;
        candidateCount: number;
        nextTurnAt: Date;
        timestamp: Date;
      }) => void;

      "orchestrator:error": (data: {
        roomId: string;
        error: string;
        timestamp: Date;
        severity: string;
      }) => void;

      "agent:stats": (data: {
        roomId: string;
        agentId: string;
        submitted: number;
        selected: number;
        selectionRate: number;
        averageScore: number;
        timestamp: Date;
      }) => void;
    }

    interface ClientToServerEvents {
      // No client-to-server events for orchestration (read-only)
    }
  }
}

export {};
