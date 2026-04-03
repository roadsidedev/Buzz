/**
 * Room Heartbeat Hook
 *
 * Sends periodic heartbeats to keep rooms visible in discovery feeds.
 * The backend filters live rooms by `last_seen_at > NOW() - INTERVAL '60 seconds'`.
 * This hook sends a heartbeat every 30 seconds (half the staleness threshold)
 * to ensure the room never disappears while any authenticated user is present.
 *
 * Works for both audio rooms and livestreams.
 * Uses WebSocket (primary) with REST API fallback (host-only).
 *
 * Usage:
 *   useRoomHeartbeat(roomId, isAuthenticated);
 *
 * @param roomId - The room/livestream ID to send heartbeats for
 * @param isActive - Whether the user is actively viewing the room (authenticated)
 */

import { useEffect, useRef } from "react";
import wsService from "@/services/websocket";
import { apiClient } from "@/services/api";

const HEARTBEAT_INTERVAL_MS = 30_000;

export function useRoomHeartbeat(roomId: string | undefined, isActive: boolean): void {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!roomId || !isActive) return;

    const sendHeartbeat = () => {
      // Primary: WebSocket heartbeat (accepted from any connected user)
      if (wsService.isConnectedStatus()) {
        wsService.sendHeartbeat(roomId);
      }
      // REST fallback skipped — only hosts can heartbeat via REST
      // WebSocket is the reliable path for all authenticated viewers
    };

    // Send immediately so room appears in discovery right away
    sendHeartbeat();

    // Then send every 30 seconds
    intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [roomId, isActive]);
}
