/**
 * Discovery Service
 * API client for discovery and trending features
 */

import type {
  DiscoveryPageData,
  SearchRequest,
  SearchResponse,
  PaginatedResponse,
  DiscoveryRoom,
  Category,
  RoomDetails,
  JoinRoomRequest,
  JoinRoomResponse,
} from "common/types/discovery";

export const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:4000/api/v1").replace(/\/+$/, "");

/**
 * Discovery API Service
 * Provides methods for fetching discovery data, trending, search, etc.
 * 
 * Note: Discovery endpoints are public and do not require authentication
 */
export class DiscoveryService {
  /**
   * Get main discovery page data (live now, trending, categories)
   * Note: This endpoint may not exist yet - using individual calls instead
   */
  static async getDiscoveryPage(): Promise<DiscoveryPageData> {
    try {
      // Fetch live now, trending, and categories in parallel
      const [liveNowResponse, trendingResponse, categoriesResponse] = await Promise.all([
        fetch(`${API_BASE}/discover/live-now?limit=6`),
        fetch(`${API_BASE}/discover/trending?limit=10`),
        fetch(`${API_BASE}/discover/categories`),
      ]);

      // Check for errors
      if (!liveNowResponse.ok || !trendingResponse.ok || !categoriesResponse.ok) {
        throw new Error("Failed to fetch discovery data");
      }

      const liveNowData = await liveNowResponse.json();
      const trendingData = await trendingResponse.json();
      const categoriesData = await categoriesResponse.json();

      return {
        liveNow: liveNowData.data?.rooms || liveNowData.rooms || [],
        trending: trendingData.data?.rooms || trendingData.rooms || [],
        categories: categoriesData.categories || [],
      };
    } catch (err) {
      throw new Error(`Failed to fetch discovery page: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Get trending rooms
   */
  static async getTrending(
    limit: number = 20,
    categoryId?: string
  ): Promise<DiscoveryRoom[]> {
    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    if (categoryId) {
      params.append("type", categoryId); // Note: backend uses 'type' not 'categoryId'
    }

    const response = await fetch(
      `${API_BASE}/discover/trending?${params.toString()}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch trending: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data?.rooms || data.rooms || [];
  }

  /**
   * Get live now rooms
   */
  static async getLiveNow(
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedResponse<DiscoveryRoom>> {
    const params = new URLSearchParams();
    params.append("page", page.toString());
    params.append("limit", limit.toString());

    const response = await fetch(
      `${API_BASE}/discover/live-now?${params.toString()}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch live now: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Map the response to match PaginatedResponse format
    return {
      data: data.data?.rooms || data.rooms || [],
      page: page,
      pageSize: 20,
      total: data.pagination?.total || 0,
      totalPages: data.pagination?.pages || 0,
      hasMore: page < (data.pagination?.pages || 1),
    };
  }

  /**
   * Search rooms
   */
  static async search(request: SearchRequest): Promise<SearchResponse> {
    const params = new URLSearchParams();
    params.append("q", request.query);
    if (request.page) params.append("page", request.page.toString());
    if (request.limit) params.append("limit", request.limit.toString());
    if (request.categoryId) params.append("type", request.categoryId); // backend uses 'type'
    if (request.sortBy) params.append("sortBy", request.sortBy);

    const response = await fetch(
      `${API_BASE}/discover/search?${params.toString()}`
    );

    if (!response.ok) {
      throw new Error(`Failed to search: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      results: data.data?.rooms || data.rooms || [],
      total: data.data?.total || data.pagination?.total || 0,
      page: request.page || 1,
      pageSize: request.limit || 20,
      hasMore: (request.page || 1) < Math.ceil((data.data?.total || data.pagination?.total || 0) / (request.limit || 20)),
    };
  }

  /**
   * Get all categories from the backend /discover/categories endpoint.
   */
  static async getCategories(): Promise<Category[]> {
    try {
      const response = await fetch(`${API_BASE}/discover/categories`);
      if (!response.ok) {
        throw new Error(`Failed to fetch categories: ${response.statusText}`);
      }
      const data = await response.json();
      const raw = data.data?.categories || data.categories || [];
      return raw.map((c: any) => ({
        id: c.id,
        name: c.name,
        slug: c.id,
      }));
    } catch {
      // Fallback to room types if endpoint unavailable
      return [
        { id: "debate", name: "Debate", slug: "debate" },
        { id: "coding", name: "Coding", slug: "coding" },
        { id: "research", name: "Research", slug: "research" },
        { id: "trading", name: "Trading", slug: "trading" },
        { id: "simulation", name: "Simulation", slug: "simulation" },
        { id: "other", name: "Other", slug: "other" },
      ];
    }
  }

  /**
   * Get rooms by type (not by category)
   */
  static async getRoomsByCategory(
    categoryId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedResponse<DiscoveryRoom>> {
    const params = new URLSearchParams();
    params.append("page", page.toString());
    params.append("limit", limit.toString());

    const response = await fetch(
      `${API_BASE}/discover/by-type/${categoryId}?${params.toString()}`
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch category rooms: ${response.statusText}`
      );
    }

    const data = await response.json();
    return {
      data: data.data?.rooms || data.rooms || [],
      page: page,
      pageSize: limit,
      total: data.data?.pagination?.total || data.pagination?.total || 0,
      totalPages: data.data?.pagination?.pages || data.pagination?.pages || 0,
      hasMore: page < (data.data?.pagination?.pages || data.pagination?.pages || 1),
    };
  }

  /**
   * Get room details
   */
  static async getRoomDetails(roomId: string): Promise<RoomDetails> {
    const response = await fetch(`${API_BASE}/rooms/${roomId}`, {
      headers: {
        Authorization: `Bearer ${this.getToken()}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch room details: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get room participants
   */
  static async getRoomParticipants(roomId: string): Promise<DiscoveryRoom["participants"]> {
    const response = await fetch(`${API_BASE}/rooms/${roomId}/participants`, {
      headers: {
        Authorization: `Bearer ${this.getToken()}`,
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch room participants: ${response.statusText}`
      );
    }

    const data = await response.json();
    return data.participants || [];
  }

  /**
   * Join a room
   */
  static async joinRoom(request: JoinRoomRequest): Promise<JoinRoomResponse> {
    const response = await fetch(`${API_BASE}/rooms/${request.roomId}/join`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.getToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Failed to join room: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Leave a room
   */
  static async leaveRoom(roomId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/rooms/${roomId}/leave`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${this.getToken()}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to leave room: ${response.statusText}`);
    }
  }

  /**
   * Get user's recommendations
   */
  static async getRecommendations(limit: number = 10): Promise<DiscoveryRoom[]> {
    const response = await fetch(
      `${API_BASE}/discover/trending?limit=${limit}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch recommendations: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data?.rooms || data.rooms || [];
  }

  /**
   * Get recently ended rooms
   */
  static async getRecentlyEnded(limit: number = 10): Promise<DiscoveryRoom[]> {
    const response = await fetch(`${API_BASE}/discover/recently-ended?limit=${limit}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch recently ended: ${response.statusText}`);
    }
    const data = await response.json();
    return data.data?.rooms || data.rooms || [];
  }

  /**
   * Get agent leaderboard (ranked by selection rate over last 7 days)
   */
  static async getLeaderboard(limit: number = 10): Promise<any[]> {
    const response = await fetch(`${API_BASE}/discover/leaderboard?limit=${limit}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch leaderboard: ${response.statusText}`);
    }
    const data = await response.json();
    return data.data?.agents || data.agents || [];
  }

  /**
   * Get authentication token from localStorage
   */
  private static getToken(): string {
    // BUG FIX: Use "auth_token" to match the key written by api.ts#setToken()
    return localStorage.getItem("auth_token") || localStorage.getItem("token") || "";
  }
}

/**
 * Export singleton instance
 */
export const discoveryService = DiscoveryService;
