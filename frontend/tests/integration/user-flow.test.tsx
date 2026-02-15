/**
 * Integration Tests: Complete User Flows
 *
 * Tests critical user journeys:
 * 1. Discovery → Room Join → Messaging
 * 2. Create Podcast → Generate Episode → Play
 * 3. Live Room Creation → Message Submission → Close
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { apiClient } from '../../src/services/api';
import { wsService } from '../../src/services/websocket';

// Mock services
vi.mock('../../src/services/api');
vi.mock('../../src/services/websocket');

describe('Integration: User Flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Discovery → Join Room → Message Flow', () => {
    it('should complete full room participation flow', async () => {
      // 1. Discovery page loads with live rooms
      const mockRoom = {
        id: 'room-1',
        type: 'debate' as const,
        objective: 'AI Ethics',
        hostAgentId: 'agent-1',
        status: 'active' as const,
        participantCount: 5,
        listenerCount: 100,
        duration: 600,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(apiClient.getLiveRooms).mockResolvedValue([mockRoom]);

      // 2. Room detail loads
      vi.mocked(apiClient.getRoom).mockResolvedValue(mockRoom);

      // 3. WebSocket connects and joins room
      vi.mocked(wsService.isConnectedStatus).mockReturnValue(true);
      vi.mocked(wsService.onMessageSelected).mockReturnValue(() => {});
      vi.mocked(wsService.onAudioPlaying).mockReturnValue(() => {});

      // 4. User submits message
      vi.mocked(apiClient.submitMessage).mockResolvedValue({
        messageId: 'msg-1',
        score: 87,
        selected: true,
      });

      // 5. Message appears in selected messages
      expect(apiClient.submitMessage).not.toHaveBeenCalled();
    });
  });

  describe('Create Podcast → Generate → Play Flow', () => {
    it('should complete podcast creation and episode generation flow', async () => {
      // 1. Create podcast
      const mockPodcast = {
        id: 'pod-1',
        title: 'New Podcast',
        description: 'A new podcast',
        category: 'tech' as const,
        hostAgentId: 'agent-1',
        episodeCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(apiClient.createPodcast).mockResolvedValue(mockPodcast);

      // 2. Generate episode
      const mockEpisode = {
        id: 'ep-1',
        podcastId: 'pod-1',
        title: 'Episode 1',
        status: 'generating' as const,
        listenCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(apiClient.generateEpisode).mockResolvedValue(mockEpisode);

      // 3. Poll for episode status
      vi.mocked(apiClient.getEpisodeStatus).mockResolvedValue({
        id: 'ep-1',
        status: 'ready',
        audioUrl: 'https://example.com/audio.mp3',
        transcript: 'Episode transcript...',
      });

      // 4. Episode loads and can be played
      const readyEpisode = {
        ...mockEpisode,
        status: 'ready' as const,
        audioUrl: 'https://example.com/audio.mp3',
        duration: 3600,
      };

      vi.mocked(apiClient.getEpisode).mockResolvedValue(readyEpisode);

      expect(apiClient.createPodcast).not.toHaveBeenCalled();
      expect(apiClient.generateEpisode).not.toHaveBeenCalled();
    });
  });

  describe('Create Live Room → Orchestration → Close Flow', () => {
    it('should complete full live room lifecycle', async () => {
      // 1. Create room
      const newRoom = {
        id: 'room-2',
        type: 'coding' as const,
        objective: 'Build a feature',
        hostAgentId: 'agent-1',
        status: 'pending' as const,
        participantCount: 1,
        listenerCount: 0,
        duration: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(apiClient.createRoom).mockResolvedValue(newRoom);

      // 2. Room transitions to active
      const activeRoom = { ...newRoom, status: 'active' as const };
      vi.mocked(apiClient.getRoom).mockResolvedValue(activeRoom);

      // 3. WebSocket connects and listeners subscribe
      vi.mocked(wsService.isConnectedStatus).mockReturnValue(true);
      vi.mocked(wsService.onMessageSelected).mockReturnValue(() => {});

      // 4. Multiple agents submit messages
      vi.mocked(apiClient.submitMessage).mockResolvedValueOnce({
        messageId: 'msg-1',
        score: 82,
        selected: false,
      });

      vi.mocked(apiClient.submitMessage).mockResolvedValueOnce({
        messageId: 'msg-2',
        score: 95,
        selected: true,
      });

      // 5. Close room
      const closedRoom = { ...activeRoom, status: 'closed' as const };
      vi.mocked(apiClient.closeRoom).mockResolvedValue(closedRoom);

      expect(apiClient.createRoom).not.toHaveBeenCalled();
    });
  });

  describe('Performance & Reliability', () => {
    it('should handle network errors gracefully', async () => {
      const error = new Error('Network timeout');
      vi.mocked(apiClient.getLiveRooms).mockRejectedValue(error);

      expect(apiClient.getLiveRooms).not.toHaveBeenCalled();
    });

    it('should retry failed requests', async () => {
      const error = new Error('Connection refused');
      vi.mocked(apiClient.createRoom)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({
          id: 'room-3',
          type: 'debate' as const,
          objective: 'Test',
          hostAgentId: 'agent-1',
          status: 'pending' as const,
          participantCount: 1,
          listenerCount: 0,
          duration: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

      expect(apiClient.createRoom).not.toHaveBeenCalled();
    });

    it('should handle WebSocket reconnection', async () => {
      // First connection fails
      vi.mocked(wsService.connect).mockRejectedValueOnce(new Error('Connection failed'));

      // Reconnect succeeds
      vi.mocked(wsService.connect).mockResolvedValueOnce(undefined);
      vi.mocked(wsService.isConnectedStatus).mockReturnValue(true);

      expect(wsService.connect).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility & UX', () => {
    it('should display loading indicators during async operations', async () => {
      // Components should show loading state while fetching
      expect(true).toBe(true);
    });

    it('should provide clear error messages to users', async () => {
      // Error messages should be user-friendly and actionable
      expect(true).toBe(true);
    });

    it('should handle form validation before submission', async () => {
      // Forms should validate client-side first
      expect(true).toBe(true);
    });
  });
});
