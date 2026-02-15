/**
 * useSearchAnalytics Hook
 * Tracks search behavior and filter usage for analytics
 * ~100 lines
 */

import { useCallback, useRef } from "react";
import type { FilterState } from "./use-filter-persistence";

export interface SearchAnalyticsEvent {
  type: "search" | "filter" | "click" | "view";
  query?: string;
  filters?: FilterState;
  resultId?: string;
  resultPosition?: number;
  timestamp: number;
}

/**
 * useSearchAnalytics Hook
 * Tracks and reports search analytics
 *
 * @returns Analytics tracking functions
 */
export function useSearchAnalytics() {
  const pendingEventsRef = useRef<SearchAnalyticsEvent[]>([]);
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Queue an event for analytics
   */
  const trackEvent = useCallback((event: Omit<SearchAnalyticsEvent, "timestamp">) => {
    pendingEventsRef.current.push({
      ...event,
      timestamp: Date.now(),
    });

    // Debounce flush (batch events)
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
    }

    flushTimeoutRef.current = setTimeout(() => {
      flushEvents();
    }, 1000);
  }, []);

  /**
   * Track search query
   */
  const trackSearch = useCallback(
    (query: string, filters?: FilterState) => {
      trackEvent({
        type: "search",
        query,
        filters,
      });
    },
    [trackEvent]
  );

  /**
   * Track filter change
   */
  const trackFilterChange = useCallback(
    (filters: FilterState) => {
      trackEvent({
        type: "filter",
        filters,
      });
    },
    [trackEvent]
  );

  /**
   * Track room result click
   */
  const trackResultClick = useCallback(
    (resultId: string, position: number, query?: string) => {
      trackEvent({
        type: "click",
        query,
        resultId,
        resultPosition: position,
      });
    },
    [trackEvent]
  );

  /**
   * Track room view/join
   */
  const trackRoomView = useCallback(
    (resultId: string) => {
      trackEvent({
        type: "view",
        resultId,
      });
    },
    [trackEvent]
  );

  /**
   * Flush pending events to analytics service
   */
  const flushEvents = useCallback(async () => {
    if (pendingEventsRef.current.length === 0) return;

    const events = [...pendingEventsRef.current];
    pendingEventsRef.current = [];

    try {
      // Send to analytics endpoint
      const response = await fetch("/api/analytics/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
        },
        body: JSON.stringify({
          events,
          timestamp: Date.now(),
        }),
      });

      if (!response.ok) {
        console.warn("Analytics flush failed:", response.statusText);
        // Re-queue events on failure
        pendingEventsRef.current = events;
      }
    } catch (err) {
      console.error("Failed to send analytics:", err);
      // Re-queue events on error
      pendingEventsRef.current = events;
    }
  }, []);

  /**
   * Get pending event count
   */
  const getPendingEventCount = useCallback(
    () => pendingEventsRef.current.length,
    []
  );

  /**
   * Clear pending events without sending
   */
  const clearPending = useCallback(() => {
    pendingEventsRef.current = [];
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
    }
  }, []);

  return {
    trackEvent,
    trackSearch,
    trackFilterChange,
    trackResultClick,
    trackRoomView,
    flushEvents,
    getPendingEventCount,
    clearPending,
  };
}
