/**
 * WebSocket Service
 *
 * Real-time event listener for room updates, episode generation progress,
 * and message orchestration. Uses socket.io for reliable WebSocket communication.
 */

import { io, Socket } from "socket.io-client";
import { WsEvents } from "../types/index";

/**
 * WebSocket event handler callback type
 */
type EventCallback<T = unknown> = (data: T) => void;

/**
 * WebSocket service for real-time updates
 */
export class WebSocketService {
  private socket: Socket | null = null;
  private wsUrl: string;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;
  private listeners: Map<string, Set<EventCallback<any>>> = new Map();
  // Rooms to (re-)join once the socket connects
  private pendingRooms: Set<string> = new Set();

  constructor(wsUrl?: string) {
    this.wsUrl = wsUrl || import.meta.env.VITE_WS_URL || "ws://localhost:4000";
  }

  /**
   * Connect to WebSocket server
   */
  public connect(authToken?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const socketUrl = this.wsUrl.replace(/^http/, "ws");

        this.socket = io(socketUrl, {
          auth: authToken ? { token: authToken } : undefined,
          reconnection: true,
          reconnectionDelay: this.reconnectDelay,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: this.maxReconnectAttempts,
          transports: ["websocket", "polling"],
        });

        this.socket.on("connect", () => {
          this.isConnected = true;
          this.reconnectAttempts = 0;
          console.log("[WebSocket] Connected");

          // Re-register any event listeners that were set up before the socket existed
          this.listeners.forEach((_, event) => {
            if (this.socket && !this.socket.hasListeners(event)) {
              this.socket.on(event, (data: unknown) => {
                this.emit(event, data);
              });
            }
          });

          // Flush any rooms that tried to join before connection was ready
          this.pendingRooms.forEach((roomId) => {
            this.socket!.emit("room:join", { roomId });
          });
          this.pendingRooms.clear();

          resolve();
        });

        this.socket.on("disconnect", () => {
          this.isConnected = false;
          console.log("[WebSocket] Disconnected");
        });

        // On automatic reconnect, re-join all active rooms
        this.socket.io.on("reconnect", () => {
          this.pendingRooms.forEach((roomId) => {
            this.socket?.emit("room:join", { roomId });
          });
          this.pendingRooms.clear();
        });

        this.socket.on("connect_error", (error: Error) => {
          console.error("[WebSocket] Connection error:", error.message);
          if (this.reconnectAttempts === 0) {
            reject(error);
          }
        });

        this.socket.on("error", (error: unknown) => {
          console.error("[WebSocket] Error:", error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      console.log("[WebSocket] Disconnected");
    }
  }

  /**
   * Check if connected to WebSocket
   */
  public isConnectedStatus(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  /**
   * Register event listener.
   * If the socket doesn't exist yet (connect() not called), the socket.io
   * listener is registered lazily on the next connect() call via the
   * connect handler above.
   */
  public on<T = unknown>(event: string, callback: EventCallback<T>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());

      // Register socket listener only once per event type
      if (this.socket && !this.socket.hasListeners(event)) {
        this.socket.on(event, (data: T) => {
          this.emit(event, data);
        });
      }
      // If socket is null the connect() handler will register it on first connection
    }

    this.listeners.get(event)?.add(callback);
  }

  /**
   * Unregister event listener
   */
  public off(event: string, callback: EventCallback<any>): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);

      // Remove socket listener if no more callbacks
      if (callbacks.size === 0 && this.socket) {
        this.socket.off(event);
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Emit event to all local listeners
   */
  private emit<T = unknown>(event: string, data: T): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((callback: EventCallback<any>) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[WebSocket] Error in listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Send event to server via WebSocket
   */
  public send<T = unknown>(
    event: string,
    data?: unknown,
    callback?: (response: T) => void
  ): void {
    if (!this.isConnectedStatus()) {
      console.error("[WebSocket] Not connected, cannot send event:", event);
      return;
    }

    if (callback) {
      this.socket?.emit(event, data, callback);
    } else {
      this.socket?.emit(event, data);
    }
  }

  /**
   * Join a room for real-time updates.
   * If the socket is not yet connected, the join is queued and sent once connected.
   */
  public joinRoom(roomId: string, agentId?: string): void {
    if (!this.isConnectedStatus()) {
      // Queue for when the socket connects/reconnects
      this.pendingRooms.add(roomId);
      return;
    }
    this.socket?.emit("room:join", { roomId, agentId });
  }

  /**
   * Leave a room
   */
  public leaveRoom(roomId: string): void {
    this.pendingRooms.delete(roomId);
    this.send("room:leave", { roomId });
  }

  /**
   * Submit message to room via WebSocket
   */
  public submitRoomMessage(roomId: string, text: string): void {
    this.send("message:submit", { roomId, text });
  }

  /**
   * Listen for episode generation progress updates
   */
  public onEpisodeGenerating(callback: EventCallback<WsEvents.EpisodeGenerating>): () => void {
    this.on("episode:generating", callback);
    return () => this.off("episode:generating", callback);
  }

  /**
   * Listen for episode ready event
   */
  public onEpisodeReady(callback: EventCallback<WsEvents.EpisodeReady>): () => void {
    this.on("episode:ready", callback);
    return () => this.off("episode:ready", callback);
  }

  /**
   * Listen for episode generation failure
   */
  public onEpisodeFailed(callback: EventCallback<WsEvents.EpisodeFailed>): () => void {
    this.on("episode:failed", callback);
    return () => this.off("episode:failed", callback);
  }

  /**
   * Listen for room created event
   */
  public onRoomCreated(callback: EventCallback<WsEvents.RoomCreated>): () => void {
    this.on("room:created", callback);
    return () => this.off("room:created", callback);
  }

  /**
   * Listen for agent joined room
   */
  public onRoomJoined(callback: EventCallback<WsEvents.RoomJoined>): () => void {
    this.on("room:joined", callback);
    return () => this.off("room:joined", callback);
  }

  /**
   * Listen for message selection by orchestrator
   */
  public onMessageSelected(callback: EventCallback<WsEvents.MessageSelected>): () => void {
    this.on("message:selected", callback);
    return () => this.off("message:selected", callback);
  }

  /**
   * Listen for audio playback start
   */
  public onAudioPlaying(callback: EventCallback<WsEvents.AudioPlaying>): () => void {
    this.on("audio:playing", callback);
    return () => this.off("audio:playing", callback);
  }

  /**
   * Listen for a participant joining the room (agent or listener)
   */
  public onParticipantJoined(
    callback: EventCallback<{ roomId: string; agentId: string; role: string; timestamp: string }>
  ): () => void {
    this.on("participant:joined", callback);
    return () => this.off("participant:joined", callback);
  }

  /**
   * Listen for a participant leaving the room
   */
  public onParticipantLeft(
    callback: EventCallback<{ roomId: string; agentId: string; timestamp: string }>
  ): () => void {
    this.on("participant:left", callback);
    return () => this.off("participant:left", callback);
  }

  /**
   * Listen for real-time room status changes (pending → live → completed)
   */
  public onRoomStatusChanged(
    callback: EventCallback<{ roomId: string; status: string; timestamp: string }>
  ): () => void {
    this.on("room:status-changed", callback);
    return () => this.off("room:status-changed", callback);
  }

  /**
   * Listen for orchestrator turn completion (winner selected, audio generated)
   */
  public onTurnCompleted(callback: EventCallback<any>): () => void {
    this.on("turn:completed", callback);
    return () => this.off("turn:completed", callback);
  }

  /**
   * Listen for orchestrator inactivity warning
   */
  public onRoomNudge(callback: EventCallback<any>): () => void {
    this.on("room:nudge", callback);
    return () => this.off("room:nudge", callback);
  }

  /**
   * Listen for orchestrator room timeout event
   */
  public onRoomTimeout(callback: EventCallback<any>): () => void {
    this.on("room:timeout", callback);
    return () => this.off("room:timeout", callback);
  }
}

/**
 * Create and export default WebSocket service instance
 */
export const wsService = new WebSocketService();

// Export type for dependency injection
export default wsService;
