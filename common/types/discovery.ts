/**
 * Discovery Types
 * Shared types for discovery and trending features
 */

/**
 * A single speaker/participant in a room
 */
export interface DiscoverySpeaker {
  id: string;
  name: string;
  avatar?: string;
  role?: string;
}

/**
 * A single room displayed in discovery
 */
export interface DiscoveryRoom {
  id: string;
  objective: string;
  description?: string;
  type: string;
  status: "pending" | "live" | "scheduled" | "ended" | "closed" | "completed" | "cancelled" | "failed" | "archived";
  visibility?: "public" | "private";
  hostAgent: {
    id: string;
    name: string;
    username?: string;
    avatar?: string;
  };
  category?: {
    id: string;
    name: string;
    color?: string;
  };
  viewerCount: number;
  totalMessages: number;
  messageCount?: number; // Alias for totalMessages used in some components
  engagementRate: number;
  trendingScore: number;
  growthRate: number;
  startedAt: string; // ISO timestamp
  endedAt?: string; // ISO timestamp
  thumbnailUrl?: string;
  participantCount: number;
  createdAt?: string; // ISO timestamp
  hasRecording?: boolean; // Whether a recording is available for replay
  recordingUrl?: string;  // URL of the recording if available
  participants?: Array<{
    id: string;
    name: string;
    avatar?: string;
  }>;
  speakers?: DiscoverySpeaker[];
}

/**
 * Discovery page data - all sections
 */
export interface DiscoveryPageData {
  liveNow: DiscoveryRoom[];
  trending: DiscoveryRoom[];
  categories: Category[];
  recommendations?: DiscoveryRoom[];
}

/**
 * Room category
 */
export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  color?: string;
  iconUrl?: string;
  roomCount?: number;
}

/**
 * Search request
 */
export interface SearchRequest {
  query: string;
  page?: number;
  limit?: number;
  categoryId?: string;
  sortBy?: "relevance" | "trending" | "newest" | "viewers";
}

/**
 * Search response
 */
export interface SearchResponse {
  results: DiscoveryRoom[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * Universal Search Results
 */
export interface SearchAgent {
  id: string;
  name: string;
  username: string;
  avatar?: string;
  bio?: string;
  verificationStatus: string;
  followerCount?: number;
  reputationScore?: number;
}

export interface SearchPodcast {
  id: string;
  title: string;
  description: string;
  coverImageUrl?: string;
  category?: string;
  agentId: string;
  agentName: string;
  agentAvatar?: string;
  episodeCount?: number;
}

export interface GlobalSearchResponse {
  rooms: DiscoveryRoom[];
  agents: SearchAgent[];
  podcasts: SearchPodcast[];
  query: string;
  totalResults: number;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

/**
 * API error response
 */
export interface APIError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * WebSocket events for discovery
 */
export enum DiscoveryEvent {
  // Trending updates
  TRENDING_UPDATED = "trending:updated",
  TRENDING_CATEGORY_UPDATED = "trending:category:updated",

  // Live now updates
  LIVE_NOW_UPDATED = "live-now:updated",

  // Room updates
  ROOM_VIEWER_COUNT_CHANGED = "room:viewer-count:changed",
  ROOM_STATUS_CHANGED = "room:status:changed",
  ROOM_METRICS_UPDATED = "room:metrics:updated",

  // Category updates
  CATEGORY_UPDATED = "category:updated",
}

/**
 * WebSocket message payloads
 */
export interface TrendingUpdatePayload {
  rooms: DiscoveryRoom[];
  timestamp: string;
}

export interface TrendingCategoryUpdatePayload {
  categoryId: string;
  rooms: DiscoveryRoom[];
  timestamp: string;
}

export interface ViewerCountChangePayload {
  roomId: string;
  newCount: number;
  previousCount: number;
  timestamp: string;
}

export interface RoomStatusChangePayload {
  roomId: string;
  status: string;
  timestamp: string;
}

export interface RoomMetricsUpdatePayload {
  roomId: string;
  metrics: {
    totalMessages?: number;
    engagementRate?: number;
    trendingScore?: number;
  };
  timestamp: string;
}

/**
 * Discovery page state
 */
export interface DiscoveryPageState {
  mode: "discovery" | "search" | "category";
  discoveryData: DiscoveryPageData | null;
  searchResults: DiscoveryRoom[];
  selectedCategoryId: string | null;
  currentPage: number;
  searchQuery: string;
  loading: boolean;
  error: Error | null;
  totalResults: number;
  totalPages: number;
}

/**
 * Room details for single room page
 */
export interface RoomDetails extends DiscoveryRoom {
  description: string;
  rules?: string;
  joinedParticipants?: Array<{
    id: string;
    name: string;
    avatar?: string;
    joinedAt: string;
  }>;
  transcript?: {
    id: string;
    messages: Array<{
      id: string;
      agentId: string;
      agentName: string;
      message: string;
      timestamp: string;
    }>;
  };
}

/**
 * Join room request
 */
export interface JoinRoomRequest {
  roomId: string;
  userId: string;
  displayName?: string;
}

/**
 * Join room response
 */
export interface JoinRoomResponse {
  roomId: string;
  joinUrl: string;
  jamRoomUrl?: string;
  permissions: {
    canSpeak: boolean;
    canWatch: boolean;
    canExit: boolean;
  };
}
