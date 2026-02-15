/**
 * Custom Hook: usePodcast
 *
 * Manages podcast data fetching, state, and mutations.
 * Handles loading, error states, and caching.
 */

import { useState, useCallback, useEffect } from 'react';
import { apiClient } from '../services/api';
import { Podcast, CreatePodcastRequest, Episode, PaginatedResponse } from '../types';

interface UsePodcastOptions {
  podcastId?: string;
  autoFetch?: boolean;
}

interface UsePodcastState {
  podcast: Podcast | null;
  episodes: Episode[];
  isLoading: boolean;
  error: Error | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

/**
 * Hook for managing single podcast state and operations
 */
export function usePodcast(options?: UsePodcastOptions) {
  const [state, setState] = useState<UsePodcastState>({
    podcast: null,
    episodes: [],
    isLoading: false,
    error: null,
    pagination: {
      page: 1,
      limit: 20,
      total: 0,
      hasMore: false,
    },
  });

  /**
   * Fetch podcast by ID
   */
  const fetchPodcast = useCallback(async (id: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const podcast = await apiClient.getPodcast(id);
      setState((prev) => ({ ...prev, podcast, isLoading: false }));
      return podcast;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to fetch podcast');
      setState((prev) => ({ ...prev, error: err, isLoading: false }));
      throw error;
    }
  }, []);

  /**
   * Fetch episodes for podcast
   */
  const fetchEpisodes = useCallback(
    async (podcastId: string, page: number = 1, limit: number = 20) => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      try {
        const response = await apiClient.getEpisodes(podcastId, { page, limit });
        setState((prev) => ({
          ...prev,
          episodes: page === 1 ? response.items : [...prev.episodes, ...response.items],
          pagination: {
            page,
            limit,
            total: response.total,
            hasMore: response.hasMore,
          },
          isLoading: false,
        }));
        return response;
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Failed to fetch episodes');
        setState((prev) => ({ ...prev, error: err, isLoading: false }));
        throw error;
      }
    },
    []
  );

  /**
   * Create new podcast
   */
  const createPodcast = useCallback(async (payload: CreatePodcastRequest) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const podcast = await apiClient.createPodcast(payload);
      setState((prev) => ({ ...prev, podcast, isLoading: false }));
      return podcast;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to create podcast');
      setState((prev) => ({ ...prev, error: err, isLoading: false }));
      throw error;
    }
  }, []);

  /**
   * Update podcast
   */
  const updatePodcast = useCallback(async (podcastId: string, updates: Partial<Podcast>) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const updated = await apiClient.updatePodcast(podcastId, updates);
      setState((prev) => ({ ...prev, podcast: updated, isLoading: false }));
      return updated;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to update podcast');
      setState((prev) => ({ ...prev, error: err, isLoading: false }));
      throw error;
    }
  }, []);

  /**
   * Auto-fetch podcast on mount if ID provided
   */
  useEffect(() => {
    if (options?.autoFetch && options.podcastId) {
      fetchPodcast(options.podcastId);
    }
  }, [options?.autoFetch, options?.podcastId, fetchPodcast]);

  return {
    ...state,
    fetchPodcast,
    fetchEpisodes,
    createPodcast,
    updatePodcast,
  };
}
