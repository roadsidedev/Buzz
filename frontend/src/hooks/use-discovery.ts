/**
 * useDiscovery Hook
 * Manages discovery data fetching with caching and real-time updates
 */

import { useState, useEffect, useCallback } from "react";
import { discoveryService } from "../services/discovery";
import type {
  DiscoveryPageData,
  DiscoveryRoom,
  Category,
  PaginatedResponse,
} from "../../common/types/discovery";

/**
 * Discovery data state
 */
export interface DiscoveryData {
  discoveryPage: DiscoveryPageData | null;
  trending: DiscoveryRoom[];
  liveNow: DiscoveryRoom[];
  categories: Category[];
  loading: boolean;
  error: Error | null;
}

/**
 * useDiscovery Hook
 * Fetches and caches discovery data (live now, trending, categories)
 * Auto-refreshes trending data every 5 minutes
 */
export function useDiscovery() {
  const [data, setData] = useState<DiscoveryData>({
    discoveryPage: null,
    trending: [],
    liveNow: [],
    categories: [],
    loading: true,
    error: null,
  });

  // Fetch discovery page data
  const fetchDiscoveryPage = useCallback(async () => {
    try {
      setData((prev) => ({ ...prev, loading: true, error: null }));

      const pageData = await discoveryService.getDiscoveryPage();

      setData({
        discoveryPage: pageData,
        trending: pageData.trending || [],
        liveNow: pageData.liveNow || [],
        categories: pageData.categories || [],
        loading: false,
        error: null,
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setData((prev) => ({
        ...prev,
        loading: false,
        error,
      }));
    }
  }, []);

  // Fetch trending data specifically (for polling)
  const fetchTrending = useCallback(
    async (categoryId?: string) => {
      try {
        const trending = await discoveryService.getTrending(20, categoryId);
        setData((prev) => ({
          ...prev,
          trending,
          error: null,
        }));
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setData((prev) => ({
          ...prev,
          error,
        }));
      }
    },
    []
  );

  // Fetch live now data specifically
  const fetchLiveNow = useCallback(async (page: number = 1) => {
    try {
      const response: PaginatedResponse<DiscoveryRoom> =
        await discoveryService.getLiveNow(page);
      setData((prev) => ({
        ...prev,
        liveNow: response.data,
        error: null,
      }));
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setData((prev) => ({
        ...prev,
        error,
      }));
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchDiscoveryPage();
  }, [fetchDiscoveryPage]);

  // Auto-refresh trending every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      fetchTrending();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [fetchTrending]);

  // Refresh live now every 1 minute
  useEffect(() => {
    const interval = setInterval(() => {
      fetchLiveNow();
    }, 60 * 1000); // 1 minute

    return () => clearInterval(interval);
  }, [fetchLiveNow]);

  const refresh = useCallback(async () => {
    await fetchDiscoveryPage();
  }, [fetchDiscoveryPage]);

  return {
    ...data,
    fetchTrending,
    fetchLiveNow,
    refresh,
  };
}

/**
 * useSearch Hook
 * Handles search with debouncing and pagination
 */
export function useSearch() {
  const [results, setResults] = useState<DiscoveryRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);

  // Debounced search
  const search = useCallback(
    async (
      searchQuery: string,
      searchPage: number = 1,
      categoryId?: string
    ) => {
      if (!searchQuery.trim()) {
        setResults([]);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        setQuery(searchQuery);
        setPage(searchPage);

        const response = await discoveryService.search({
          query: searchQuery,
          page: searchPage,
          limit: 20,
          categoryId,
        });

        setResults(response.results);
        setTotalResults(response.total);
        setTotalPages(Math.ceil(response.total / 20));
      } catch (err) {
        const searchError = err instanceof Error ? err : new Error(String(err));
        setError(searchError);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const clear = useCallback(() => {
    setResults([]);
    setQuery("");
    setPage(1);
    setTotalResults(0);
    setTotalPages(1);
  }, []);

  return {
    results,
    loading,
    error,
    query,
    page,
    totalPages,
    totalResults,
    search,
    clear,
    setPage,
  };
}

/**
 * useCategoryRooms Hook
 * Fetches rooms for a specific category with pagination
 */
export function useCategoryRooms(categoryId: string | null) {
  const [rooms, setRooms] = useState<DiscoveryRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);

  const fetch = useCallback(
    async (categoryIdToFetch: string, pageNum: number = 1) => {
      if (!categoryIdToFetch) {
        setRooms([]);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const response: PaginatedResponse<DiscoveryRoom> =
          await discoveryService.getRoomsByCategory(
            categoryIdToFetch,
            pageNum
          );

        setRooms(response.data);
        setPage(pageNum);
        setTotalPages(response.totalPages);
        setTotalResults(response.total);
      } catch (err) {
        const categoryError = err instanceof Error ? err : new Error(String(err));
        setError(categoryError);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (categoryId) {
      fetch(categoryId, 1);
    }
  }, [categoryId, fetch]);

  const changePage = useCallback(
    (newPage: number) => {
      if (categoryId) {
        fetch(categoryId, newPage);
      }
    },
    [categoryId, fetch]
  );

  return {
    rooms,
    loading,
    error,
    page,
    totalPages,
    totalResults,
    changePage,
  };
}

/**
 * useRoomDetails Hook
 * Fetches details for a single room
 */
export function useRoomDetails(roomId: string | null) {
  const [room, setRoom] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!roomId) {
      setRoom(null);
      return;
    }

    const fetch = async () => {
      try {
        setLoading(true);
        setError(null);
        const details = await discoveryService.getRoomDetails(roomId);
        setRoom(details);
      } catch (err) {
        const detailError = err instanceof Error ? err : new Error(String(err));
        setError(detailError);
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [roomId]);

  return { room, loading, error };
}
