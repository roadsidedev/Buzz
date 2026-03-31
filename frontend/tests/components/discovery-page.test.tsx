/**
 * Tests for FeedPage Component - TikTok Style
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { FeedPage } from "../../src/pages/discovery-page";

// Mock the useDiscovery hook
vi.mock("../../src/hooks/use-discovery", () => ({
  useDiscovery: () => ({
    trending: [],
    liveNow: [],
    categories: [],
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
  useSearch: () => ({
    results: [],
    loading: false,
    error: null,
    search: vi.fn(),
    clear: vi.fn(),
    setPage: vi.fn(),
    query: "",
    totalPages: 0,
    totalResults: 0,
    page: 1,
  }),
}));

// Helper to wrap component with Router
const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe("FeedPage Component - TikTok Style", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render feed page with beely logo", () => {
    renderWithRouter(<FeedPage />);

    // Use getAllByText since logo appears in multiple places
    expect(screen.getAllByText(/beely/i).length).toBeGreaterThan(0);
  });

  it("should render navigation tabs", () => {
    renderWithRouter(<FeedPage />);

    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("Rooms")).toBeInTheDocument();
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.getByText("Audio")).toBeInTheDocument();
  });

  it("should render search button", () => {
    renderWithRouter(<FeedPage />);

    // Search button should be present (in header)
    expect(document.querySelector("button")).toBeInTheDocument();
  });
});
