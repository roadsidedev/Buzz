/**
 * Tests for usePodcast Hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePodcast } from '../../src/hooks/use-podcast';
import { apiClient } from '../../src/services/api';

// Mock API client
vi.mock('../../src/services/api', () => ({
  apiClient: {
    getPodcast: vi.fn(),
    getEpisodes: vi.fn(),
    createPodcast: vi.fn(),
    updatePodcast: vi.fn(),
  },
}));

describe('usePodcast Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchPodcast', () => {
    it('should fetch podcast by ID and update state', async () => {
      const mockPodcast = {
        id: 'pod-1',
        title: 'Test Podcast',
        description: 'Test Description',
        category: 'tech' as const,
        hostAgentId: 'agent-1',
        episodeCount: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(apiClient.getPodcast).mockResolvedValue(mockPodcast);

      const { result } = renderHook(() => usePodcast());

      expect(result.current.podcast).toBeNull();

      await act(async () => {
        await result.current.fetchPodcast('pod-1');
      });

      expect(result.current.podcast).toEqual(mockPodcast);
      expect(apiClient.getPodcast).toHaveBeenCalledWith('pod-1');
    });

    it('should handle fetch error gracefully', async () => {
      const error = new Error('Network error');
      vi.mocked(apiClient.getPodcast).mockRejectedValue(error);

      const { result } = renderHook(() => usePodcast());

      await expect(
        act(async () => {
          await result.current.fetchPodcast('pod-1');
        })
      ).rejects.toThrow('Network error');

      expect(result.current.error).toBeDefined();
    });
  });

  describe('fetchEpisodes', () => {
    it('should fetch episodes for podcast', async () => {
      const mockEpisodes = [
        {
          id: 'ep-1',
          podcastId: 'pod-1',
          title: 'Episode 1',
          status: 'ready' as const,
          audioUrl: 'https://example.com/audio.mp3',
          transcript: 'Transcript content',
          duration: 3600,
          listenCount: 100,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(apiClient.getEpisodes).mockResolvedValue({
        items: mockEpisodes,
        total: 1,
        page: 1,
        limit: 20,
        hasMore: false,
      });

      const { result } = renderHook(() => usePodcast());

      await act(async () => {
        await result.current.fetchEpisodes('pod-1', 1, 20);
      });

      expect(result.current.episodes).toEqual(mockEpisodes);
      expect(result.current.pagination.hasMore).toBe(false);
    });

    it('should handle pagination correctly', async () => {
      const mockEpisodes = Array.from({ length: 20 }, (_, i) => ({
        id: `ep-${i}`,
        podcastId: 'pod-1',
        title: `Episode ${i}`,
        status: 'ready' as const,
        listenCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      vi.mocked(apiClient.getEpisodes).mockResolvedValue({
        items: mockEpisodes,
        total: 50,
        page: 1,
        limit: 20,
        hasMore: true,
      });

      const { result } = renderHook(() => usePodcast());

      await act(async () => {
        await result.current.fetchEpisodes('pod-1', 1, 20);
      });

      expect(result.current.pagination.total).toBe(50);
      expect(result.current.pagination.hasMore).toBe(true);
    });
  });

  describe('createPodcast', () => {
    it('should create new podcast', async () => {
      const mockPodcast = {
        id: 'pod-2',
        title: 'New Podcast',
        description: 'New Description',
        category: 'finance' as const,
        hostAgentId: 'agent-1',
        episodeCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(apiClient.createPodcast).mockResolvedValue(mockPodcast);

      const { result } = renderHook(() => usePodcast());

      await act(async () => {
        await result.current.createPodcast({
          title: 'New Podcast',
          description: 'New Description',
          category: 'finance',
        });
      });

      expect(result.current.podcast).toEqual(mockPodcast);
      expect(apiClient.createPodcast).toHaveBeenCalled();
    });
  });

  describe('updatePodcast', () => {
    it('should update podcast', async () => {
      const updatedPodcast = {
        id: 'pod-1',
        title: 'Updated Podcast',
        description: 'Updated Description',
        category: 'tech' as const,
        hostAgentId: 'agent-1',
        episodeCount: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(apiClient.updatePodcast).mockResolvedValue(updatedPodcast);

      const { result } = renderHook(() => usePodcast());

      await act(async () => {
        await result.current.updatePodcast('pod-1', { title: 'Updated Podcast' });
      });

      expect(result.current.podcast?.title).toBe('Updated Podcast');
    });
  });

  describe('autoFetch', () => {
    it('should auto-fetch podcast on mount when options provided', async () => {
      const mockPodcast = {
        id: 'pod-1',
        title: 'Test Podcast',
        description: 'Test',
        category: 'tech' as const,
        hostAgentId: 'agent-1',
        episodeCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(apiClient.getPodcast).mockResolvedValue(mockPodcast);

      const { result } = renderHook(() =>
        usePodcast({ podcastId: 'pod-1', autoFetch: true })
      );

      // Wait for effect to run
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(apiClient.getPodcast).toHaveBeenCalledWith('pod-1');
    });
  });
});
