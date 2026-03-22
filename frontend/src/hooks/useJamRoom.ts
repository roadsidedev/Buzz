/**
 * useJamRoom Hook
 *
 * Custom hook for Jam audio room functionality using jam-core directly.
 * Provides room connection, state management, and audio controls.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { createJam } from "jam-core";

export interface JamState {
  inRoom: boolean;
  speakers: string[];
  listeners: string[];
  speaking: string[];
  muted: boolean;
  myId: string | null;
  roomId: string | null;
  [key: string]: any;
}

export interface JamApi {
  enterRoom: (roomId: string) => Promise<void>;
  leaveRoom: () => void;
  mute: (muted: boolean) => void;
  sendReaction: (emoji: string) => void;
  [key: string]: any;
}

export interface JamConfigOptions {
  jamConfig: {
    urls: {
      pantry: string;
      stun: string;
      turn: string;
    };
    sfu: boolean;
    development: boolean;
  };
  keys?: {
    publicKey: string;
    privateKey: string;
  };
}

export interface UseJamRoomOptions {
  roomId: string;
  publicKey?: string;   // optional — jam-core generates ephemeral keys if omitted
  privateKey?: string;  // optional — jam-core generates ephemeral keys if omitted
  pantryUrl?: string;
  stunUrl?: string;
  turnUrl?: string;
  autoJoin?: boolean;
}

export interface UseJamRoomReturn {
  state: JamState;
  api: JamApi;
  inRoom: boolean;
  speakers: string[];
  listeners: string[];
  speaking: string[];
  isMuted: boolean;
  isSpeaking: boolean;
  myId: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  toggleMute: () => void;
  sendReaction: (emoji: string) => void;
  error: string | null;
  isLoading: boolean;
}

export function useJamRoom(options: UseJamRoomOptions): UseJamRoomReturn {
  const {
    roomId,
    publicKey,
    privateKey,
    pantryUrl = import.meta.env.VITE_PANTRY_URL ||
      "http://localhost:3003/_/pantry",
    stunUrl = import.meta.env.VITE_STUN_URL || "stun:localhost:3478",
    turnUrl = import.meta.env.VITE_TURN_URL || "turn:localhost:3478",
    autoJoin = true,
  } = options;

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const jamRef = useRef<ReturnType<typeof createJam> | null>(null);

  // Initialize Jam
  useEffect(() => {
    if (!jamRef.current) {
      const config: JamConfigOptions = {
        jamConfig: {
          urls: {
            pantry: pantryUrl,
            stun: stunUrl,
            turn: turnUrl,
          },
          sfu: false, // P2P mode — SFU requires UDP ports Railway can't expose
          development: import.meta.env.DEV,
        },
        ...(publicKey && privateKey ? { keys: { publicKey, privateKey } } : {}),
        debug: import.meta.env.DEV,
      } as any;

      jamRef.current = createJam(config as any);
    }

    return () => {
      if (jamRef.current) {
        const [state, api] = jamRef.current;
        if (state.inRoom) {
          api.leaveRoom();
        }
      }
    };
  }, [pantryUrl, stunUrl, turnUrl, publicKey, privateKey]);

  const [state, api] = jamRef.current || [{}, {}];

  // Derived state
  const inRoom = (state as any).inRoom || false;
  const speakers = (state as any).speakers || [];
  const listeners = (state as any).listeners || [];
  const speaking = (state as any).speaking || [];
  const isMuted = (state as any).muted || false;
  const myId = (state as any).myId || null;
  const isSpeaking = speaking.includes(myId);

  // Connect to room
  const connect = useCallback(async () => {
    if (!jamRef.current) {
      setError("Jam not initialized");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [, jamApi] = jamRef.current;
      await (jamApi as any).enterRoom(roomId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
    } finally {
      setIsLoading(false);
    }
  }, [roomId]);

  // Disconnect from room
  const disconnect = useCallback(() => {
    if (jamRef.current) {
      const [, jamApi] = jamRef.current;
      (jamApi as any).leaveRoom();
    }
  }, []);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (jamRef.current) {
      const [jamState, jamApi] = jamRef.current;
      (jamApi as any).mute(!(jamState as any).muted);
    }
  }, []);

  // Send reaction
  const sendReaction = useCallback((emoji: string) => {
    if (jamRef.current) {
      const [, jamApi] = jamRef.current;
      (jamApi as any).sendReaction(emoji);
    }
  }, []);

  // Auto-join if enabled
  useEffect(() => {
    if (autoJoin && !inRoom && !isLoading && !error) {
      connect();
    }
  }, [autoJoin, inRoom, isLoading, error, connect]);

  // Force re-render on state changes
  const [, forceUpdate] = useState({});
  useEffect(() => {
    if (jamRef.current) {
      const [jamState] = jamRef.current;
      const unsubscribe = (jamState as any).on?.(() => forceUpdate({}));
      return unsubscribe;
    }
  }, []);

  return {
    state: state as JamState,
    api: api as JamApi,
    inRoom,
    speakers,
    listeners,
    speaking,
    isMuted,
    isSpeaking,
    myId,
    connect,
    disconnect,
    toggleMute,
    sendReaction,
    error,
    isLoading,
  };
}

export default useJamRoom;
