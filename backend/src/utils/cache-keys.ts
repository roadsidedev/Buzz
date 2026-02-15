/**
 * Cache Key Strategies
 * Centralized definitions of all cache keys and their TTLs
 */

export const CACHE_KEYS = {
  // Trending
  TRENDING_GLOBAL: "trending:global",
  TRENDING_CATEGORY: (categoryId: string) => `trending:category:${categoryId}`,

  // Live now
  LIVE_NOW: (page: number = 1) => `live-now:page:${page}`,

  // Search
  SEARCH: (query: string, page: number = 1) =>
    `search:${query.toLowerCase()}:${page}`,

  // Categories
  CATEGORIES_LIST: "categories:list",
  CATEGORY: (categoryId: string) => `category:${categoryId}`,

  // Room details
  ROOM: (roomId: string) => `room:${roomId}`,
  ROOM_PARTICIPANTS: (roomId: string) => `room:${roomId}:participants`,

  // Cache health
  HEALTH: "cache:health",
} as const;

export const CACHE_TTL = {
  // 5 minutes - trending changes slowly
  TRENDING: 300,

  // 1 minute - live now changes quickly
  LIVE_NOW: 60,

  // 5 minutes - search results don't change often
  SEARCH: 300,

  // 1 hour - categories rarely change
  CATEGORIES: 3600,

  // 2 minutes - room details update regularly
  ROOM: 120,

  // 1 minute - participant list changes frequently
  PARTICIPANTS: 60,

  // 5 seconds - health check cached briefly
  HEALTH: 5,
} as const;

/**
 * Type-safe cache key builder
 */
export class CacheKeyBuilder {
  /**
   * Build a trending cache key with optional category filter
   */
  static trending(categoryId?: string): string {
    if (categoryId) {
      return CACHE_KEYS.TRENDING_CATEGORY(categoryId);
    }
    return CACHE_KEYS.TRENDING_GLOBAL;
  }

  /**
   * Build a live now cache key for pagination
   */
  static liveNow(page: number = 1): string {
    return CACHE_KEYS.LIVE_NOW(page);
  }

  /**
   * Build a search cache key
   */
  static search(query: string, page: number = 1): string {
    return CACHE_KEYS.SEARCH(query, page);
  }

  /**
   * Build a room cache key
   */
  static room(roomId: string): string {
    return CACHE_KEYS.ROOM(roomId);
  }

  /**
   * Build a room participants cache key
   */
  static roomParticipants(roomId: string): string {
    return CACHE_KEYS.ROOM_PARTICIPANTS(roomId);
  }

  /**
   * Get all cache patterns for bulk invalidation
   */
  static getInvalidationPatterns(): Record<string, string> {
    return {
      trending: "trending:*",
      liveNow: "live-now:*",
      search: "search:*",
      rooms: "room:*",
      categories: "categories:*",
    };
  }
}

/**
 * Cache invalidation rules
 * Defines which caches to clear when specific events occur
 */
export const INVALIDATION_RULES = {
  // When a room starts, invalidate:
  ROOM_STARTED: [
    "trending:*",
    "live-now:*",
    "categories:*",
  ],

  // When a room ends, invalidate:
  ROOM_ENDED: [
    "trending:*",
    "live-now:*",
  ],

  // When room metrics update, invalidate:
  ROOM_METRICS_UPDATED: [
    "trending:*",
    (roomId: string) => `room:${roomId}`,
    (roomId: string) => `room:${roomId}:participants`,
  ],

  // When viewer count changes, invalidate:
  VIEWER_COUNT_CHANGED: [
    "trending:*",
    "live-now:*",
  ],

  // When search is performed, cache the result for 5 min:
  SEARCH_PERFORMED: (query: string, page: number = 1) => [
    CACHE_KEYS.SEARCH(query, page),
  ],

  // When category changes, invalidate:
  CATEGORY_UPDATED: (categoryId: string) => [
    CACHE_KEYS.TRENDING_CATEGORY(categoryId),
    CACHE_KEYS.CATEGORY(categoryId),
  ],
} as const;
