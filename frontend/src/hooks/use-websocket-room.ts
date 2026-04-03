/**
 * useWebsocketRoom Hook
 * Manages real-time room data updates via WebSocket
 * Subscribes to room metrics, viewer counts, and status changes
 */

import { useState, useEffect, useRef, useCallback } from "react";
import type { DiscoveryRoom } from "common/types/discovery";

/**
 * Room metrics update event
 */
export interface RoomMetricsUpdate {
  roomId: string;
  viewerCount: number;
  trendingScore: number;
  status: "pending" | "live" | "scheduled" | "ended" | "closed" | "completed" | "cancelled" | "failed" | "archived";
  lastUpdated: string;
}

/**
 * WebSocket room subscription state
 */
export interface WebsocketRoomState {
  viewerCount: number;
  trendingScore: number;
  status: "pending" | "live" | "scheduled" | "ended" | "closed" | "completed" | "cancelled" | "failed" | "archived";
  lastUpdated: string | null;
  isConnected: boolean;
  error: Error | null;
}

const RECONNECT_INTERVAL = 3000; // 3 seconds
const RECONNECT_MAX_ATTEMPTS = 5;

/**
 * useWebsocketRoom Hook
 * Subscribes to real-time updates for a specific room
 *
 * @param roomId - The room ID to subscribe to
 * @param initialData - Initial room data
 * @returns Current room state with real-time updates
 */
export function useWebsocketRoom(
  roomId: string | null,
  initialData?: DiscoveryRoom
): WebsocketRoomState {
  const [state, setState] = useState<WebsocketRoomState>({
    viewerCount: initialData?.viewerCount ?? 0,
    trendingScore: initialData?.trendingScore ?? 0,
    status: initialData?.status ?? "pending",
    lastUpdated: null,
    isConnected: false,
    error: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const batchUpdatesRef = useRef<Map<string, RoomMetricsUpdate>>(new Map());
  const batchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Connect to WebSocket server
   */
  const connect = useCallback(() => {
    if (!roomId) return;

    try {
      const wsUrl = import.meta.env.VITE_WS_URL || import.meta.env.VITE_API_URL?.replace(/^http/, "ws") || "wss://clawzz-backend-live.up.railway.app";
      const ws = new WebSocket(wsUrl);

      ws.addEventListener("open", () => {
        // Subscribe to room metrics
        ws.send(
          JSON.stringify({
            type: "subscribe",
            channel: `room:${roomId}:metrics`,
          })
        );

        setState((prev) => ({
          ...prev,
          isConnected: true,
          error: null,
        }));

        reconnectAttemptsRef.current = 0;
      });

      ws.addEventListener("message", (event) => {
        try {
          const data = JSON.parse(event.data);

          // Handle metrics update
          if (data.type === "metrics-update") {
            batchUpdatesRef.current.set(data.roomId, {
              roomId: data.roomId,
              viewerCount: data.viewerCount ?? 0,
              trendingScore: data.trendingScore ?? 0,
              status: data.status ?? "pending",
              lastUpdated: new Date().toISOString(),
            });

            // Batch updates: only apply to state after a short delay
            if (batchTimeoutRef.current) {
              clearTimeout(batchTimeoutRef.current);
            }

            batchTimeoutRef.current = setTimeout(() => {
              const update = batchUpdatesRef.current.get(roomId);
              if (update) {
                setState((prev) => ({
                  ...prev,
                  viewerCount: update.viewerCount,
                  trendingScore: update.trendingScore,
                  status: update.status,
                  lastUpdated: update.lastUpdated,
                }));
                batchUpdatesRef.current.delete(roomId);
              }
            }, 100);
          }

          // Handle status change
          if (data.type === "status-change") {
            setState((prev) => ({
              ...prev,
              status: data.status,
              lastUpdated: new Date().toISOString(),
            }));
          }
        } catch (err) {
          console.error("Failed to parse WebSocket message:", err);
        }
      });

      ws.addEventListener("close", () => {
        setState((prev) => ({
          ...prev,
          isConnected: false,
        }));

        // Attempt to reconnect
        if (reconnectAttemptsRef.current < RECONNECT_MAX_ATTEMPTS) {
          reconnectAttemptsRef.current++;
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, RECONNECT_INTERVAL * reconnectAttemptsRef.current);
        }
      });

      ws.addEventListener("error", (event) => {
        const error = new Error(`WebSocket error: ${event.type}`);
        setState((prev) => ({
          ...prev,
          error,
          isConnected: false,
        }));

        // Attempt to reconnect
        if (reconnectAttemptsRef.current < RECONNECT_MAX_ATTEMPTS) {
          reconnectAttemptsRef.current++;
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, RECONNECT_INTERVAL * reconnectAttemptsRef.current);
        }
      });

      wsRef.current = ws;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setState((prev) => ({
        ...prev,
        error,
        isConnected: false,
      }));
    }
  }, [roomId]);

  /**
   * Disconnect from WebSocket
   */
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
    }

    setState((prev) => ({
      ...prev,
      isConnected: false,
    }));
  }, []);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    if (roomId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [roomId, connect, disconnect]);

  return state;
}

/**
 * useWebsocketRooms Hook
 * Subscribes to metrics for multiple rooms (for list views)
 *
 * @param roomIds - Array of room IDs to subscribe to
 * @returns Map of room ID to metrics state
 */
export function useWebsocketRooms(roomIds: string[]): Map<string, WebsocketRoomState> {
  const [metricsMap, setMetricsMap] = useState<Map<string, WebsocketRoomState>>(
    new Map()
  );

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (roomIds.length === 0) return;

    try {
      const wsUrl = import.meta.env.VITE_WS_URL || import.meta.env.VITE_API_URL?.replace(/^http/, "ws") || "wss://clawzz-backend-live.up.railway.app";
      const ws = new WebSocket(wsUrl);

      ws.addEventListener("open", () => {
        // Subscribe to all rooms
        roomIds.forEach((roomId) => {
          ws.send(
            JSON.stringify({
              type: "subscribe",
              channel: `room:${roomId}:metrics`,
            })
          );
        });

        reconnectAttemptsRef.current = 0;
      });

      ws.addEventListener("message", (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "metrics-update") {
            setMetricsMap((prev) => {
              const updated = new Map(prev);
              updated.set(data.roomId, {
                viewerCount: data.viewerCount ?? 0,
                trendingScore: data.trendingScore ?? 0,
                status: data.status ?? "pending",
                lastUpdated: new Date().toISOString(),
                isConnected: true,
                error: null,
              });
              return updated;
            });
          }
        } catch (err) {
          console.error("Failed to parse WebSocket message:", err);
        }
      });

      ws.addEventListener("close", () => {
        if (reconnectAttemptsRef.current < RECONNECT_MAX_ATTEMPTS) {
          reconnectAttemptsRef.current++;
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, RECONNECT_INTERVAL * reconnectAttemptsRef.current);
        }
      });

      ws.addEventListener("error", () => {
        if (reconnectAttemptsRef.current < RECONNECT_MAX_ATTEMPTS) {
          reconnectAttemptsRef.current++;
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, RECONNECT_INTERVAL * reconnectAttemptsRef.current);
        }
      });

      wsRef.current = ws;
    } catch (err) {
      console.error("WebSocket connection error:", err);
    }
  }, [roomIds]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    if (roomIds.length > 0) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [roomIds, connect, disconnect]);

  return metricsMap;
}
