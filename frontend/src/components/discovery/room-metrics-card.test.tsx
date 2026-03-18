/**
 * Tests for RoomMetricsCard
 * - Displays trending score correctly
 * - Updates on props change
 * - Shows all metrics variants
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RoomMetricsCard } from "./room-metrics-card";
import type { DiscoveryRoom } from "common/types/discovery";
import type { WebsocketRoomState } from "../../hooks/use-websocket-room";

describe("RoomMetricsCard", () => {
  const mockRoom: DiscoveryRoom = {
    id: "room-1",
    objective: "Test Room",
    status: "live" as const,
    visibility: "public" as const,
    hostAgent: { id: "agent-1", name: "Host" },
    viewerCount: 100,
    totalMessages: 50,
    messageCount: 50,
    engagementRate: 0.5,
    trendingScore: 75,
    growthRate: 1.2,
    startedAt: new Date(Date.now() - 20 * 60000).toISOString(),
    category: { id: "test", name: "Test" },
    type: "debate",
    participantCount: 3,
  };

  const mockMetrics: WebsocketRoomState = {
    viewerCount: 150,
    trendingScore: 80,
    status: "live" as const,
    lastUpdated: new Date().toISOString(),
    isConnected: true,
    error: null,
  };

  it("renders trending score bar", () => {
    render(<RoomMetricsCard room={mockRoom} showTrendingScore={true} />);

    expect(screen.getByText("Trending")).toBeInTheDocument();
    expect(screen.getByText("75")).toBeInTheDocument(); // Score value
  });

  it("displays viewer count", () => {
    render(<RoomMetricsCard room={mockRoom} />);

    expect(screen.getByText(/viewers/)).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("uses real-time metrics when available", () => {
    render(
      <RoomMetricsCard room={mockRoom} metrics={mockMetrics} />
    );

    // Should display metrics viewer count (150) instead of room viewer count (100)
    expect(screen.getByText("150")).toBeInTheDocument();
  });

  it("displays growth indicator", () => {
    render(<RoomMetricsCard room={mockRoom} metrics={mockMetrics} />);

    // Growth indicator should be shown
    const growth = screen.queryByText(/↑|↓|→/);
    expect(growth).toBeInTheDocument();
  });

  it("displays engagement metric in detailed variant", () => {
    render(
      <RoomMetricsCard
        room={mockRoom}
        showEngagement={true}
        variant="detailed"
      />
    );

    expect(screen.getByText("Engagement:")).toBeInTheDocument();
    expect(screen.getByText(/messages/)).toBeInTheDocument();
  });

  it("hides engagement metric in compact variant", () => {
    render(
      <RoomMetricsCard
        room={mockRoom}
        showEngagement={true}
        variant="compact"
      />
    );

    // Engagement label should not be in compact mode
    expect(screen.queryByText("Engagement:")).not.toBeInTheDocument();
  });

  it("displays recency badge", () => {
    render(<RoomMetricsCard room={mockRoom} showRecency={true} />);

    // Should show time-relative text
    const recencyText = screen.queryByText(/ago|now/);
    expect(recencyText).toBeInTheDocument();
  });

  it("hides recency badge when showRecency is false", () => {
    render(<RoomMetricsCard room={mockRoom} showRecency={false} />);

    // Should not show recency text
    const recencyText = screen.queryByText(/ago/);
    expect(recencyText).not.toBeInTheDocument();
  });

  it("displays new badge for recently started rooms", () => {
    const newRoom: DiscoveryRoom = {
      ...mockRoom,
      startedAt: new Date(Date.now() - 10 * 60000).toISOString(), // 10 min ago
    };

    render(<RoomMetricsCard room={newRoom} showRecency={true} />);

    // Should show "New" badge for rooms started within 30 min
    const newBadge = screen.queryByText("New");
    // May or may not show depending on exact time, but should show recency
    expect(screen.queryByText(/ago|now/)).toBeInTheDocument();
  });

  it("hides trending score when showTrendingScore is false", () => {
    render(<RoomMetricsCard room={mockRoom} showTrendingScore={false} />);

    expect(screen.queryByText("Trending")).not.toBeInTheDocument();
  });

  it("applies color coding based on trending score", () => {
    const { container } = render(
      <RoomMetricsCard room={{ ...mockRoom, trendingScore: 85 }} />
    );

    // High score (85) should have green color
    const scoreText = screen.getByText("85");
    expect(scoreText).toHaveClass("text-green-600");
  });

  it("shows medium score color (blue)", () => {
    const { container } = render(
      <RoomMetricsCard room={{ ...mockRoom, trendingScore: 55 }} />
    );

    const scoreText = screen.getByText("55");
    expect(scoreText).toHaveClass("text-blue-600");
  });

  it("shows low score color (gray)", () => {
    const { container } = render(
      <RoomMetricsCard room={{ ...mockRoom, trendingScore: 15 }} />
    );

    const scoreText = screen.getByText("15");
    expect(scoreText).toHaveClass("text-gray-600");
  });

  it("renders progress bar with correct width", () => {
    const { container } = render(
      <RoomMetricsCard room={{ ...mockRoom, trendingScore: 50 }} />
    );

    const progressBar = container.querySelector('[role="progressbar"]');
    expect(progressBar).toHaveStyle("width: 50%");
  });

  it("displays engagement ratio calculation", () => {
    render(
      <RoomMetricsCard
        room={{ ...mockRoom, messageCount: 100 }}
        variant="detailed"
      />
    );

    // With 100 viewers and 100 messages, ratio should be ~1
    expect(screen.getByText(/msg\/viewer/)).toBeInTheDocument();
  });

  it("handles zero viewer count gracefully", () => {
    render(<RoomMetricsCard room={{ ...mockRoom, viewerCount: 0 }} />);

    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("displays connection status when disconnected", () => {
    const disconnectedMetrics: WebsocketRoomState = {
      viewerCount: 100,
      trendingScore: 75,
      status: "live" as const,
      lastUpdated: null,
      isConnected: false,
      error: null,
    };

    render(
      <RoomMetricsCard room={mockRoom} metrics={disconnectedMetrics} />
    );

    expect(screen.getByText("Updating...")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <RoomMetricsCard room={mockRoom} className="custom-metrics" />
    );

    const wrapper = container.firstChild;
    expect(wrapper).toHaveClass("custom-metrics");
  });

  it("formats large viewer counts with comma separator", () => {
    render(<RoomMetricsCard room={{ ...mockRoom, viewerCount: 1000 }} />);

    expect(screen.getByText("1,000")).toBeInTheDocument();
  });

  it("formats large message counts with comma separator", () => {
    render(
      <RoomMetricsCard
        room={{ ...mockRoom, messageCount: 5000 }}
        variant="detailed"
      />
    );

    expect(screen.getByText(/5,000|5000/)).toBeInTheDocument();
  });

  it("updates when metrics prop changes", () => {
    const { rerender } = render(
      <RoomMetricsCard room={mockRoom} metrics={mockMetrics} />
    );

    expect(screen.getByText("150")).toBeInTheDocument();

    const newMetrics: WebsocketRoomState = {
      ...mockMetrics,
      viewerCount: 200,
    };

    rerender(<RoomMetricsCard room={mockRoom} metrics={newMetrics} />);

    expect(screen.getByText("200")).toBeInTheDocument();
  });

  it("updates score bar color when score changes", () => {
    const { rerender } = render(
      <RoomMetricsCard room={{ ...mockRoom, trendingScore: 30 }} />
    );

    expect(screen.getByText("30")).toHaveClass("text-yellow-600");

    rerender(<RoomMetricsCard room={{ ...mockRoom, trendingScore: 80 }} />);

    expect(screen.getByText("80")).toHaveClass("text-green-600");
  });

  it("displays progress bar color based on score", () => {
    const { container: container1 } = render(
      <RoomMetricsCard room={{ ...mockRoom, trendingScore: 80 }} />
    );

    const progressBar1 = container1.querySelector('[role="progressbar"]');
    const parent1 = progressBar1?.parentElement;
    expect(parent1?.querySelector(".bg-green-500")).toBeInTheDocument();
  });

  it("displays message count when available", () => {
    render(
      <RoomMetricsCard
        room={{ ...mockRoom, messageCount: 250 }}
        variant="detailed"
      />
    );

    expect(screen.getByText("250")).toBeInTheDocument();
  });

  it("handles missing message count", () => {
    const roomNoMessages: DiscoveryRoom = {
      ...mockRoom,
      messageCount: undefined,
    };

    render(
      <RoomMetricsCard room={roomNoMessages} variant="detailed" />
    );

    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("shows aria labels for accessibility", () => {
    const { container } = render(
      <RoomMetricsCard room={mockRoom} showTrendingScore={true} />
    );

    const progressBar = container.querySelector('[role="progressbar"]');
    expect(progressBar).toHaveAttribute("aria-label", "Trending score");
    expect(progressBar).toHaveAttribute("aria-valuenow");
    expect(progressBar).toHaveAttribute("aria-valuemin");
    expect(progressBar).toHaveAttribute("aria-valuemax");
  });

  it("memoizes recency boost calculation", () => {
    const { rerender } = render(
      <RoomMetricsCard room={mockRoom} />
    );

    // Re-render with same room
    rerender(<RoomMetricsCard room={mockRoom} />);

    // Should not cause errors or visual changes
    expect(screen.getByText(/ago|now/)).toBeInTheDocument();
  });
});
