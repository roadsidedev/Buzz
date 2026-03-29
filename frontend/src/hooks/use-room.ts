/**
 * Custom Hook: useRoom
 *
 * Manages live room state, messaging, and orchestrator events.
 * Integrates with WebSocket for real-time updates.
 */

import { useState, useCallback, useEffect } from "react";
import { apiClient } from "../services/api";
import { wsService } from "../services/websocket";
import { Room, Message, CreateRoomRequest, WsEvents } from "../types";

interface UseRoomState {
  room: Room | null;
  messages: Message[];
  selectedMessages: Message[];
  isLoading: boolean;
  error: Error | null;
  wsConnected: boolean;
  /** Set when the WebSocket has disconnected unexpectedly (M9). */
  connectionError: Error | null;
}

/**
 * Hook for managing live room state and real-time interactions
 */
export function useRoom(roomId?: string) {
  const [state, setState] = useState<UseRoomState>({
    room: null,
    messages: [],
    selectedMessages: [],
    isLoading: false,
    error: null,
    wsConnected: false,
    connectionError: null,
  });

  /**
   * Fetch room details
   */
  const fetchRoom = useCallback(async (id: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const room = await apiClient.getRoom(id);
      setState((prev) => ({ ...prev, room, isLoading: false }));
      return room;
    } catch (error) {
      const err =
        error instanceof Error ? error : new Error("Failed to fetch room");
      setState((prev) => ({ ...prev, error: err, isLoading: false }));
      throw error;
    }
  }, []);

  /**
   * Create new room
   */
  const createRoom = useCallback(async (payload: CreateRoomRequest) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const room = await apiClient.createRoom(payload);
      setState((prev) => ({ ...prev, room, isLoading: false }));
      return room;
    } catch (error) {
      const err =
        error instanceof Error ? error : new Error("Failed to create room");
      setState((prev) => ({ ...prev, error: err, isLoading: false }));
      throw error;
    }
  }, []);

  /**
   * Submit message to room (via REST or WebSocket)
   */
  const submitMessage = useCallback(
    async (text: string) => {
      if (!state.room) {
        throw new Error("No active room");
      }

      try {
        const result = await apiClient.submitMessage({
          roomId: state.room.id,
          text,
        });

        const message: Message = {
          id: result.messageId,
          roomId: state.room.id,
          agentId: "", // Will be populated by backend
          text,
          score: result.score,
          selected: result.selected,
          createdAt: new Date(),
        };

        setState((prev) => ({
          ...prev,
          messages: [...prev.messages, message],
        }));

        return result;
      } catch (error) {
        const err =
          error instanceof Error
            ? error
            : new Error("Failed to submit message");
        setState((prev) => ({ ...prev, error: err }));
        throw error;
      }
    },
    [state.room],
  );

  /**
   * Close room
   */
  const closeRoom = useCallback(async () => {
    if (!state.room) {
      throw new Error("No active room");
    }

    try {
      const closed = await apiClient.closeRoom(state.room.id);
      setState((prev) => ({ ...prev, room: closed }));
      return closed;
    } catch (error) {
      const err =
        error instanceof Error ? error : new Error("Failed to close room");
      setState((prev) => ({ ...prev, error: err }));
      throw error;
    }
  }, [state.room]);

  /**
   * Setup WebSocket listeners for real-time updates
   */
  useEffect(() => {
    if (!roomId) return;

    // Connect WebSocket if not already
    if (!wsService.isConnectedStatus()) {
      wsService.connect(apiClient.getToken() || undefined).catch((err) => {
        const connErr = err instanceof Error ? err : new Error("WebSocket connection failed");
        setState((prev) => ({ ...prev, wsConnected: false, connectionError: connErr }));
      });
    }

    // Join room
    wsService.joinRoom(roomId);
    setState((prev) => ({ ...prev, wsConnected: true, connectionError: null }));

    // Track live connection state so the UI can show a reconnection banner (M9).
    const handleDisconnect = () => {
      setState((prev) => ({
        ...prev,
        wsConnected: false,
        connectionError: new Error("Real-time connection lost. Attempting to reconnect…"),
      }));
    };

    const handleReconnect = () => {
      setState((prev) => ({ ...prev, wsConnected: true, connectionError: null }));
    };

    wsService.on("disconnect", handleDisconnect);
    wsService.on("connect", handleReconnect);

    // Listen for message selection
    const unsubMessageSelected = wsService.onMessageSelected(
      (data: WsEvents.MessageSelected) => {
        if (data.roomId === roomId) {
          setState((prev) => ({
            ...prev,
            selectedMessages: [
              ...prev.selectedMessages,
              {
                id: data.messageId,
                roomId: data.roomId,
                agentId: data.agentId,
                text: "", // Text not provided in event
                score: data.score,
                selected: true,
                createdAt: new Date(),
              },
            ],
          }));
        }
      },
    );

    // Listen for audio playing
    const unsubAudioPlaying = wsService.onAudioPlaying(
      (data: WsEvents.AudioPlaying) => {
        if (data.roomId === roomId) {
          console.log("Audio playing:", data);
        }
      },
    );

    return () => {
      unsubMessageSelected();
      unsubAudioPlaying();
      wsService.off("disconnect", handleDisconnect);
      wsService.off("connect", handleReconnect);
      wsService.leaveRoom(roomId);
    };
  }, [roomId]);

  return {
    ...state,
    fetchRoom,
    createRoom,
    submitMessage,
    closeRoom,
  };
}
