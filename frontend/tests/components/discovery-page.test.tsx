/**
 * Tests for DiscoveryPage Component
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { DiscoveryPage } from "../../src/pages/discovery-page";

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
  useCategoryRooms: () => ({
    rooms: [],
    loading: false,
    error: null,
    totalPages: 0,
    totalResults: 0,
    page: 1,
    changePage: vi.fn(),
  }),
}));

// Helper to wrap component with Router
const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe("DiscoveryPage Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render discovery page header", () => {
    renderWithRouter(<DiscoveryPage />);

    expect(screen.getByText(/DISCOVERY/i)).toBeInTheDocument();
  });

  it("should render search placeholder", () => {
    renderWithRouter(<DiscoveryPage />);

    expect(screen.getByPlaceholderText(/Search rooms/i)).toBeInTheDocument();
  });

  it("should render tabs", () => {
    renderWithRouter(<DiscoveryPage />);

    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("Rooms")).toBeInTheDocument();
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.getByText("Podcasts")).toBeInTheDocument();
  });

  it("should render empty state when no content", async () => {
    renderWithRouter(<DiscoveryPage />);

    await waitFor(() => {
      expect(screen.getByText(/No content found/i)).toBeInTheDocument();
    });
  });
});
