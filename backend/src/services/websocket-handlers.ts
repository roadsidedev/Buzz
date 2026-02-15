/**
 * WebSocket Handlers for Real-Time Discovery Updates
 * Manages broadcasting of trending, viewer count, and room status changes
 */

import { Server as SocketIOServer, Socket } from "socket.io";
import { logger } from "../utils/logger.js";
import type { TrendingService } from "./trending-service.js";
import type { CacheService } from "./cache-service.js";

/**
 * Events broadcasted to clients
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

  // Health
  HEALTH_CHECK = "health:check",
}

/**
 * Subscription management for clients
 */
interface ClientSubscriptions {
  trendingGlobal: boolean;
  trendingCategories: Set<string>;
  liveNow: boolean;
  roomMetrics: Set<string>;
}

/**
 * WebSocket Discovery Handler
 * Manages real-time updates for discovery features
 */
export class WebSocketDiscoveryHandler {
  private clientSubscriptions = new Map<string, ClientSubscriptions>();

  constructor(
    private io: SocketIOServer,
    private trendingService: TrendingService,
    private cache: CacheService
  ) {
    this.setupEventHandlers();
  }

  /**
   * Initialize WebSocket event handlers
   */
  private setupEventHandlers(): void {
    this.io.on("connection", (socket: Socket) => {
      logger.debug("Client connected to discovery namespace", {
        socketId: socket.id,
      });

      // Initialize client subscriptions
      this.clientSubscriptions.set(socket.id, {
        trendingGlobal: false,
        trendingCategories: new Set(),
        liveNow: false,
        roomMetrics: new Set(),
      });

      // Subscribe to trending
      socket.on("subscribe:trending:global", () => {
        this.subscribeTrendingGlobal(socket);
      });

      socket.on("subscribe:trending:category", (categoryId: string) => {
        this.subscribeTrendingCategory(socket, categoryId);
      });

      // Subscribe to live now
      socket.on("subscribe:live-now", () => {
        this.subscribeLiveNow(socket);
      });

      // Subscribe to room metrics
      socket.on("subscribe:room:metrics", (roomId: string) => {
        this.subscribeRoomMetrics(socket, roomId);
      });

      // Unsubscribe handlers
      socket.on("unsubscribe:trending:global", () => {
        this.unsubscribeTrendingGlobal(socket);
      });

      socket.on("unsubscribe:trending:category", (categoryId: string) => {
        this.unsubscribeTrendingCategory(socket, categoryId);
      });

      socket.on("unsubscribe:live-now", () => {
        this.unsubscribeLiveNow(socket);
      });

      socket.on("unsubscribe:room:metrics", (roomId: string) => {
        this.unsubscribeRoomMetrics(socket, roomId);
      });

      // Health check
      socket.on("ping", () => {
        socket.emit("pong");
      });

      // Disconnect handler
      socket.on("disconnect", () => {
        this.handleDisconnect(socket);
      });
    });

    logger.info("WebSocket discovery handlers initialized");
  }

  /**
   * Subscribe client to global trending updates
   */
  private subscribeTrendingGlobal(socket: Socket): void {
    const subs = this.clientSubscriptions.get(socket.id);
    if (!subs) return;

    subs.trendingGlobal = true;
    socket.join("trending:global");
    logger.debug("Client subscribed to global trending", {
      socketId: socket.id,
    });

    // Send initial data
    this.sendInitialTrending(socket);
  }

  /**
   * Subscribe client to category trending updates
   */
  private subscribeTrendingCategory(socket: Socket, categoryId: string): void {
    const subs = this.clientSubscriptions.get(socket.id);
    if (!subs) return;

    subs.trendingCategories.add(categoryId);
    socket.join(`trending:category:${categoryId}`);
    logger.debug("Client subscribed to category trending", {
      socketId: socket.id,
      categoryId,
    });

    // Send initial data
    this.sendInitialTrendingCategory(socket, categoryId);
  }

  /**
   * Subscribe client to live now updates
   */
  private subscribeLiveNow(socket: Socket): void {
    const subs = this.clientSubscriptions.get(socket.id);
    if (!subs) return;

    subs.liveNow = true;
    socket.join("live-now");
    logger.debug("Client subscribed to live now", { socketId: socket.id });

    // Send initial data
    this.sendInitialLiveNow(socket);
  }

  /**
   * Subscribe client to specific room metrics
   */
  private subscribeRoomMetrics(socket: Socket, roomId: string): void {
    const subs = this.clientSubscriptions.get(socket.id);
    if (!subs) return;

    subs.roomMetrics.add(roomId);
    socket.join(`room:${roomId}:metrics`);
    logger.debug("Client subscribed to room metrics", {
      socketId: socket.id,
      roomId,
    });
  }

  /**
   * Unsubscribe from global trending
   */
  private unsubscribeTrendingGlobal(socket: Socket): void {
    const subs = this.clientSubscriptions.get(socket.id);
    if (!subs) return;

    subs.trendingGlobal = false;
    socket.leave("trending:global");
  }

  /**
   * Unsubscribe from category trending
   */
  private unsubscribeTrendingCategory(
    socket: Socket,
    categoryId: string
  ): void {
    const subs = this.clientSubscriptions.get(socket.id);
    if (!subs) return;

    subs.trendingCategories.delete(categoryId);
    socket.leave(`trending:category:${categoryId}`);
  }

  /**
   * Unsubscribe from live now
   */
  private unsubscribeLiveNow(socket: Socket): void {
    const subs = this.clientSubscriptions.get(socket.id);
    if (!subs) return;

    subs.liveNow = false;
    socket.leave("live-now");
  }

  /**
   * Unsubscribe from room metrics
   */
  private unsubscribeRoomMetrics(socket: Socket, roomId: string): void {
    const subs = this.clientSubscriptions.get(socket.id);
    if (!subs) return;

    subs.roomMetrics.delete(roomId);
    socket.leave(`room:${roomId}:metrics`);
  }

  /**
   * Handle client disconnect
   */
  private handleDisconnect(socket: Socket): void {
    this.clientSubscriptions.delete(socket.id);
    logger.debug("Client disconnected from discovery", { socketId: socket.id });
  }

  /**
   * Send initial trending data to client
   */
  private async sendInitialTrending(socket: Socket): Promise<void> {
    try {
      const trending = await this.trendingService.getTrendingCached(20);
      socket.emit(DiscoveryEvent.TRENDING_UPDATED, {
        rooms: trending,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      logger.error("Failed to send initial trending", { error: err });
    }
  }

  /**
   * Send initial trending category data to client
   */
  private async sendInitialTrendingCategory(
    socket: Socket,
    categoryId: string
  ): Promise<void> {
    try {
      const trending = await this.trendingService.getTrendingCached(
        20,
        categoryId
      );
      socket.emit(`${DiscoveryEvent.TRENDING_CATEGORY_UPDATED}:${categoryId}`, {
        rooms: trending,
        categoryId,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      logger.error("Failed to send initial trending category", { error: err });
    }
  }

  /**
   * Send initial live now data to client
   */
  private async sendInitialLiveNow(socket: Socket): Promise<void> {
    try {
      // This would typically use DiscoveryService
      // For now, we can fetch from trending
      const liveNow = await this.trendingService.getTrendingCached(20);
      socket.emit(DiscoveryEvent.LIVE_NOW_UPDATED, {
        rooms: liveNow,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      logger.error("Failed to send initial live now", { error: err });
    }
  }

  /**
   * Broadcast trending update to all subscribed clients
   * Called every 5 minutes or when cache is invalidated
   */
  async broadcastTrendingUpdate(): Promise<void> {
    try {
      const trending = await this.trendingService.getTrendingCached(20);
      this.io.to("trending:global").emit(DiscoveryEvent.TRENDING_UPDATED, {
        rooms: trending,
        timestamp: new Date().toISOString(),
      });
      logger.debug("Trending update broadcasted", { count: trending.length });
    } catch (err) {
      logger.error("Failed to broadcast trending update", { error: err });
    }
  }

  /**
   * Broadcast trending update for specific category
   */
  async broadcastTrendingCategoryUpdate(categoryId: string): Promise<void> {
    try {
      const trending = await this.trendingService.getTrendingCached(
        20,
        categoryId
      );
      this.io
        .to(`trending:category:${categoryId}`)
        .emit(`${DiscoveryEvent.TRENDING_CATEGORY_UPDATED}:${categoryId}`, {
          rooms: trending,
          categoryId,
          timestamp: new Date().toISOString(),
        });
      logger.debug("Category trending update broadcasted", {
        categoryId,
        count: trending.length,
      });
    } catch (err) {
      logger.error(
        "Failed to broadcast category trending update",
        { error: err, categoryId }
      );
    }
  }

  /**
   * Broadcast viewer count change for a room
   */
  broadcastViewerCountChange(
    roomId: string,
    newCount: number,
    previousCount: number
  ): void {
    this.io.to(`room:${roomId}:metrics`).emit(
      DiscoveryEvent.ROOM_VIEWER_COUNT_CHANGED,
      {
        roomId,
        newCount,
        previousCount,
        timestamp: new Date().toISOString(),
      }
    );

    // Also broadcast to live-now subscribers since viewer count affects trending
    this.io.emit(DiscoveryEvent.LIVE_NOW_UPDATED, {
      roomId,
      viewerCount: newCount,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast room status change
   */
  broadcastRoomStatusChange(roomId: string, newStatus: string): void {
    this.io.to(`room:${roomId}:metrics`).emit(
      DiscoveryEvent.ROOM_STATUS_CHANGED,
      {
        roomId,
        status: newStatus,
        timestamp: new Date().toISOString(),
      }
    );

    // If room ended, remove from live-now
    if (newStatus === "completed" || newStatus === "archived") {
      this.io.emit(DiscoveryEvent.LIVE_NOW_UPDATED, {
        roomId,
        status: newStatus,
        removed: true,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Broadcast room engagement metrics update
   */
  broadcastRoomMetricsUpdate(
    roomId: string,
    metrics: {
      totalMessages?: number;
      totalLikes?: number;
      engagementRate?: number;
      trendingScore?: number;
    }
  ): void {
    this.io.to(`room:${roomId}:metrics`).emit(
      DiscoveryEvent.ROOM_METRICS_UPDATED,
      {
        roomId,
        metrics,
        timestamp: new Date().toISOString(),
      }
    );
  }

  /**
   * Broadcast category update
   */
  broadcastCategoryUpdate(categoryId: string): void {
    this.io.emit(DiscoveryEvent.CATEGORY_UPDATED, {
      categoryId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get statistics about connected clients
   */
  getStats(): {
    connectedClients: number;
    trendingSubscribers: number;
    liveNowSubscribers: number;
    totalRoomSubscriptions: number;
  } {
    let trendingSubscribers = 0;
    let liveNowSubscribers = 0;
    let totalRoomSubscriptions = 0;

    for (const subs of this.clientSubscriptions.values()) {
      if (subs.trendingGlobal) trendingSubscribers++;
      if (subs.liveNow) liveNowSubscribers++;
      totalRoomSubscriptions += subs.roomMetrics.size;
    }

    return {
      connectedClients: this.clientSubscriptions.size,
      trendingSubscribers,
      liveNowSubscribers,
      totalRoomSubscriptions,
    };
  }
}

/**
 * Factory: Create WebSocket discovery handler
 */
export function createWebSocketDiscoveryHandler(
  io: SocketIOServer,
  trendingService: TrendingService,
  cache: CacheService
): WebSocketDiscoveryHandler {
  return new WebSocketDiscoveryHandler(io, trendingService, cache);
}
