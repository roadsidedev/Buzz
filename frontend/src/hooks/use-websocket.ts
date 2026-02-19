/**
 * Custom Hook: useWebSocket
 *
 * Manages WebSocket connection lifecycle and event subscriptions.
 * Provides a clean interface for components to subscribe to real-time events.
 */

import { useState, useCallback, useEffect } from 'react';
import { wsService } from '../services/websocket';
import { apiClient } from '../services/api';

interface UseWebSocketState {
  isConnected: boolean;
  error: Error | null;
}

/**
 * Hook for managing WebSocket connection and event subscriptions
 */
export function useWebSocket() {
  const [state, setState] = useState<UseWebSocketState>({
    isConnected: wsService.isConnectedStatus(),
    error: null,
  });

  /**
   * Connect to WebSocket
   */
  const connect = useCallback(async (authToken?: string) => {
    setState((prev) => ({ ...prev, error: null }));

    try {
      const token = authToken || apiClient.getToken() || undefined;
      await wsService.connect(token);
      setState((prev) => ({ ...prev, isConnected: true }));
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to connect');
      setState((prev) => ({ ...prev, error: err, isConnected: false }));
      throw error;
    }
  }, []);

  /**
   * Disconnect from WebSocket
   */
  const disconnect = useCallback(() => {
    wsService.disconnect();
    setState((prev) => ({ ...prev, isConnected: false }));
  }, []);

  /**
   * Subscribe to event
   */
  const subscribe = useCallback(
    <T = unknown,>(event: string, callback: (data: T) => void): (() => void) => {
      wsService.on<T>(event, callback);

      // Return unsubscribe function
      return () => {
        wsService.off(event, callback as any);
      };
    },
    []
  );

  /**
   * Auto-connect on mount if not already connected
   */
  useEffect(() => {
    if (!state.isConnected && !wsService.isConnectedStatus()) {
      connect().catch((err) => {
        console.error('Auto-connect failed:', err);
      });
    }

    return () => {
      // Don't disconnect on unmount to maintain connection for other components
    };
  }, []);

  return {
    isConnected: state.isConnected,
    error: state.error,
    connect,
    disconnect,
    subscribe,
  };
}
