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
} from "../../common/types/discovery";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

/**
 * Discovery API Service
 * Provides methods for fetching discovery data, trending, search, etc.
 */
export class DiscoveryService {
  /**
   * Get main discovery page data (live now, trending, categories)
   */
  static async getDiscoveryPage(): Promise<DiscoveryPageData> {
    const response = await fetch(`${API_BASE}/discovery`, {
      headers: {
        Authorization: `Bearer ${this.getToken()}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch discovery page: ${response.statusText}`);
    }

    return response.json();
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
      params.append("categoryId", categoryId);
    }

    const response = await fetch(
      `${API_BASE}/discovery/trending?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${this.getToken()}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch trending: ${response.statusText}`);
    }

    const data = await response.json();
    return data.rooms || [];
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
      `${API_BASE}/discovery/live-now?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${this.getToken()}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch live now: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Search rooms
   */
  static async search(request: SearchRequest): Promise<SearchResponse> {
    const params = new URLSearchParams();
    params.append("q", request.query);
    if (request.page) params.append("page", request.page.toString());
    if (request.limit) params.append("limit", request.limit.toString());
    if (request.categoryId) params.append("categoryId", request.categoryId);
    if (request.sortBy) params.append("sortBy", request.sortBy);

    const response = await fetch(
      `${API_BASE}/discovery/search?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${this.getToken()}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to search: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get all categories
   */
  static async getCategories(): Promise<Category[]> {
    const response = await fetch(`${API_BASE}/discovery/categories`, {
      headers: {
        Authorization: `Bearer ${this.getToken()}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch categories: ${response.statusText}`);
    }

    const data = await response.json();
    return data.categories || [];
  }

  /**
   * Get rooms by category
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
      `${API_BASE}/discovery/categories/${categoryId}?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${this.getToken()}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch category rooms: ${response.statusText}`
      );
    }

    return response.json();
  }

  /**
   * Get room details
   */
  static async getRoomDetails(roomId: string): Promise<RoomDetails> {
    const response = await fetch(`${API_BASE}/room/${roomId}`, {
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
    const response = await fetch(`${API_BASE}/room/${roomId}/participants`, {
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
    const response = await fetch(`${API_BASE}/room/${request.roomId}/join`, {
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
    const response = await fetch(`${API_BASE}/room/${roomId}/leave`, {
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
      `${API_BASE}/discovery/recommendations?limit=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${this.getToken()}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch recommendations: ${response.statusText}`);
    }

    const data = await response.json();
    return data.recommendations || [];
  }

  /**
   * Get authentication token from localStorage
   */
  private static getToken(): string {
    return localStorage.getItem("token") || "";
  }
}

/**
 * Export singleton instance
 */
export const discoveryService = DiscoveryService;
