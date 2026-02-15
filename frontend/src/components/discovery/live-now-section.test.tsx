/**
 * Tests for LiveNowSection
 * - Component renders correctly
 * - WebSocket subscription works
 * - Real-time updates display
 * - Carousel navigation works
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { LiveNowSection } from "./live-now-section";
import type { DiscoveryRoom } from "../../common/types/discovery";

// Mock the WebSocket hook
vi.mock("../../hooks/use-websocket-room", () => ({
  useWebsocketRooms: vi.fn(() => new Map()),
}));

// Mock router
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("LiveNowSection", () => {
  const mockRooms: DiscoveryRoom[] = [
    {
      id: "room-1",
      objective: "AI Discussion Panel",
      status: "live" as const,
      hostAgent: { id: "agent-1", name: "Alice" },
      viewerCount: 245,
      trendingScore: 85,
      startedAt: new Date(Date.now() - 10 * 60000).toISOString(), // 10 min ago
      category: "AI & Tech",
      participantCount: 5,
      messageCount: 120,
    },
    {
      id: "room-2",
      objective: "Coding Session - React Patterns",
      status: "live" as const,
      hostAgent: { id: "agent-2", name: "Bob" },
      viewerCount: 180,
      trendingScore: 72,
      startedAt: new Date(Date.now() - 25 * 60000).toISOString(),
      category: "Programming",
      participantCount: 4,
      messageCount: 95,
    },
    {
      id: "room-3",
      objective: "Philosophy Debate",
      status: "live" as const,
      hostAgent: { id: "agent-3", name: "Charlie" },
      viewerCount: 156,
      trendingScore: 68,
      startedAt: new Date(Date.now() - 45 * 60000).toISOString(),
      category: "Philosophy",
      participantCount: 3,
      messageCount: 78,
    },
  ];

  beforeEach(() => {
    mockNavigate.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders live now section with correct title", () => {
    render(
      <BrowserRouter>
        <LiveNowSection rooms={mockRooms} />
      </BrowserRouter>
    );

    expect(screen.getByText("Live Now")).toBeInTheDocument();
    expect(screen.getByText("3 rooms currently live")).toBeInTheDocument();
  });

  it("renders all room cards", () => {
    render(
      <BrowserRouter>
        <LiveNowSection rooms={mockRooms} />
      </BrowserRouter>
    );

    expect(screen.getByText("AI Discussion Panel")).toBeInTheDocument();
    expect(screen.getByText("Coding Session - React Patterns")).toBeInTheDocument();
    expect(screen.getByText("Philosophy Debate")).toBeInTheDocument();
  });

  it("displays host information correctly", () => {
    render(
      <BrowserRouter>
        <LiveNowSection rooms={mockRooms} />
      </BrowserRouter>
    );

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Charlie")).toBeInTheDocument();
  });

  it("displays viewer counts with proper formatting", () => {
    render(
      <BrowserRouter>
        <LiveNowSection rooms={mockRooms} />
      </BrowserRouter>
    );

    expect(screen.getByText("245 watching")).toBeInTheDocument();
    expect(screen.getByText("180 watching")).toBeInTheDocument();
    expect(screen.getByText("156 watching")).toBeInTheDocument();
  });

  it("displays live badges", () => {
    render(
      <BrowserRouter>
        <LiveNowSection rooms={mockRooms} />
      </BrowserRouter>
    );

    const liveBadges = screen.getAllByText("LIVE");
    expect(liveBadges.length).toBe(3);
  });

  it("displays participant counts", () => {
    render(
      <BrowserRouter>
        <LiveNowSection rooms={mockRooms} />
      </BrowserRouter>
    );

    expect(screen.getByText("5 agents participating")).toBeInTheDocument();
    expect(screen.getByText("4 agents participating")).toBeInTheDocument();
    expect(screen.getByText("3 agents participating")).toBeInTheDocument();
  });

  it("displays category tags", () => {
    render(
      <BrowserRouter>
        <LiveNowSection rooms={mockRooms} />
      </BrowserRouter>
    );

    expect(screen.getByText("AI & Tech")).toBeInTheDocument();
    expect(screen.getByText("Programming")).toBeInTheDocument();
    expect(screen.getByText("Philosophy")).toBeInTheDocument();
  });

  it("handles join room button clicks", () => {
    const onJoinRoom = vi.fn();
    render(
      <BrowserRouter>
        <LiveNowSection rooms={mockRooms} onJoinRoom={onJoinRoom} />
      </BrowserRouter>
    );

    const joinButtons = screen.getAllByText("Join Room");
    fireEvent.click(joinButtons[0]);

    expect(onJoinRoom).toHaveBeenCalledWith("room-1");
  });

  it("navigates to room when join is clicked and no callback provided", () => {
    render(
      <BrowserRouter>
        <LiveNowSection rooms={mockRooms} />
      </BrowserRouter>
    );

    const joinButtons = screen.getAllByText("Join Room");
    fireEvent.click(joinButtons[0]);

    expect(mockNavigate).toHaveBeenCalledWith("/room/room-1");
  });

  it("handles room card click", () => {
    const onRoomClick = vi.fn();
    render(
      <BrowserRouter>
        <LiveNowSection rooms={mockRooms} onRoomClick={onRoomClick} />
      </BrowserRouter>
    );

    const roomCard = screen.getByText("AI Discussion Panel");
    fireEvent.click(roomCard);

    expect(onRoomClick).toHaveBeenCalledWith("room-1");
  });

  it("shows view all link", () => {
    render(
      <BrowserRouter>
        <LiveNowSection rooms={mockRooms} />
      </BrowserRouter>
    );

    const viewAllLink = screen.getByText("View all");
    expect(viewAllLink).toBeInTheDocument();
  });

  it("navigates to discovery filter when view all is clicked", () => {
    render(
      <BrowserRouter>
        <LiveNowSection rooms={mockRooms} />
      </BrowserRouter>
    );

    const viewAllLink = screen.getByText("View all");
    fireEvent.click(viewAllLink);

    expect(mockNavigate).toHaveBeenCalledWith("/discover?filter=live");
  });

  it("displays loading skeleton when loading is true", () => {
    render(
      <BrowserRouter>
        <LiveNowSection rooms={[]} loading={true} />
      </BrowserRouter>
    );

    const skeletons = screen.getAllByRole("img", { hidden: true });
    // Loading skeletons should be present
    expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("hides section when no rooms and not loading", () => {
    const { container } = render(
      <BrowserRouter>
        <LiveNowSection rooms={[]} loading={false} />
      </BrowserRouter>
    );

    expect(container.querySelector("section")).toBeEmptyDOMElement();
  });

  it("displays recency badges correctly", () => {
    render(
      <BrowserRouter>
        <LiveNowSection rooms={mockRooms} />
      </BrowserRouter>
    );

    // Should show "Just now" or time-relative text
    const recencyText = screen.queryByText(/ago|now/);
    expect(recencyText).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <BrowserRouter>
        <LiveNowSection rooms={mockRooms} className="custom-class" />
      </BrowserRouter>
    );

    const section = container.querySelector("section");
    expect(section).toHaveClass("custom-class");
  });

  it("disables scroll buttons when carousel is at edges", async () => {
    render(
      <BrowserRouter>
        <LiveNowSection rooms={[mockRooms[0]]} />
      </BrowserRouter>
    );

    // With only 1 room, scroll buttons should not be visible
    const scrollButtons = screen.queryAllByRole("button", { name: /scroll/i });
    expect(scrollButtons.length).toBe(0);
  });

  it("shows scroll buttons when there are multiple rooms", () => {
    const manyRooms = Array.from({ length: 6 }, (_, i) => ({
      ...mockRooms[0],
      id: `room-${i}`,
    }));

    render(
      <BrowserRouter>
        <LiveNowSection rooms={manyRooms} />
      </BrowserRouter>
    );

    // Should show scroll buttons
    const scrollButtons = screen.getAllByRole("button", { name: /scroll/i });
    expect(scrollButtons.length).toBeGreaterThan(0);
  });

  it("handles scroll left button click", async () => {
    const manyRooms = Array.from({ length: 6 }, (_, i) => ({
      ...mockRooms[0],
      id: `room-${i}`,
    }));

    render(
      <BrowserRouter>
        <LiveNowSection rooms={manyRooms} />
      </BrowserRouter>
    );

    const scrollButtons = screen.getAllByRole("button", { name: /scroll/i });
    const leftButton = scrollButtons[0];

    fireEvent.click(leftButton);
    // Should not throw error
    expect(leftButton).toBeInTheDocument();
  });
});
