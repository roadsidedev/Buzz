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
  // All rooms currently subscribed to — persists through reconnects so
  // socket.io auto-reconnect always restores live room event delivery.
  // Maps roomId -> role for proper reconnection with listener/speaker role.
  private joinedRooms: Map<string, string> = new Map();

  constructor(wsUrl?: string) {
    if (wsUrl) {
      this.wsUrl = wsUrl;
    } else if (import.meta.env.VITE_WS_URL) {
      this.wsUrl = import.meta.env.VITE_WS_URL;
    } else if (import.meta.env.VITE_API_URL) {
      // Derive WS URL from API URL, stripping any path prefix (e.g. /api/v1)
      // Socket.IO appends its own /socket.io/ path, so we need the bare origin.
      const apiOrigin = new URL(import.meta.env.VITE_API_URL);
      this.wsUrl = `wss://${apiOrigin.host}`;
    } else if (import.meta.env.REACT_APP_WS_URL) {
      this.wsUrl = import.meta.env.REACT_APP_WS_URL;
    } else if (import.meta.env.REACT_APP_API_URL) {
      const apiOrigin = new URL(import.meta.env.REACT_APP_API_URL);
      this.wsUrl = `wss://${apiOrigin.host}`;
    } else {
      // Production fallback: Railway backend WebSocket URL
      this.wsUrl = "wss://clawzz-backend-live.up.railway.app";
    }
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

          // (Re-)join all tracked rooms — handles both the initial connect and
          // every subsequent auto-reconnect. joinedRooms is never cleared, so
          // room subscriptions are fully restored after a network blip.
          this.joinedRooms.forEach((role, roomId) => {
            this.socket!.emit("room:join", { roomId, role });
          });

          resolve();
        });

        this.socket.on("disconnect", (reason) => {
          this.isConnected = false;
          console.log("[WebSocket] Disconnected:", reason);
        });

        this.socket.on("reconnect", (attemptNumber) => {
          console.log("[WebSocket] Reconnected after", attemptNumber, "attempts");
          // Emit a reconnect event so consumers can refresh stale state
          this.emit("reconnected", { attemptNumber });
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
   * Persists across reconnects — if the socket isn't connected yet the join
   * is sent automatically once the connection is established.
   */
  public joinRoom(roomId: string, agentId?: string, role?: string): void {
    this.joinedRooms.set(roomId, role || "spectator"); // persist for reconnect recovery
    if (!this.isConnectedStatus()) {
      return; // connect handler will flush joinedRooms on next connect
    }
    this.socket?.emit("room:join", { roomId, agentId, role: role || "spectator" });
  }

  /**
   * Leave a room
   */
  public leaveRoom(roomId: string): void {
    this.joinedRooms.delete(roomId);
    this.send("room:leave", { roomId });
  }

  /**
   * Send a host heartbeat to keep the room visible in discovery.
   * Emits the room:heartbeat event that the backend handles at server.ts:509-522.
   *
   * @param roomId - Room ID to send heartbeat for
   */
  public sendHeartbeat(roomId: string): void {
    this.send("room:heartbeat", { roomId });
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
    callback: EventCallback<{ roomId: string; agentId: string; agentName?: string; role: string; timestamp: string }>
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
