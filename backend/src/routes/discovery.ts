/**
 * Discovery Routes
 * GET /discovery - Discovery page
 * GET /discovery/live-now - Live rooms paginated
 * GET /discovery/trending - Trending rooms
 * GET /discovery/categories - All categories
 * GET /discovery/categories/:id - Rooms by category
 * GET /discovery/search - Search rooms
 * GET /room/:id - Room details
 * POST /room/:id/join - Join room
 */

import { Router, Request, Response } from "express";
import type { DiscoveryService } from "../services/discovery-service.js";
import type { TrendingService } from "../services/trending-service.js";
import { logger } from "../utils/logger.js";

export function createDiscoveryRoutes(
  discoveryService: DiscoveryService,
  trendingService: TrendingService
): Router {
  const router = Router();

  /**
   * GET /api/discovery
   * Main discovery page: Live now, trending, categories
   */
  router.get("/discovery", async (req: Request, res: Response) => {
    try {
      logger.info("GET /api/discovery");

      const [liveNow, trending, categories] = await Promise.all([
        discoveryService.getLiveNow(1, 6), // First 6 live rooms
        discoveryService.getTrendingRooms(10), // Top 10 trending
        discoveryService.getCategories(),
      ]);

      res.json({
        success: true,
        data: {
          liveNow: liveNow.data,
          trending,
          categories,
        },
      });
    } catch (err) {
      logger.error("GET /api/discovery failed", { error: err });
      res.status(500).json({
        success: false,
        error: "Failed to fetch discovery page",
      });
    }
  });

  /**
   * GET /api/discovery/live-now
   * Paginated live rooms
   */
  router.get("/discovery/live-now", async (req: Request, res: Response) => {
    try {
      const { page = 1, limit = 20 } = req.query;

      // Validate query params
      const pageNum = Math.max(1, parseInt(page as string) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20));

      logger.info("GET /api/discovery/live-now", {
        page: pageNum,
        limit: limitNum,
      });

      const result = await discoveryService.getLiveNow(pageNum, limitNum);

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (err) {
      logger.error("GET /api/discovery/live-now failed", { error: err });
      res.status(500).json({
        success: false,
        error: "Failed to fetch live rooms",
      });
    }
  });

  /**
   * GET /api/discovery/trending
   * Top trending rooms
   */
  router.get("/discovery/trending", async (req: Request, res: Response) => {
    try {
      const { limit = 10 } = req.query;
      const limitNum = Math.min(50, Math.max(1, parseInt(limit as string) || 10));

      logger.info("GET /api/discovery/trending", { limit: limitNum });

      const rooms = await discoveryService.getTrendingRooms(limitNum);

      res.json({
        success: true,
        data: rooms,
      });
    } catch (err) {
      logger.error("GET /api/discovery/trending failed", { error: err });
      res.status(500).json({
        success: false,
        error: "Failed to fetch trending",
      });
    }
  });

  /**
   * GET /api/discovery/categories
   * All categories
   */
  router.get("/discovery/categories", async (req: Request, res: Response) => {
    try {
      logger.info("GET /api/discovery/categories");

      const categories = await discoveryService.getCategories();

      res.json({
        success: true,
        data: categories,
      });
    } catch (err) {
      logger.error("GET /api/discovery/categories failed", { error: err });
      res.status(500).json({
        success: false,
        error: "Failed to fetch categories",
      });
    }
  });

  /**
   * GET /api/discovery/categories/:id
   * Rooms by category
   */
  router.get(
    "/discovery/categories/:id",
    async (req: Request, res: Response) => {
      try {
        const { id: categoryId } = req.params;
        const { page = 1, limit = 20 } = req.query;

        const pageNum = Math.max(1, parseInt(page as string) || 1);
        const limitNum = Math.min(
          100,
          Math.max(1, parseInt(limit as string) || 20)
        );

        logger.info("GET /api/discovery/categories/:id", {
          categoryId,
          page: pageNum,
        });

        const result = await discoveryService.getByCategory(
          categoryId,
          pageNum,
          limitNum
        );

        res.json({
          success: true,
          data: result.data,
          pagination: result.pagination,
        });
      } catch (err) {
        logger.error("GET /api/discovery/categories/:id failed", {
          error: err,
        });
        res.status(404).json({
          success: false,
          error: "Category not found",
        });
      }
    }
  );

  /**
   * GET /api/discovery/search
   * Search rooms by query
   */
  router.get("/discovery/search", async (req: Request, res: Response) => {
    try {
      const { q: query, categoryId, status, page = 1, limit = 20 } = req.query;

      // Validate query param
      if (!query || typeof query !== "string") {
        return res.status(400).json({
          success: false,
          error: "Query parameter 'q' is required",
        });
      }

      const pageNum = Math.max(1, parseInt(page as string) || 1);
      const limitNum = Math.min(
        100,
        Math.max(1, parseInt(limit as string) || 20)
      );

      logger.info("GET /api/discovery/search", { query, page: pageNum });

      const filters = {
        categoryId: categoryId ? (categoryId as string) : undefined,
        status: status ? (status as string) : undefined,
      };

      const result = await discoveryService.searchRooms(
        query,
        filters,
        pageNum,
        limitNum
      );

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (err) {
      logger.error("GET /api/discovery/search failed", { error: err });
      res.status(400).json({
        success: false,
        error: "Search failed",
      });
    }
  });

  /**
   * GET /api/room/:id
   * Room details + participants
   */
  router.get("/room/:id", async (req: Request, res: Response) => {
    try {
      const { id: roomId } = req.params;

      logger.info("GET /api/room/:id", { roomId });

      const room = await discoveryService.getRoomDetails(roomId);

      res.json({
        success: true,
        data: room,
      });
    } catch (err) {
      logger.error("GET /api/room/:id failed", { error: err });
      res.status(404).json({
        success: false,
        error: "Room not found",
      });
    }
  });

  /**
   * POST /api/room/:id/join
   * Join a room
   */
  router.post("/room/:id/join", async (req: Request, res: Response) => {
    try {
      const { id: roomId } = req.params;
      const agentId = (req as any).user?.id;

      if (!agentId) {
        return res.status(401).json({
          success: false,
          error: "Not authenticated",
        });
      }

      logger.info("POST /api/room/:id/join", { roomId, agentId });

      // Check if already a participant
      const db = (req as any).db;
      const existing = await db.query(
        `SELECT id FROM room_participant 
         WHERE room_id = $1 AND agent_id = $2 AND left_at IS NULL`,
        [roomId, agentId]
      );

      if (existing.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error: "Already in room",
        });
      }

      // Add participant
      await db.query(
        `INSERT INTO room_participant (room_id, agent_id) 
         VALUES ($1, $2)`,
        [roomId, agentId]
      );

      // Get updated room details
      const room = await discoveryService.getRoomDetails(roomId);

      res.json({
        success: true,
        message: "Joined room",
        data: room,
      });
    } catch (err) {
      logger.error("POST /api/room/:id/join failed", { error: err });
      res.status(400).json({
        success: false,
        error: "Failed to join room",
      });
    }
  });

  return router;
}
