/**
 * Tests for DiscoveryPage Component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DiscoveryPage } from '../../src/pages/discovery-page';
import { apiClient } from '../../src/services/api';

// Mock API client
vi.mock('../../src/services/api', () => ({
  apiClient: {
    getLiveRooms: vi.fn(),
    search: vi.fn(),
  },
}));

describe('DiscoveryPage Component', () => {
  const mockRooms = [
    {
      id: 'room-1',
      type: 'debate' as const,
      objective: 'AI Ethics Debate',
      hostAgentId: 'agent-1',
      status: 'active' as const,
      participantCount: 5,
      listenerCount: 150,
      duration: 1200,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const mockPodcasts = [
    {
      id: 'pod-1',
      title: 'Tech Talk Daily',
      description: 'Daily tech news',
      category: 'tech' as const,
      hostAgentId: 'agent-2',
      episodeCount: 42,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.getLiveRooms).mockResolvedValue(mockRooms);
  });

  it('should render discovery page header', () => {
    render(<DiscoveryPage />);

    expect(screen.getByText('ClawHouse')).toBeInTheDocument();
    expect(screen.getByText('Discover live collaborative sessions and podcasts')).toBeInTheDocument();
  });

  it('should fetch and display live rooms on mount', async () => {
    render(<DiscoveryPage />);

    await waitFor(() => {
      expect(screen.getByText('Live Now')).toBeInTheDocument();
      expect(apiClient.getLiveRooms).toHaveBeenCalled();
    });
  });

  it('should display room cards', async () => {
    render(<DiscoveryPage />);

    await waitFor(() => {
      expect(screen.getByText('Debate Room')).toBeInTheDocument();
      expect(screen.getByText('AI Ethics Debate')).toBeInTheDocument();
    });
  });

  it('should show loading state when fetching', () => {
    vi.mocked(apiClient.getLiveRooms).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<DiscoveryPage />);

    expect(screen.getByText('Loading live rooms...')).toBeInTheDocument();
  });

  it('should display error when fetch fails', async () => {
    const error = new Error('Failed to fetch rooms');
    vi.mocked(apiClient.getLiveRooms).mockRejectedValue(error);

    render(<DiscoveryPage />);

    await waitFor(() => {
      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText('Failed to fetch rooms')).toBeInTheDocument();
    });
  });

  it('should handle search', async () => {
    vi.mocked(apiClient.search).mockResolvedValue({
      rooms: mockRooms,
      podcasts: mockPodcasts,
    });

    const user = userEvent.setup();
    render(<DiscoveryPage />);

    const searchInput = screen.getByPlaceholderText('Search podcasts and rooms...');
    await user.type(searchInput, 'AI Ethics');

    const searchButton = screen.getByRole('button', { name: /Search/i });
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(apiClient.search).toHaveBeenCalledWith('AI Ethics', {});
      expect(screen.getByText('Search Results')).toBeInTheDocument();
      expect(screen.getByText('Tech Talk Daily')).toBeInTheDocument();
    });
  });

  it('should filter by category', async () => {
    render(<DiscoveryPage />);

    const techButton = screen.getByRole('button', { name: 'tech' });
    fireEvent.click(techButton);

    expect(techButton).toHaveClass('bg-black', 'text-white');
  });

  it('should auto-refresh live rooms', async () => {
    vi.useFakeTimers();
    render(<DiscoveryPage />);

    await waitFor(() => {
      expect(apiClient.getLiveRooms).toHaveBeenCalledTimes(1);
    });

    vi.advanceTimersByTime(5000);

    await waitFor(() => {
      expect(apiClient.getLiveRooms).toHaveBeenCalledTimes(2);
    });

    vi.useRealTimers();
  });

  it('should show empty state when no rooms available', async () => {
    vi.mocked(apiClient.getLiveRooms).mockResolvedValue([]);

    render(<DiscoveryPage />);

    await waitFor(() => {
      expect(screen.getByText('No live rooms at the moment')).toBeInTheDocument();
    });
  });

  it('should handle room click', async () => {
    const mockConsoleLog = vi.spyOn(console, 'log');
    render(<DiscoveryPage />);

    await waitFor(() => {
      const roomCard = screen.getByText('AI Ethics Debate');
      fireEvent.click(roomCard);
      // Navigation would happen in actual implementation
    });
  });
});
