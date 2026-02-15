/**
 * useFilterPersistence Hook
 * Persists filter selections to localStorage and URL params
 * ~80 lines
 */

import { useState, useCallback, useEffect } from "react";

export interface FilterState {
  categories?: string[];
  roomType?: string;
  status?: "live" | "upcoming" | "archived" | "all";
  sortBy?: "trending" | "newest" | "viewers" | "activity";
}

const FILTER_STORAGE_KEY = "discovery:filters";

/**
 * useFilterPersistence Hook
 * Saves and loads filter state from localStorage and URL
 *
 * @returns Filter state and control functions
 */
export function useFilterPersistence() {
  const [filters, setFilters] = useState<FilterState>(() => {
    // Load from localStorage first
    try {
      const stored = localStorage.getItem(FILTER_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (err) {
      console.error("Failed to load filters from localStorage:", err);
    }

    // Try to load from URL params
    const params = new URLSearchParams(window.location.search);
    return {
      categories: params.get("categories")?.split(",").filter(Boolean) || undefined,
      roomType: params.get("roomType") || undefined,
      status: (params.get("status") as FilterState["status"]) || undefined,
      sortBy: (params.get("sortBy") as FilterState["sortBy"]) || undefined,
    };
  });

  // Persist to localStorage whenever filters change
  useEffect(() => {
    try {
      localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
    } catch (err) {
      console.error("Failed to save filters to localStorage:", err);
    }
  }, [filters]);

  /**
   * Update a single filter
   */
  const setFilter = useCallback((key: keyof FilterState, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  /**
   * Update multiple filters at once
   */
  const setFilters_ = useCallback((newFilters: Partial<FilterState>) => {
    setFilters((prev) => ({
      ...prev,
      ...newFilters,
    }));
  }, []);

  /**
   * Clear all filters
   */
  const clearFilters = useCallback(() => {
    setFilters({});
    try {
      localStorage.removeItem(FILTER_STORAGE_KEY);
    } catch (err) {
      console.error("Failed to clear filters from localStorage:", err);
    }
  }, []);

  /**
   * Export current filters as URL search params
   */
  const toUrlParams = useCallback((): string => {
    const params = new URLSearchParams();
    if (filters.categories?.length) {
      params.set("categories", filters.categories.join(","));
    }
    if (filters.roomType) {
      params.set("roomType", filters.roomType);
    }
    if (filters.status && filters.status !== "all") {
      params.set("status", filters.status);
    }
    if (filters.sortBy) {
      params.set("sortBy", filters.sortBy);
    }
    const str = params.toString();
    return str ? `?${str}` : "";
  }, [filters]);

  /**
   * Get shareable URL with current filters
   */
  const getShareUrl = useCallback((): string => {
    const baseUrl = window.location.origin + window.location.pathname;
    return baseUrl + toUrlParams();
  }, [toUrlParams]);

  /**
   * Load filters from URL params
   */
  const loadFromUrl = useCallback((searchParams: string) => {
    const params = new URLSearchParams(searchParams);
    setFilters({
      categories: params.get("categories")?.split(",").filter(Boolean) || undefined,
      roomType: params.get("roomType") || undefined,
      status: (params.get("status") as FilterState["status"]) || undefined,
      sortBy: (params.get("sortBy") as FilterState["sortBy"]) || undefined,
    });
  }, []);

  /**
   * Check if any filters are active
   */
  const hasActiveFilters = useCallback((): boolean => {
    return Object.values(filters).some(
      (value) => value !== undefined && value !== null && value !== "all"
    );
  }, [filters]);

  return {
    filters,
    setFilter,
    setFilters: setFilters_,
    clearFilters,
    toUrlParams,
    getShareUrl,
    loadFromUrl,
    hasActiveFilters,
  };
}
