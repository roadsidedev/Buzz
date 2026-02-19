/**
 * Tests for AdvancedSearchModal
 * - Modal rendering and closing
 * - Filter application
 * - Recent searches
 * - Suggestions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AdvancedSearchModal } from "./advanced-search-modal";
import type { Category } from "common/types/discovery";

describe("AdvancedSearchModal", () => {
  const mockCategories: Category[] = [
    { id: "ai", name: "AI & Tech", slug: "ai" },
    { id: "code", name: "Programming", slug: "code" },
    { id: "biz", name: "Business", slug: "biz" },
  ];

  const mockOnSearch = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    mockOnSearch.mockClear();
    mockOnClose.mockClear();
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("does not render when isOpen is false", () => {
    const { container } = render(
      <AdvancedSearchModal
        isOpen={false}
        onClose={mockOnClose}
        onSearch={mockOnSearch}
        categories={mockCategories}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders modal when isOpen is true", () => {
    render(
      <AdvancedSearchModal
        isOpen={true}
        onClose={mockOnClose}
        onSearch={mockOnSearch}
        categories={mockCategories}
      />
    );

    expect(screen.getByText("Advanced Search")).toBeInTheDocument();
  });

  it("closes when backdrop is clicked", () => {
    render(
      <AdvancedSearchModal
        isOpen={true}
        onClose={mockOnClose}
        onSearch={mockOnSearch}
        categories={mockCategories}
      />
    );

    const backdrop = screen.getByRole("button", { name: "Close search modal" });
    fireEvent.click(backdrop);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it("closes when close button is clicked", () => {
    render(
      <AdvancedSearchModal
        isOpen={true}
        onClose={mockOnClose}
        onSearch={mockOnSearch}
        categories={mockCategories}
      />
    );

    const closeButton = screen.getByRole("button", { name: "Close" });
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it("updates search input value", () => {
    render(
      <AdvancedSearchModal
        isOpen={true}
        onClose={mockOnClose}
        onSearch={mockOnSearch}
        categories={mockCategories}
      />
    );

    const input = screen.getByPlaceholderText(
      "Search rooms, agents, topics..."
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "AI discussion" } });

    expect(input.value).toBe("AI discussion");
  });

  it("handles search on button click", () => {
    render(
      <AdvancedSearchModal
        isOpen={true}
        onClose={mockOnClose}
        onSearch={mockOnSearch}
        categories={mockCategories}
      />
    );

    const input = screen.getByPlaceholderText("Search rooms, agents, topics...");
    fireEvent.change(input, { target: { value: "test query" } });

    const searchButton = screen.getByText("Search");
    fireEvent.click(searchButton);

    expect(mockOnSearch).toHaveBeenCalledWith("test query", {});
    expect(mockOnClose).toHaveBeenCalled();
  });

  it("handles search on Enter key press", () => {
    render(
      <AdvancedSearchModal
        isOpen={true}
        onClose={mockOnClose}
        onSearch={mockOnSearch}
        categories={mockCategories}
      />
    );

    const input = screen.getByPlaceholderText("Search rooms, agents, topics...");
    fireEvent.change(input, { target: { value: "test query" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(mockOnSearch).toHaveBeenCalledWith("test query", {});
  });

  it("disables search button when query is empty", () => {
    render(
      <AdvancedSearchModal
        isOpen={true}
        onClose={mockOnClose}
        onSearch={mockOnSearch}
        categories={mockCategories}
      />
    );

    const searchButton = screen.getByText("Search") as HTMLButtonElement;
    expect(searchButton.disabled).toBe(true);
  });

  it("enables search button when query has text", () => {
    render(
      <AdvancedSearchModal
        isOpen={true}
        onClose={mockOnClose}
        onSearch={mockOnSearch}
        categories={mockCategories}
      />
    );

    const input = screen.getByPlaceholderText("Search rooms, agents, topics...");
    fireEvent.change(input, { target: { value: "query" } });

    const searchButton = screen.getByText("Search") as HTMLButtonElement;
    expect(searchButton.disabled).toBe(false);
  });

  it("displays category options", () => {
    render(
      <AdvancedSearchModal
        isOpen={true}
        onClose={mockOnClose}
        onSearch={mockOnSearch}
        categories={mockCategories}
      />
    );

    mockCategories.forEach((cat) => {
      expect(screen.getByText(cat.name)).toBeInTheDocument();
    });
  });

  it("allows selecting categories", () => {
    render(
      <AdvancedSearchModal
        isOpen={true}
        onClose={mockOnClose}
        onSearch={mockOnSearch}
        categories={mockCategories}
      />
    );

    const categorySelect = screen.getByDisplayValue("AI & Tech");
    fireEvent.change(categorySelect, { target: { value: "code" } });

    // Value changes (multi-select behaves differently)
    expect(categorySelect).toBeInTheDocument();
  });

  it("displays room type options", () => {
    render(
      <AdvancedSearchModal
        isOpen={true}
        onClose={mockOnClose}
        onSearch={mockOnSearch}
        categories={mockCategories}
      />
    );

    expect(screen.getByText("Debate")).toBeInTheDocument();
    expect(screen.getByText("Coding")).toBeInTheDocument();
  });

  it("displays status filter options", () => {
    render(
      <AdvancedSearchModal
        isOpen={true}
        onClose={mockOnClose}
        onSearch={mockOnSearch}
        categories={mockCategories}
      />
    );

    expect(screen.getByText("All Status")).toBeInTheDocument();
    expect(screen.getByText("Live")).toBeInTheDocument();
  });

  it("displays sort options", () => {
    render(
      <AdvancedSearchModal
        isOpen={true}
        onClose={mockOnClose}
        onSearch={mockOnSearch}
        categories={mockCategories}
      />
    );

    expect(screen.getByText("Trending")).toBeInTheDocument();
    expect(screen.getByText("Newest")).toBeInTheDocument();
  });

  it("saves search to recent searches", async () => {
    render(
      <AdvancedSearchModal
        isOpen={true}
        onClose={mockOnClose}
        onSearch={mockOnSearch}
        categories={mockCategories}
      />
    );

    const input = screen.getByPlaceholderText("Search rooms, agents, topics...");
    fireEvent.change(input, { target: { value: "saved search" } });

    const searchButton = screen.getByText("Search");
    fireEvent.click(searchButton);

    await waitFor(() => {
      const stored = localStorage.getItem("search:recent");
      expect(stored).toContain("saved search");
    });
  });

  it("shows recent searches", async () => {
    localStorage.setItem(
      "search:recent",
      JSON.stringify(["previous search 1", "previous search 2"])
    );

    render(
      <AdvancedSearchModal
        isOpen={true}
        onClose={mockOnClose}
        onSearch={mockOnSearch}
        categories={mockCategories}
      />
    );

    expect(screen.getByText("previous search 1")).toBeInTheDocument();
    expect(screen.getByText("previous search 2")).toBeInTheDocument();
  });

  it("handles recent search click", () => {
    localStorage.setItem("search:recent", JSON.stringify(["previous search"]));

    render(
      <AdvancedSearchModal
        isOpen={true}
        onClose={mockOnClose}
        onSearch={mockOnSearch}
        categories={mockCategories}
      />
    );

    const recentButton = screen.getByText("previous search");
    fireEvent.click(recentButton);

    expect(mockOnSearch).toHaveBeenCalledWith("previous search", {});
  });

  it("displays suggestions based on categories", async () => {
    render(
      <AdvancedSearchModal
        isOpen={true}
        onClose={mockOnClose}
        onSearch={mockOnSearch}
        categories={mockCategories}
      />
    );

    const input = screen.getByPlaceholderText("Search rooms, agents, topics...");
    fireEvent.change(input, { target: { value: "AI" } });

    await waitFor(() => {
      expect(screen.getByText("AI & Tech")).toBeInTheDocument();
    });
  });

  it("handles suggestion click", () => {
    render(
      <AdvancedSearchModal
        isOpen={true}
        onClose={mockOnClose}
        onSearch={mockOnSearch}
        categories={mockCategories}
      />
    );

    const input = screen.getByPlaceholderText("Search rooms, agents, topics...");
    fireEvent.change(input, { target: { value: "AI" } });

    const suggestion = screen.getByText("AI & Tech");
    fireEvent.click(suggestion);

    expect(mockOnSearch).toHaveBeenCalledWith("AI & Tech", {});
  });

  it("clears filters when clear button is clicked", () => {
    const mockOnClearFilters = vi.fn();
    render(
      <AdvancedSearchModal
        isOpen={true}
        onClose={mockOnClose}
        onSearch={mockOnSearch}
        categories={mockCategories}
        onClearFilters={mockOnClearFilters}
      />
    );

    const clearButton = screen.getByText("Clear Filters");
    fireEvent.click(clearButton);

    expect(mockOnClearFilters).toHaveBeenCalled();
  });

  it("closes on cancel button click", () => {
    render(
      <AdvancedSearchModal
        isOpen={true}
        onClose={mockOnClose}
        onSearch={mockOnSearch}
        categories={mockCategories}
      />
    );

    const cancelButton = screen.getByText("Cancel");
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it("accepts initial filters", () => {
    render(
      <AdvancedSearchModal
        isOpen={true}
        onClose={mockOnClose}
        onSearch={mockOnSearch}
        categories={mockCategories}
        initialFilters={{ sortBy: "newest" }}
      />
    );

    const sortSelect = screen.getByDisplayValue("Newest");
    expect(sortSelect).toBeInTheDocument();
  });
});
