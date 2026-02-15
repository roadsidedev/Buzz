/**
 * Custom Hook: useEpisode
 *
 * Manages episode state including generation progress, playback, and polling.
 * Integrates with WebSocket for real-time generation updates.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { apiClient } from '../services/api';
import { wsService } from '../services/websocket';
import { Episode, CreateEpisodeRequest, EpisodeStatus, WsEvents } from '../types';

interface UseEpisodeState {
  episode: Episode | null;
  isLoading: boolean;
  error: Error | null;
  progress: number; // 0-100 for generation progress
  isGenerating: boolean;
}

/**
 * Hook for managing episode state and generation lifecycle
 */
export function useEpisode(episodeId?: string) {
  const [state, setState] = useState<UseEpisodeState>({
    episode: null,
    isLoading: false,
    error: null,
    progress: 0,
    isGenerating: false,
  });

  const pollIntervalRef = React.useRef<NodeJS.Timeout | null>(null);

  /**
   * Fetch episode by ID
   */
  const fetchEpisode = useCallback(async (id: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const episode = await apiClient.getEpisode(id);
      setState((prev) => ({
        ...prev,
        episode,
        isLoading: false,
        isGenerating: episode.status === 'generating',
      }));
      return episode;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to fetch episode');
      setState((prev) => ({ ...prev, error: err, isLoading: false }));
      throw error;
    }
  }, []);

  /**
   * Generate new episode
   */
  const generateEpisode = useCallback(async (payload: CreateEpisodeRequest) => {
    setState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
      isGenerating: true,
    }));

    try {
      const episode = await apiClient.generateEpisode(payload);
      setState((prev) => ({
        ...prev,
        episode,
        isLoading: false,
        isGenerating: episode.status === 'generating',
      }));

      // Setup polling for generation progress
      startPolling(episode.id);

      return episode;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to generate episode');
      setState((prev) => ({
        ...prev,
        error: err,
        isLoading: false,
        isGenerating: false,
      }));
      throw error;
    }
  }, []);

  /**
   * Poll for episode status updates (for generation progress)
   */
  const startPolling = useCallback((id: string) => {
    const poll = async () => {
      try {
        const status = await apiClient.getEpisodeStatus(id);

        setState((prev) => {
          const isStillGenerating = status.status === 'generating';

          return {
            ...prev,
            episode: {
              ...prev.episode!,
              status: status.status as EpisodeStatus,
              audioUrl: status.audioUrl,
              transcript: status.transcript,
              error: status.error,
            },
            isGenerating: isStillGenerating,
            progress: isStillGenerating ? prev.progress : 100,
          };
        });

        // Stop polling if generation complete or failed
        if (status.status !== 'generating') {
          stopPolling();
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    };

    // Set initial polling interval: 2 seconds
    pollIntervalRef.current = setInterval(poll, 2000);
  }, []);

  /**
   * Stop polling
   */
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  /**
   * Setup WebSocket listeners for real-time progress
   */
  useEffect(() => {
    if (!episodeId) return;

    // Connect WebSocket if not already
    if (!wsService.isConnectedStatus()) {
      wsService.connect(apiClient.getToken() || undefined).catch((err) => {
        console.error('Failed to connect WebSocket:', err);
      });
    }

    // Listen for episode generation progress
    const unsubGenerating = wsService.onEpisodeGenerating(
      (data: WsEvents.EpisodeGenerating) => {
        if (data.episodeId === episodeId) {
          setState((prev) => ({
            ...prev,
            progress: data.progress,
          }));
        }
      }
    );

    // Listen for episode ready
    const unsubReady = wsService.onEpisodeReady((data: WsEvents.EpisodeReady) => {
      if (data.episodeId === episodeId) {
        setState((prev) => ({
          ...prev,
          episode: {
            ...prev.episode!,
            status: 'ready',
            audioUrl: data.audioUrl,
            duration: data.duration,
          },
          isGenerating: false,
          progress: 100,
        }));
        stopPolling();
      }
    });

    // Listen for episode failed
    const unsubFailed = wsService.onEpisodeFailed((data: WsEvents.EpisodeFailed) => {
      if (data.episodeId === episodeId) {
        setState((prev) => ({
          ...prev,
          episode: {
            ...prev.episode!,
            status: 'failed',
            error: data.error,
          },
          isGenerating: false,
        }));
        stopPolling();
      }
    });

    // Fetch initial episode state
    fetchEpisode(episodeId);

    return () => {
      unsubGenerating();
      unsubReady();
      unsubFailed();
      stopPolling();
    };
  }, [episodeId, fetchEpisode, stopPolling]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    ...state,
    fetchEpisode,
    generateEpisode,
    startPolling,
    stopPolling,
  };
}
