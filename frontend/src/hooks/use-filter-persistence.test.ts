/**
 * Tests for useFilterPersistence Hook
 * - Save/load from localStorage
 * - URL param sync
 * - Filter operations
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFilterPersistence } from "./use-filter-persistence";

describe("useFilterPersistence Hook", () => {
  beforeEach(() => {
    localStorage.clear();
    delete (window as any).location;
    (window as any).location = { search: "" };
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("initializes with empty filters", () => {
    const { result } = renderHook(() => useFilterPersistence());

    expect(result.current.filters).toEqual({});
  });

  it("loads filters from localStorage", () => {
    const stored = { categories: ["ai"], sortBy: "trending" as const };
    localStorage.setItem("discovery:filters", JSON.stringify(stored));

    const { result } = renderHook(() => useFilterPersistence());

    expect(result.current.filters).toEqual(stored);
  });

  it("saves filters to localStorage", () => {
    const { result } = renderHook(() => useFilterPersistence());

    act(() => {
      result.current.setFilter("sortBy", "newest");
    });

    const stored = JSON.parse(localStorage.getItem("discovery:filters") || "{}");
    expect(stored.sortBy).toBe("newest");
  });

  it("updates single filter", () => {
    const { result } = renderHook(() => useFilterPersistence());

    act(() => {
      result.current.setFilter("sortBy", "trending");
    });

    expect(result.current.filters.sortBy).toBe("trending");
  });

  it("updates multiple filters at once", () => {
    const { result } = renderHook(() => useFilterPersistence());

    act(() => {
      result.current.setFilters({
        categories: ["ai"],
        sortBy: "newest",
        status: "live",
      });
    });

    expect(result.current.filters.categories).toEqual(["ai"]);
    expect(result.current.filters.sortBy).toBe("newest");
    expect(result.current.filters.status).toBe("live");
  });

  it("clears all filters", () => {
    const { result } = renderHook(() => useFilterPersistence());

    act(() => {
      result.current.setFilter("sortBy", "trending");
      result.current.setFilter("status", "live");
    });

    expect(result.current.filters.sortBy).toBeDefined();

    act(() => {
      result.current.clearFilters();
    });

    expect(result.current.filters).toEqual({});
  });

  it("generates URL params from filters", () => {
    const { result } = renderHook(() => useFilterPersistence());

    act(() => {
      result.current.setFilters({
        categories: ["ai", "code"],
        sortBy: "trending",
        status: "live",
      });
    });

    const params = result.current.toUrlParams();
    expect(params).toContain("categories=ai%2Ccode");
    expect(params).toContain("sortBy=trending");
    expect(params).toContain("status=live");
  });

  it("returns empty string when no active filters", () => {
    const { result } = renderHook(() => useFilterPersistence());

    const params = result.current.toUrlParams();
    expect(params).toBe("");
  });

  it("generates shareable URL", () => {
    const { result } = renderHook(() => useFilterPersistence());

    act(() => {
      result.current.setFilter("sortBy", "newest");
    });

    const url = result.current.getShareUrl();
    expect(url).toContain("sortBy=newest");
    expect(url).toContain(window.location.pathname);
  });

  it("loads filters from URL params", () => {
    (window as any).location.search = "?sortBy=newest&status=live";

    const { result } = renderHook(() => useFilterPersistence());

    expect(result.current.filters.sortBy).toBe("newest");
    expect(result.current.filters.status).toBe("live");
  });

  it("parses comma-separated categories from URL", () => {
    (window as any).location.search = "?categories=ai,code,business";

    const { result } = renderHook(() => useFilterPersistence());

    expect(result.current.filters.categories).toEqual(["ai", "code", "business"]);
  });

  it("detects active filters", () => {
    const { result } = renderHook(() => useFilterPersistence());

    expect(result.current.hasActiveFilters()).toBe(false);

    act(() => {
      result.current.setFilter("sortBy", "trending");
    });

    expect(result.current.hasActiveFilters()).toBe(true);
  });

  it("ignores 'all' status as inactive", () => {
    const { result } = renderHook(() => useFilterPersistence());

    act(() => {
      result.current.setFilter("status", "all");
    });

    expect(result.current.hasActiveFilters()).toBe(false);
  });

  it("removes localStorage key when filters cleared", () => {
    localStorage.setItem("discovery:filters", JSON.stringify({ sortBy: "trending" }));

    const { result } = renderHook(() => useFilterPersistence());

    act(() => {
      result.current.clearFilters();
    });

    expect(localStorage.getItem("discovery:filters")).toBeNull();
  });

  it("persists merged filters", () => {
    const { result } = renderHook(() => useFilterPersistence());

    act(() => {
      result.current.setFilter("sortBy", "trending");
      result.current.setFilter("status", "live");
    });

    const stored = JSON.parse(localStorage.getItem("discovery:filters") || "{}");
    expect(stored).toEqual({
      sortBy: "trending",
      status: "live",
    });
  });

  it("handles localStorage errors gracefully", () => {
    const storageSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage full");
    });

    const { result } = renderHook(() => useFilterPersistence());

    act(() => {
      result.current.setFilter("sortBy", "trending");
    });

    // Should not throw, just log error
    expect(result.current.filters.sortBy).toBe("trending");

    storageSpy.mockRestore();
  });

  it("handles invalid JSON in localStorage", () => {
    localStorage.setItem("discovery:filters", "invalid json");

    const { result } = renderHook(() => useFilterPersistence());

    // Should start with empty filters, not throw
    expect(result.current.filters).toEqual({});
  });
});
