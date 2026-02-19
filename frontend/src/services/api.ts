/**
 * API Client Service
 *
 * Centralized HTTP client for all REST API calls to the backend.
 * Handles authentication, error handling, retries, and response transformation.
 */

import {
  Agent,
  CreateEpisodeRequest,
  CreatePodcastRequest,
  CreateRoomRequest,
  Episode,
  EpisodeStatus,
  PaginatedResponse,
  Podcast,
  Room,
  ScoringResult,
  SubmitMessageRequest,
  TrendingPodcast,
  UpdatePodcastRequest,
} from "../types/index";

/**
 * API client configuration
 */
interface ApiClientConfig {
  baseUrl: string;
  timeout?: number;
  retries?: number;
}

/**
 * API client class for all backend communication
 */
export class ApiClient {
  private baseUrl: string;
  private timeout: number;
  private retries: number;
  private accessToken: string | null = null;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl;
    this.timeout = config.timeout ?? 30000;
    this.retries = config.retries ?? 3;

    // Load token from localStorage if available
    this.loadTokenFromStorage();
  }

  /**
   * Set authentication token for subsequent requests
   */
  public setToken(token: string): void {
    this.accessToken = token;
    localStorage.setItem("auth_token", token);
  }

  /**
   * Load token from localStorage
   */
  private loadTokenFromStorage(): void {
    const stored = localStorage.getItem("auth_token");
    if (stored) {
      this.accessToken = stored;
    }
  }

  /**
   * Clear authentication token
   */
  public clearToken(): void {
    this.accessToken = null;
    localStorage.removeItem("auth_token");
  }

  /**
   * Get current authentication token
   */
  public getToken(): string | null {
    return this.accessToken;
  }

  /**
   * Internal method to make HTTP requests with error handling and retries
   */
  private async request<T>(
    method: string,
    path: string,
    options?: {
      body?: unknown;
      query?: Record<string, string | number | boolean>;
      headers?: Record<string, string>;
      retry?: boolean;
    },
  ): Promise<T> {
    const url = this.buildUrl(path, options?.query);
    const headers = this.buildHeaders(options?.headers);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: options?.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle non-2xx responses
      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      // Parse response
      const contentType = response.headers.get("content-type");
      const data =
        contentType?.includes("application/json") && response.status !== 204
          ? await response.json()
          : null;

      return data as T;
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle timeout
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new ApiClientError("Request timeout", {
          code: "TIMEOUT",
          statusCode: 408,
        });
      }

      // Handle network errors with retry logic
      if (error instanceof TypeError && options?.retry !== false) {
        if (this.retries > 0) {
          this.retries--;
          return this.request<T>(method, path, { ...options, retry: true });
        }
      }

      throw error;
    }
  }

  /**
   * Build full URL with query parameters
   */
  private buildUrl(
    path: string,
    query?: Record<string, string | number | boolean>,
  ): string {
    const url = new URL(path, this.baseUrl);

    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    return url.toString();
  }

  /**
   * Build request headers with authentication
   */
  private buildHeaders(
    custom?: Record<string, string>,
  ): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...custom,
    };

    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }

    return headers;
  }

  /**
   * Handle HTTP error responses
   */
  private async handleErrorResponse(response: Response): Promise<never> {
    let errorData: Record<string, unknown> = {};

    try {
      errorData = await response.json();
    } catch {
      // Response is not JSON, ignore
    }

    const error = new ApiClientError(errorData.message as string, {
      code: (errorData.code as string) || "UNKNOWN_ERROR",
      statusCode: response.status,
      details: errorData.details as Record<string, unknown>,
    });

    throw error;
  }

  // ==================== PODCAST ENDPOINTS ====================

  /**
   * Create a new podcast
   */
  public async createPodcast(payload: CreatePodcastRequest): Promise<Podcast> {
    return this.request<Podcast>("POST", "/podcasts", {
      body: payload,
    });
  }

  /**
   * Get podcast by ID
   */
  public async getPodcast(podcastId: string): Promise<Podcast> {
    return this.request<Podcast>("GET", `/podcasts/${podcastId}`);
  }

  /**
   * Get all podcasts for an agent
   */
  public async getAgentPodcasts(
    agentId: string,
    options?: { page?: number; limit?: number },
  ): Promise<PaginatedResponse<Podcast>> {
    return this.request<PaginatedResponse<Podcast>>(
      "GET",
      `/agents/${agentId}/podcasts`,
      {
        query: {
          page: options?.page ?? 1,
          limit: options?.limit ?? 20,
        },
      },
    );
  }

  /**
   * Update podcast metadata
   */
  public async updatePodcast(
    podcastId: string,
    payload: UpdatePodcastRequest,
  ): Promise<Podcast> {
    return this.request<Podcast>("PATCH", `/podcasts/${podcastId}`, {
      body: payload,
    });
  }

  /**
   * Get trending podcasts
   */
  public async getTrendingPodcasts(options?: {
    category?: string;
    limit?: number;
  }): Promise<TrendingPodcast[]> {
    return this.request<TrendingPodcast[]>("GET", "/podcasts/trending", {
      query: {
        category: options?.category ?? "",
        limit: options?.limit ?? 10,
      },
    });
  }

  // ==================== EPISODE ENDPOINTS ====================

  /**
   * Generate new episode for podcast
   */
  public async generateEpisode(
    payload: CreateEpisodeRequest,
  ): Promise<Episode> {
    return this.request<Episode>(
      "POST",
      `/podcasts/${payload.podcastId}/episodes`,
      {
        body: {
          title: payload.title,
          sourceUrls: payload.sourceUrls,
        },
      },
    );
  }

  /**
   * Get episodes for a podcast
   */
  public async getEpisodes(
    podcastId: string,
    options?: {
      status?: EpisodeStatus;
      page?: number;
      limit?: number;
    },
  ): Promise<PaginatedResponse<Episode>> {
    return this.request<PaginatedResponse<Episode>>(
      "GET",
      `/podcasts/${podcastId}/episodes`,
      {
        query: {
          status: options?.status ?? "",
          page: options?.page ?? 1,
          limit: options?.limit ?? 20,
        },
      },
    );
  }

  /**
   * Get single episode by ID
   */
  public async getEpisode(episodeId: string): Promise<Episode> {
    return this.request<Episode>("GET", `/episodes/${episodeId}`);
  }

  /**
   * Get episode generation status (for polling)
   */
  public async getEpisodeStatus(episodeId: string): Promise<{
    id: string;
    status: EpisodeStatus;
    progress?: number;
    audioUrl?: string;
    transcript?: string;
    error?: string;
  }> {
    const episode = await this.getEpisode(episodeId);
    return {
      id: episode.id,
      status: episode.status,
      audioUrl: episode.audioUrl,
      transcript: episode.transcript,
      error: episode.error,
    };
  }

  /**
   * Distribute episode to external platforms
   */
  public async distributeEpisode(
    episodeId: string,
    platforms: string[] = ["spotify", "apple", "google", "rss"],
  ): Promise<{
    episodeId: string;
    distributions: Array<{ platform: string; status: string; url?: string }>;
  }> {
    return this.request("POST", `/episodes/${episodeId}/distribute`, {
      body: { platforms },
    });
  }

  // ==================== ROOM ENDPOINTS ====================

  /**
   * Create a new live room
   */
  public async createRoom(payload: CreateRoomRequest): Promise<Room> {
    return this.request<Room>("POST", "/rooms", {
      body: payload,
    });
  }

  /**
   * Get room by ID
   */
  public async getRoom(roomId: string): Promise<Room> {
    return this.request<Room>("GET", `/rooms/${roomId}`);
  }

  /**
   * Get active/live rooms
   */
  public async getLiveRooms(options?: {
    type?: string;
    limit?: number;
  }): Promise<Room[]> {
    return this.request<Room[]>("GET", "/rooms/live", {
      query: {
        type: options?.type ?? "",
        limit: options?.limit ?? 10,
      },
    });
  }

  /**
   * Submit message to room for orchestration
   */
  public async submitMessage(payload: SubmitMessageRequest): Promise<{
    messageId: string;
    score?: number;
    selected: boolean;
  }> {
    return this.request("POST", `/rooms/${payload.roomId}/messages`, {
      body: { text: payload.text },
    });
  }

  /**
   * Score multiple candidate messages (batch operation)
   */
  public async scoreMessages(
    roomId: string,
    messages: Array<{ id: string; text: string }>,
  ): Promise<ScoringResult[]> {
    return this.request<ScoringResult[]>(
      "POST",
      `/rooms/${roomId}/score-messages`,
      {
        body: { messages },
      },
    );
  }

  /**
   * Close a room
   */
  public async closeRoom(roomId: string): Promise<Room> {
    return this.request<Room>("POST", `/rooms/${roomId}/close`);
  }

  // ==================== DISCOVERY ENDPOINTS ====================

  /**
   * Search podcasts and rooms
   */
  public async search(
    query: string,
    options?: {
      type?: "podcast" | "room";
      category?: string;
      limit?: number;
    },
  ): Promise<{
    podcasts: Podcast[];
    rooms: Room[];
  }> {
    return this.request("GET", "/search", {
      query: {
        q: query,
        type: options?.type ?? "podcast",
        category: options?.category ?? "",
        limit: options?.limit ?? 10,
      },
    });
  }

  // ==================== AGENT ENDPOINTS ====================

  /**
   * Get current authenticated agent
   */
  public async getCurrentAgent(): Promise<Agent> {
    return this.request<Agent>("GET", "/agents/me");
  }

  /**
   * Get agent by ID
   */
  public async getAgent(agentId: string): Promise<Agent> {
    return this.request<Agent>("GET", `/agents/${agentId}`);
  }

  // ==================== HEALTH CHECK ====================

  /**
   * Check API gateway health
   */
  public async healthCheck(): Promise<{
    status: string;
    timestamp: string;
    orchestrator: boolean;
  }> {
    return this.request("GET", "/health");
  }

  /**
   * Generic GET request
   */
  public async get<T>(
    path: string,
    options?: { query?: Record<string, string | number | boolean> },
  ): Promise<{ data: T }> {
    const data = await this.request<T>("GET", path, options);
    return { data };
  }

  /**
   * Generic POST request
   */
  public async post<T>(path: string, body: unknown): Promise<{ data: T }> {
    const data = await this.request<T>("POST", path, { body });
    return { data };
  }
}

/**
 * Custom error class for API errors
 */
export class ApiClientError extends Error {
  constructor(
    message: string,
    public context: {
      code: string;
      statusCode: number;
      details?: Record<string, unknown>;
    },
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

/**
 * Create and export default API client instance
 */
const apiBaseUrl =
  import.meta.env.VITE_API_URL || "http://localhost:4000/api/v1";

export const apiClient = new ApiClient({
  baseUrl: apiBaseUrl,
  timeout: 30000,
  retries: 3,
});

// Export type for dependency injection
export default apiClient;
