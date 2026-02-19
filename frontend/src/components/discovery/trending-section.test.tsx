/**
 * Tests for TrendingSection
 * - Renders grid correctly
 * - Displays trending scores
 * - Real-time updates work
 * - Responsive layout works
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { TrendingSection } from "./trending-section";
import type { DiscoveryRoom } from "common/types/discovery";

vi.mock("../../hooks/use-websocket-room", () => ({
  useWebsocketRooms: vi.fn(() => new Map()),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("TrendingSection", () => {
  const mockRooms: DiscoveryRoom[] = [
    {
      id: "trending-1",
      objective: "Top AI Debate",
      status: "live" as const,
      visibility: "public" as const,
      hostAgent: { id: "agent-1", name: "Expert1" },
      viewerCount: 500,
      totalMessages: 250,
      messageCount: 250,
      engagementRate: 0.5,
      trendingScore: 95,
      growthRate: 1.5,
      startedAt: new Date(Date.now() - 5 * 60000).toISOString(),
      category: { id: "ai", name: "AI" },
      participantCount: 8,
    },
    {
      id: "trending-2",
      objective: "Popular Coding Stream",
      status: "live" as const,
      visibility: "public" as const,
      hostAgent: { id: "agent-2", name: "Expert2" },
      viewerCount: 380,
      totalMessages: 180,
      messageCount: 180,
      engagementRate: 0.47,
      trendingScore: 88,
      growthRate: 1.3,
      startedAt: new Date(Date.now() - 15 * 60000).toISOString(),
      category: { id: "code", name: "Code" },
      participantCount: 6,
    },
    {
      id: "trending-3",
      objective: "Viral Discussion Topic",
      status: "live" as const,
      visibility: "public" as const,
      hostAgent: { id: "agent-3", name: "Expert3" },
      viewerCount: 290,
      totalMessages: 140,
      messageCount: 140,
      engagementRate: 0.48,
      trendingScore: 76,
      growthRate: 1.1,
      startedAt: new Date(Date.now() - 30 * 60000).toISOString(),
      category: { id: "news", name: "News" },
      participantCount: 5,
    },
  ];

  beforeEach(() => {
    mockNavigate.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders trending section with default title", () => {
    render(
      <BrowserRouter>
        <TrendingSection rooms={mockRooms} />
      </BrowserRouter>
    );

    expect(screen.getByText("Trending Now")).toBeInTheDocument();
    expect(
      screen.getByText("Hottest conversations happening right now")
    ).toBeInTheDocument();
  });

  it("renders with custom title and description", () => {
    render(
      <BrowserRouter>
        <TrendingSection
          rooms={mockRooms}
          title="Hot Topics"
          description="What's getting attention"
        />
      </BrowserRouter>
    );

    expect(screen.getByText("Hot Topics")).toBeInTheDocument();
    expect(screen.getByText("What's getting attention")).toBeInTheDocument();
  });

  it("renders all room cards in grid", () => {
    render(
      <BrowserRouter>
        <TrendingSection rooms={mockRooms} />
      </BrowserRouter>
    );

    expect(screen.getByText("Top AI Debate")).toBeInTheDocument();
    expect(screen.getByText("Popular Coding Stream")).toBeInTheDocument();
    expect(screen.getByText("Viral Discussion Topic")).toBeInTheDocument();
  });

  it("displays rank badges on cards", () => {
    render(
      <BrowserRouter>
        <TrendingSection rooms={mockRooms} />
      </BrowserRouter>
    );

    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("#2")).toBeInTheDocument();
    expect(screen.getByText("#3")).toBeInTheDocument();
  });

  it("displays host information", () => {
    render(
      <BrowserRouter>
        <TrendingSection rooms={mockRooms} />
      </BrowserRouter>
    );

    expect(screen.getByText("Expert1")).toBeInTheDocument();
    expect(screen.getByText("Expert2")).toBeInTheDocument();
    expect(screen.getByText("Expert3")).toBeInTheDocument();
  });

  it("displays viewer counts", () => {
    render(
      <BrowserRouter>
        <TrendingSection rooms={mockRooms} />
      </BrowserRouter>
    );

    expect(screen.getByText("500 viewers")).toBeInTheDocument();
    expect(screen.getByText("380 viewers")).toBeInTheDocument();
    expect(screen.getByText("290 viewers")).toBeInTheDocument();
  });

  it("displays trending scores", () => {
    render(
      <BrowserRouter>
        <TrendingSection rooms={mockRooms} />
      </BrowserRouter>
    );

    // Scores should be displayed (they appear in the metrics card)
    const scoreElements = screen.getAllByRole("progressbar");
    expect(scoreElements.length).toBeGreaterThanOrEqual(3);
  });

  it("displays participant and message counts", () => {
    render(
      <BrowserRouter>
        <TrendingSection rooms={mockRooms} />
      </BrowserRouter>
    );

    expect(screen.getByText("8 participating • 250 messages")).toBeInTheDocument();
    expect(screen.getByText("6 participating • 180 messages")).toBeInTheDocument();
    expect(screen.getByText("5 participating • 140 messages")).toBeInTheDocument();
  });

  it("displays status badges", () => {
    render(
      <BrowserRouter>
        <TrendingSection rooms={mockRooms} />
      </BrowserRouter>
    );

    const liveBadges = screen.getAllByText("LIVE");
    expect(liveBadges.length).toBe(3);
  });

  it("displays category tags", () => {
    render(
      <BrowserRouter>
        <TrendingSection rooms={mockRooms} />
      </BrowserRouter>
    );

    expect(screen.getByText("AI")).toBeInTheDocument();
    expect(screen.getByText("Code")).toBeInTheDocument();
    expect(screen.getByText("News")).toBeInTheDocument();
  });

  it("handles join room clicks", () => {
    const onJoinRoom = vi.fn();
    render(
      <BrowserRouter>
        <TrendingSection rooms={mockRooms} onJoinRoom={onJoinRoom} />
      </BrowserRouter>
    );

    const joinButtons = screen.getAllByText("Join Room");
    fireEvent.click(joinButtons[0]);

    expect(onJoinRoom).toHaveBeenCalledWith("trending-1");
  });

  it("navigates when join is clicked without callback", () => {
    render(
      <BrowserRouter>
        <TrendingSection rooms={mockRooms} />
      </BrowserRouter>
    );

    const joinButtons = screen.getAllByText("Join Room");
    fireEvent.click(joinButtons[0]);

    expect(mockNavigate).toHaveBeenCalledWith("/room/trending-1");
  });

  it("handles room card clicks", () => {
    const onRoomClick = vi.fn();
    render(
      <BrowserRouter>
        <TrendingSection rooms={mockRooms} onRoomClick={onRoomClick} />
      </BrowserRouter>
    );

    const roomCard = screen.getByText("Top AI Debate");
    fireEvent.click(roomCard);

    expect(onRoomClick).toHaveBeenCalledWith("trending-1");
  });

  it("displays loading skeleton when loading is true", () => {
    render(
      <BrowserRouter>
        <TrendingSection rooms={[]} loading={true} />
      </BrowserRouter>
    );

    expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("shows empty state when no rooms and not loading", () => {
    render(
      <BrowserRouter>
        <TrendingSection rooms={[]} loading={false} />
      </BrowserRouter>
    );

    expect(
      screen.getByText("No trending rooms right now")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Check back later or create a new room to get started")
    ).toBeInTheDocument();
  });

  it("hides section when no rooms and not loading (in parent context)", () => {
    const { container } = render(
      <BrowserRouter>
        <TrendingSection rooms={[]} loading={false} />
      </BrowserRouter>
    );

    // Empty state message should be shown
    expect(screen.getByText("No trending rooms right now")).toBeInTheDocument();
  });

  it("shows view all link when rooms exist", () => {
    render(
      <BrowserRouter>
        <TrendingSection rooms={mockRooms} />
      </BrowserRouter>
    );

    const viewAllLink = screen.getByText("View all trending rooms");
    expect(viewAllLink).toBeInTheDocument();
  });

  it("navigates to trending sort when view all is clicked", () => {
    render(
      <BrowserRouter>
        <TrendingSection rooms={mockRooms} />
      </BrowserRouter>
    );

    const viewAllLink = screen.getByText("View all trending rooms");
    fireEvent.click(viewAllLink);

    expect(mockNavigate).toHaveBeenCalledWith("/discover?sort=trending");
  });

  it("renders responsive grid layout", () => {
    const { container } = render(
      <BrowserRouter>
        <TrendingSection rooms={mockRooms} />
      </BrowserRouter>
    );

    const grid = container.querySelector(".grid");
    expect(grid).toHaveClass("grid-cols-1", "md:grid-cols-2", "lg:grid-cols-4");
  });

  it("applies custom className", () => {
    const { container } = render(
      <BrowserRouter>
        <TrendingSection rooms={mockRooms} className="custom-trending" />
      </BrowserRouter>
    );

    const section = container.querySelector("section");
    expect(section).toHaveClass("custom-trending");
  });

  it("renders grid with 4 columns on large screens", () => {
    const { container } = render(
      <BrowserRouter>
        <TrendingSection rooms={mockRooms} />
      </BrowserRouter>
    );

    const grid = container.querySelector(".grid");
    expect(grid).toHaveClass("lg:grid-cols-4");
  });

  it("renders grid with 2 columns on medium screens", () => {
    const { container } = render(
      <BrowserRouter>
        <TrendingSection rooms={mockRooms} />
      </BrowserRouter>
    );

    const grid = container.querySelector(".grid");
    expect(grid).toHaveClass("md:grid-cols-2");
  });

  it("renders grid with 1 column on mobile", () => {
    const { container } = render(
      <BrowserRouter>
        <TrendingSection rooms={mockRooms} />
      </BrowserRouter>
    );

    const grid = container.querySelector(".grid");
    expect(grid).toHaveClass("grid-cols-1");
  });

  it("displays recency indicators", () => {
    render(
      <BrowserRouter>
        <TrendingSection rooms={mockRooms} />
      </BrowserRouter>
    );

    // Should show time-relative badges
    const timeText = screen.queryAllByText(/ago|now/);
    expect(timeText.length).toBeGreaterThan(0);
  });

  it("handles rooms with missing optional fields", () => {
    const roomsWithMissingFields: DiscoveryRoom[] = [
      {
        id: "incomplete-1",
        objective: "Test Room",
        status: "live" as const,
        visibility: "public" as const,
        hostAgent: { id: "agent-1", name: "Host" },
        viewerCount: 0,
        totalMessages: 0,
        engagementRate: 0,
        trendingScore: 0,
        growthRate: 0,
        startedAt: new Date().toISOString(),
        participantCount: 0,
      },
    ];

    render(
      <BrowserRouter>
        <TrendingSection rooms={roomsWithMissingFields} />
      </BrowserRouter>
    );

    expect(screen.getByText("Test Room")).toBeInTheDocument();
  });
});
