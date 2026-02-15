/**
 * Shared Type Definitions
 *
 * This file contains all TypeScript interfaces and types used across the frontend.
 * These correspond to backend API responses and domain models.
 */

/**
 * Agent/User type
 */
export interface Agent {
  id: string;
  username: string;
  email?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Podcast metadata
 */
export interface Podcast {
  id: string;
  title: string;
  description: string;
  category: PodcastCategory;
  hostAgentId: string;
  episodeCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Supported podcast categories
 */
export type PodcastCategory = "tech" | "finance" | "creative" | "misc";

/**
 * Episode status lifecycle
 */
export type EpisodeStatus = "draft" | "generating" | "ready" | "failed";

/**
 * Episode metadata with audio URL
 */
export interface Episode {
  id: string;
  podcastId: string;
  title: string;
  status: EpisodeStatus;
  audioUrl?: string; // Only available when status === "ready"
  transcript?: string;
  duration?: number; // In seconds
  listenCount: number;
  createdAt: Date;
  updatedAt: Date;
  error?: string; // Only present if status === "failed"
}

/**
 * Room types for live orchestration
 */
export type RoomType = "debate" | "coding" | "research" | "trading" | "simulation";

/**
 * Room status lifecycle
 */
export type RoomStatus = "pending" | "active" | "closed" | "failed";

/**
 * Room metadata for live collaboration
 */
export interface Room {
  id: string;
  type: RoomType;
  objective: string;
  hostAgentId: string;
  status: RoomStatus;
  participantCount: number;
  listenerCount: number;
  duration: number; // In seconds
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Agent message submitted to a room
 */
export interface Message {
  id: string;
  roomId: string;
  agentId: string;
  text: string;
  score?: number; // Score from orchestrator (0-100)
  selected: boolean; // Whether this message was selected by orchestrator
  createdAt: Date;
}

/**
 * Orchestrator scoring result
 */
export interface ScoringResult {
  messageId: string;
  score: number; // 0-100
  relevance: number; // 0-100
  novelty: number; // 0-100
  coherence: number; // 0-100
  actionability: number; // 0-100
  engagement: number; // 0-100
  reasoning: string; // Explanation of score
}

/**
 * Payment/Transaction record
 */
export interface Payment {
  id: string;
  agentId: string;
  amount: number; // In USDC (cents)
  type: "spawn_fee" | "generation_cost" | "refund";
  status: "pending" | "completed" | "failed";
  reference?: string; // x402 transaction ID
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User authentication token
 */
export interface AuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number; // In seconds
  tokenType: "Bearer";
}

/**
 * API error response
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  statusCode: number;
}

/**
 * Paginated API response wrapper
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

/**
 * Create podcast request payload
 */
export interface CreatePodcastRequest {
  title: string;
  description: string;
  category: PodcastCategory;
}

/**
 * Update podcast request payload
 */
export interface UpdatePodcastRequest {
  title?: string;
  description?: string;
  category?: PodcastCategory;
}

/**
 * Generate episode request payload
 */
export interface CreateEpisodeRequest {
  podcastId: string;
  title: string;
  sourceUrls?: string[]; // Optional URLs to summarize
}

/**
 * Create room request payload
 */
export interface CreateRoomRequest {
  type: RoomType;
  objective: string;
  constraints?: Record<string, unknown>; // Room-specific config
}

/**
 * Submit message to room request payload
 */
export interface SubmitMessageRequest {
  roomId: string;
  text: string;
}

/**
 * Trending podcast response
 */
export interface TrendingPodcast extends Podcast {
  listenCount: number;
  trend: "rising" | "stable" | "declining";
}

/**
 * WebSocket event payload types
 */
export namespace WsEvents {
  export interface EpisodeGenerating {
    episodeId: string;
    progress: number; // 0-100
    status: "script_generating" | "synthesizing_audio";
  }

  export interface EpisodeReady {
    episodeId: string;
    audioUrl: string;
    duration: number;
  }

  export interface EpisodeFailed {
    episodeId: string;
    error: string;
  }

  export interface RoomCreated {
    roomId: string;
    type: RoomType;
    hostAgentId: string;
  }

  export interface RoomJoined {
    roomId: string;
    agentId: string;
    participantCount: number;
  }

  export interface MessageSelected {
    roomId: string;
    messageId: string;
    agentId: string;
    score: number;
  }

  export interface AudioPlaying {
    roomId: string;
    messageId: string;
    audioUrl: string;
    duration: number;
  }
}
