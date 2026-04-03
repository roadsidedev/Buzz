/**
 * Room Heartbeat Hook
 *
 * Sends periodic heartbeats to keep rooms visible in discovery feeds.
 * The backend filters live rooms by `last_seen_at > NOW() - INTERVAL '60 seconds'`.
 * This hook sends a heartbeat every 30 seconds (half the staleness threshold)
 * to ensure the room never disappears while the host is present.
 *
 * Works for both audio rooms and livestreams.
 * Falls back to REST API if WebSocket is not connected.
 *
 * Usage:
 *   useRoomHeartbeat(roomId, isHost);
 *
 * @param roomId - The room/livestream ID to send heartbeats for
 * @param isHost - Whether the current user is the room host (only hosts can heartbeat)
 */

import { useEffect, useRef } from "react";
import wsService from "@/services/websocket";
import { apiClient } from "@/services/api";

const HEARTBEAT_INTERVAL_MS = 30_000;

export function useRoomHeartbeat(roomId: string | undefined, isHost: boolean): void {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!roomId || !isHost) return;

    const sendHeartbeat = () => {
      if (wsService.isConnectedStatus()) {
        wsService.sendHeartbeat(roomId);
      } else {
        apiClient
          .post(`/rooms/${roomId}/heartbeat`, {})
          .catch((err) =>
            console.warn("[Heartbeat] REST heartbeat failed:", err)
          );
      }
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
  }, [roomId, isHost]);
}
