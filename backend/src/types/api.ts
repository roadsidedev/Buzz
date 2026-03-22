/**
 * API Request/Response Type Definitions
 * Types for HTTP handlers and WebSocket events
 */

/**
 * Standard API response envelope
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

/**
 * Error response structure
 */
export interface ApiError {
  code: string;
  message: string;
  context?: Record<string, unknown>;
  statusCode: number;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
}

/**
 * Authentication request payload
 */
export interface RegisterRequest {
  name: string;
  erc8004Address: string;
  avatarUrl?: string;
}

/**
 * Auth token refresh request
 */
export interface RefreshTokenRequest {
  token: string;
}

/**
 * JWT token response
 */
export interface TokenResponse {
  token: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Room creation request
 */
export interface CreateRoomRequest {
  type: string; // known: debate, coding, research, trading, simulation, podcast, livestream, brainstorm — or any custom slug
  objective: string; // 10-500 chars
  spawnFee: number; // Cents USD, 25-1000
  invitedAgentIds?: string[];
}

/**
 * Agent join room request
 */
export interface JoinRoomRequest {
  roomId: string;
  agentId: string;
}

/**
 * Submit message request
 */
export interface SubmitMessageRequest {
  roomId: string;
  text: string; // 1-5000 chars
}

/**
 * Discovery filter options
 */
export interface DiscoveryFilter {
  type?: string; // known types or custom slug
  status?: "live" | "completed";
  sortBy?: "viewers" | "recent" | "trending";
  page?: number;
  pageSize?: number;
}

/**
 * Error codes for structured error handling
 */
export enum ErrorCode {
  // Auth errors
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
  TOKEN_EXPIRED = "TOKEN_EXPIRED",
  UNAUTHORIZED = "UNAUTHORIZED",
  INVALID_TOKEN = "INVALID_TOKEN",
  VERIFICATION_FAILED = "VERIFICATION_FAILED",

  // Validation errors
  VALIDATION_ERROR = "VALIDATION_ERROR",
  INVALID_INPUT = "INVALID_INPUT",
  SPAWN_FEE_TOO_LOW = "SPAWN_FEE_TOO_LOW",
  SPAWN_FEE_TOO_HIGH = "SPAWN_FEE_TOO_HIGH",
  OBJECTIVE_REQUIRED = "OBJECTIVE_REQUIRED",
  OBJECTIVE_TOO_SHORT = "OBJECTIVE_TOO_SHORT",
  OBJECTIVE_TOO_LONG = "OBJECTIVE_TOO_LONG",

  // Room errors
  ROOM_NOT_FOUND = "ROOM_NOT_FOUND",
  ROOM_ALREADY_LIVE = "ROOM_ALREADY_LIVE",
  ROOM_CLOSED = "ROOM_CLOSED",
  CANNOT_JOIN_ROOM = "CANNOT_JOIN_ROOM",
  NOT_ROOM_HOST = "NOT_ROOM_HOST",

  // Agent errors
  AGENT_NOT_FOUND = "AGENT_NOT_FOUND",
  AGENT_NOT_VERIFIED = "AGENT_NOT_VERIFIED",
  AGENT_SUSPENDED = "AGENT_SUSPENDED",

  // Payment errors
  PAYMENT_FAILED = "PAYMENT_FAILED",
  INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE",
  PAYMENT_PROCESSING = "PAYMENT_PROCESSING",

  // Rate limit errors
  TOO_MANY_REQUESTS = "TOO_MANY_REQUESTS",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",

  // Server errors
  INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
}
