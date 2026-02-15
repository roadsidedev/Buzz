/**
 * Storybook Stories for Discovery Components
 * Component documentation and visual testing
 * ~150 lines
 */

import type { Meta, StoryObj } from "@storybook/react";
import { RoomCardGrid } from "./room-card";
import { RoomMetricsCard } from "./room-metrics-card";
import type { DiscoveryRoom } from "../../common/types/discovery";

// Mock room data
const mockRoom: DiscoveryRoom = {
  id: "room-1",
  objective: "AI Discussion Panel",
  status: "live",
  hostAgent: { id: "agent-1", name: "Alice" },
  viewerCount: 245,
  trendingScore: 85,
  startedAt: new Date(Date.now() - 10 * 60000).toISOString(),
  category: "AI & Tech",
  participantCount: 5,
  messageCount: 120,
};

const mockRooms: DiscoveryRoom[] = [mockRoom];

/**
 * RoomMetricsCard Stories
 */
export default {
  title: "Discovery/RoomMetricsCard",
  component: RoomMetricsCard,
  parameters: {
    layout: "centered",
  },
} as Meta<typeof RoomMetricsCard>;

type RoomMetricsStory = StoryObj<typeof RoomMetricsCard>;

export const Compact: RoomMetricsStory = {
  args: {
    room: mockRoom,
    variant: "compact",
    showTrendingScore: true,
    showRecency: true,
  },
};

export const Detailed: RoomMetricsStory = {
  args: {
    room: mockRoom,
    variant: "detailed",
    showTrendingScore: true,
    showEngagement: true,
    showRecency: true,
  },
};

export const HighScore: RoomMetricsStory = {
  args: {
    room: { ...mockRoom, trendingScore: 95 },
    variant: "compact",
  },
};

export const LowScore: RoomMetricsStory = {
  args: {
    room: { ...mockRoom, trendingScore: 20 },
    variant: "compact",
  },
};

export const NewRoom: RoomMetricsStory = {
  args: {
    room: {
      ...mockRoom,
      startedAt: new Date(Date.now() - 5 * 60000).toISOString(), // 5 min ago
    },
    variant: "compact",
  },
};

export const HighEngagement: RoomMetricsStory = {
  args: {
    room: { ...mockRoom, messageCount: 500, viewerCount: 1000 },
    variant: "detailed",
  },
};

export const RealTimeUpdate: RoomMetricsStory = {
  args: {
    room: mockRoom,
    metrics: {
      viewerCount: 350,
      trendingScore: 88,
      status: "live",
      lastUpdated: new Date().toISOString(),
      isConnected: true,
      error: null,
    },
    variant: "detailed",
  },
};

export const Disconnected: RoomMetricsStory = {
  args: {
    room: mockRoom,
    metrics: {
      viewerCount: 245,
      trendingScore: 85,
      status: "live",
      lastUpdated: null,
      isConnected: false,
      error: null,
    },
  },
};

/**
 * RoomCardGrid Stories
 */
const RoomCardGridMeta: Meta<typeof RoomCardGrid> = {
  title: "Discovery/RoomCardGrid",
  component: RoomCardGrid,
  parameters: {
    layout: "padded",
  },
};

export default RoomCardGridMeta;

type RoomCardGridStory = StoryObj<typeof RoomCardGrid>;

export const SingleRoom: RoomCardGridStory = {
  args: {
    rooms: [mockRoom],
    onJoinRoom: (roomId) => alert(`Joined room: ${roomId}`),
  },
};

export const MultipleRooms: RoomCardGridStory = {
  args: {
    rooms: [
      mockRoom,
      { ...mockRoom, id: "room-2", objective: "Coding Session", viewerCount: 180 },
      { ...mockRoom, id: "room-3", objective: "Philosophy Debate", viewerCount: 156 },
      { ...mockRoom, id: "room-4", objective: "Trading Discussion", viewerCount: 220 },
    ],
    onJoinRoom: (roomId) => alert(`Joined room: ${roomId}`),
  },
};

export const Loading: RoomCardGridStory = {
  args: {
    rooms: [],
    isLoading: true,
    emptyMessage: "Loading rooms...",
  },
};

export const Empty: RoomCardGridStory = {
  args: {
    rooms: [],
    emptyMessage: "No rooms found",
  },
};

export const MixedStates: RoomCardGridStory = {
  args: {
    rooms: [
      mockRoom,
      { ...mockRoom, id: "room-2", status: "pending" as const },
      { ...mockRoom, id: "room-3", status: "completed" as const },
    ],
  },
};

export const DifferentScores: RoomCardGridStory = {
  args: {
    rooms: [
      mockRoom,
      { ...mockRoom, id: "room-2", trendingScore: 50 },
      { ...mockRoom, id: "room-3", trendingScore: 25 },
      { ...mockRoom, id: "room-4", trendingScore: 5 },
    ],
  },
};
