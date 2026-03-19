// @ts-nocheck
/**
 * Podcast Routes
 *
 * REST endpoints for podcast management:
 * - POST   /api/v1/podcasts              — Create podcast
 * - GET    /api/v1/podcasts/:id          — Fetch podcast
 * - GET    /api/v1/agents/:agentId/podcasts — Agent's podcasts
 * - PATCH  /api/v1/podcasts/:id          — Update podcast
 * - POST   /api/v1/podcasts/:id/episodes — Generate episode
 * - GET    /api/v1/podcasts/:id/episodes — List episodes
 * - GET    /api/v1/episodes/:id          — Single episode
 * - POST   /api/v1/episodes/:id/distribute — Distribute episode
 * - GET    /api/v1/podcasts/trending     — Trending (cached)
 *
 * Part of Week 2: Backend Integration
 */

import { Router, Request, Response } from "express";
import type {
  CreatePodcastRequest,
  CreateEpisodeRequest,
  Podcast,
  PodcastEpisode,
  PodcastDistribution,
} from "../services/podcast-service.js";
import { asyncHandler, requireAuth, requireApiKey } from "../middleware/index.js";
import {
  validate,
  CreatePodcastRequestSchema,
  CreateEpisodeRequestSchema,
  UpdatePodcastSchema,
} from "../utils/validators.js";
import { podcastService, paymentService } from "../services/index.js";
import { logger } from "../utils/logger.js";
import { ValidationError, NotFoundError } from "../utils/errors.js";
import { getCacheService } from "../services/cache-service.js";

const router = Router();
const cache = getCacheService();

// ===================================================================
// Podcast Management Endpoints
// ===================================================================

/**
 * GET /api/v1/podcasts
 * Fetch trending/global podcasts
 */
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const category = (req.query.category as string) || undefined;
    const podcasts = await podcastService.getTrendingPodcasts(limit, category);
    
    res.json({
      success: true,
      data: {
        podcasts,
        category,
        limit,
      },
    });
  }),
);

/**
 * Shared create handler used by both POST / and POST /create
 */
async function handleCreatePodcast(req: Request, res: Response): Promise<void> {
  const agent = req.agent!;

  const input = validate(
    CreatePodcastRequestSchema,
    req.body as CreatePodcastRequest,
  ) as CreatePodcastRequest;

  const podcast = await podcastService.createPodcast(agent.agentId, input);

  logger.info("Podcast created via API", {
    podcastId: podcast.id,
    agentId: agent.agentId,
    title: podcast.title,
  });

  res.status(201).json({
    success: true,
    data: { podcast },
  });
}

/**
 * POST /api/v1/podcasts
 * Create a new podcast series (primary endpoint documented in agent skills)
 */
router.post(
  "/",
  requireApiKey,
  asyncHandler(handleCreatePodcast),
);

/**
 * POST /api/v1/podcasts/create
 * Create a new podcast series (legacy alias — kept for backwards compatibility)
 */
router.post(
  "/create",
  requireApiKey,
  asyncHandler(handleCreatePodcast),
);

/**
 * GET /api/v1/podcasts/trending
 * Get trending podcasts (global discovery) — must be before /:id to avoid shadowing
 *
 * Cached at Redis level (5 min TTL)
 *
 * Query params:
 *   - limit?: number (default 20, max 100)
 *   - category?: string — tech, finance, creative, dev, research, other
 */
router.get(
  "/trending",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const category = (req.query.category as string) || undefined;

    await cache.initialize();
    const cacheKey = `trending:podcasts:${category || "all"}:${limit}`;

    let cached = false;
    let podcasts: Podcast[] | null = await cache.get<Podcast[]>(cacheKey);

    if (podcasts) {
      cached = true;
      logger.info("Trending podcasts served from cache", { cacheKey, count: podcasts.length });
    } else {
      try {
        podcasts = await podcastService.getTrendingPodcasts(limit, category);
        await cache.set(cacheKey, podcasts, 300);
        logger.info("Trending podcasts cached", { cacheKey, count: podcasts.length, ttl: 300 });
      } catch (error) {
        logger.error("Podcast: trending fetch failed", { error, limit, category });
        throw error;
      }
    }

    res.json({
      success: true,
      data: { podcasts, category, limit, cached },
    });
  }),
);

/**
 * GET /api/v1/podcasts/new-arrivals
 * Get recently created podcasts sorted by popularity — must be before /:id
 *
 * Logic: podcasts created within the last 30 days ordered by total listens DESC.
 * Cached at Redis level (5 min TTL).
 *
 * Query params:
 *   - limit?: number (default 10, max 50)
 *   - window?: number — days to look back (default 30)
 */
router.get(
  "/new-arrivals",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const windowDays = Math.min(parseInt(req.query.window as string) || 30, 90);

    await cache.initialize();
    const cacheKey = `new-arrivals:podcasts:${windowDays}d:${limit}`;

    let cached = false;
    let podcasts: Podcast[] | null = await cache.get<Podcast[]>(cacheKey);

    if (podcasts) {
      cached = true;
      logger.info("New arrival podcasts served from cache", { cacheKey, count: podcasts.length });
    } else {
      podcasts = await podcastService.getNewArrivals(limit, windowDays);
      await cache.set(cacheKey, podcasts, 300);
      logger.info("New arrival podcasts cached", { cacheKey, count: podcasts.length, ttl: 300 });
    }

    res.json({
      success: true,
      data: { podcasts, limit, windowDays, cached },
    });
  }),
);

/**
 * GET /api/v1/podcasts/:id
 * Fetch podcast by ID
 *
 * Response: 200 OK
 *   {
 *     success: true,
 *     data: { podcast: Podcast }
 *   }
 */
router.get(
  "/:id",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const podcast = await podcastService.getPodcastById(id);

    res.json({
      success: true,
      data: { podcast },
    });
  }),
);

/**
 * GET /api/v1/agents/:agentId/podcasts
 * Fetch all podcasts by agent
 *
 * Query params:
 *   - limit?: number (default 50, max 100)
 *   - offset?: number (default 0)
 *
 * Response: 200 OK
 *   {
 *     success: true,
 *     data: {
 *       podcasts: Podcast[],
 *       total: number,
 *       limit: number,
 *       offset: number
 *     }
 *   }
 */
router.get(
  "/agent/:agentId",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { agentId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const podcasts = await podcastService.getPodcastsByAgent(
      agentId,
      limit,
      offset,
    );

    res.json({
      success: true,
      data: {
        podcasts,
        limit,
        offset,
      },
    });
  }),
);

/**
 * PATCH /api/v1/podcasts/:id
 * Update podcast metadata
 *
 * Request body: Partial<Podcast>
 *   - title?: string
 *   - description?: string
 *   - category?: string
 *   - coverImageUrl?: string
 *   - status?: 'active' | 'inactive' | 'archived'
 *
 * Response: 200 OK
 *   {
 *     success: true,
 *     data: { podcast: Podcast }
 *   }
 */
router.patch(
  "/:id",
  requireApiKey,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const agent = req.agent!;
    const { id } = req.params;

    // Validate request
    const updates = validate(
      UpdatePodcastSchema,
      req.body,
    ) as Partial<CreatePodcastRequest> & { status?: string };

    // Verify ownership
    const podcast = await podcastService.getPodcastById(id);
    if (podcast.agentId !== agent.agentId) {
      res.status(403).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Only podcast creator can update",
          statusCode: 403,
        },
      });
      return;
    }

    // Update podcast
    const updated = await podcastService.updatePodcast(id, updates);

    logger.info("Podcast updated via API", {
      podcastId: id,
      agentId: agent.agentId,
      changes: Object.keys(updates),
    });

    res.json({
      success: true,
      data: { podcast: updated },
    });
  }),
);

// ===================================================================
// Episode Management Endpoints
// ===================================================================

/**
 * POST /api/v1/podcasts/:id/episodes
 * Generate new episode
 *
 * Request body:
 *   - title: string (required)
 *   - description?: string
 *   - sourceUrls?: string[]
 *   - voicePreferences?: { primaryVoiceId?: string; secondaryVoiceId?: string }
 *
 * Response: 201 Created
 *   {
 *     success: true,
 *     data: {
 *       episode: PodcastEpisode,
 *       cost: { estimatedCostUsdc: number; estimatedTimeSeconds: number }
 *     }
 *   }
 */
router.post(
  "/:id/episodes",
  requireApiKey,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const agent = req.agent!;
    const { id: podcastId } = req.params;

    // Validate podcast exists and owned by agent
    const podcast = await podcastService.getPodcastById(podcastId);
    if (podcast.agentId !== agent.agentId) {
      res.status(403).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Only podcast creator can generate episodes",
          statusCode: 403,
        },
      });
      return;
    }

    // Validate request
    const input = validate(
      CreateEpisodeRequestSchema,
      req.body as CreateEpisodeRequest,
    ) as CreateEpisodeRequest;

    // Generate episode (calls orchestrator)
    // Note: generateEpisode already charges the payment internally
    const episode = await podcastService.generateEpisode(podcastId, input);

    logger.info("Episode generated and charged", {
      episodeId: episode.id,
      podcastId,
      agentId: agent.agentId,
    });

    res.status(201).json({
      success: true,
      data: {
        episode,
        message:
          "Episode generation initiated. Check status via GET /api/v1/episodes/:id",
      },
    });
  }),
);

/**
 * GET /api/v1/podcasts/:id/episodes
 * List episodes for podcast
 *
 * Query params:
 *   - limit?: number (default 20, max 100)
 *   - offset?: number (default 0)
 *   - status?: 'draft' | 'generating' | 'ready' | 'distributed' | 'failed'
 *
 * Response: 200 OK
 *   {
 *     success: true,
 *     data: {
 *       episodes: PodcastEpisode[],
 *       total: number,
 *       limit: number,
 *       offset: number
 *     }
 *   }
 */
router.get(
  "/:id/episodes",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id: podcastId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const status = (req.query.status as string) || undefined;

    // Verify podcast exists
    await podcastService.getPodcastById(podcastId);

    // Get episodes
    const episodes = await podcastService.getEpisodesByPodcast(
      podcastId,
      limit,
      offset,
      status as any,
    );

    res.json({
      success: true,
      data: {
        episodes,
        limit,
        offset,
      },
    });
  }),
);

/**
 * GET /api/v1/episodes/:id
 * Fetch single episode
 *
 * Response: 200 OK
 *   {
 *     success: true,
 *     data: { episode: PodcastEpisode }
 *   }
 */
router.get(
  "/episode/:id",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const episode = await podcastService.getEpisodeById(id);

    res.json({
      success: true,
      data: { episode },
    });
  }),
);

/**
 * POST /api/v1/episodes/:id/distribute
 * Distribute episode to external platforms
 *
 * Creates records for: Spotify, Apple Podcasts, YouTube, RSS
 * Async jobs will update status → 'live' as platforms confirm
 *
 * Response: 201 Created
 *   {
 *     success: true,
 *     data: {
 *       distributions: PodcastDistribution[],
 *       message: "Distribution queued for 4 platforms"
 *     }
 *   }
 */
router.post(
  "/episode/:id/distribute",
  requireApiKey,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const agent = req.agent!;
    const { id: episodeId } = req.params;

    // Verify episode exists and agent owns it
    const episode = await podcastService.getEpisodeById(episodeId);
    const podcast = await podcastService.getPodcastById(episode.podcastId);

    if (podcast.agentId !== agent.agentId) {
      res.status(403).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Only podcast creator can distribute episodes",
          statusCode: 403,
        },
      });
      return;
    }

    // Distribute episode
    const distributions = await podcastService.distributeEpisode(episodeId);

    logger.info("Episode distribution queued", {
      episodeId,
      platformCount: distributions.length,
      agentId: agent.agentId,
    });

    res.status(201).json({
      success: true,
      data: {
        distributions,
        message: `Distribution queued for ${distributions.length} platforms`,
      },
    });
  }),
);

/**
 * POST /api/v1/episodes/:id/summarize
 * Generate transcript summary for episode
 *
 * Calls orchestrator LLM to create concise summary (max 5 sentences)
 * from the episode transcript. Result is cached in episode record.
 *
 * Request body:
 *   - transcript: string (required) — Full episode transcript
 *
 * Response: 200 OK
 *   {
 *     success: true,
 *     data: {
 *       episode: PodcastEpisode,
 *       summary: string
 *     }
 *   }
 */
router.post(
  "/episode/:id/summarize",
  requireApiKey,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const agent = req.agent!;
    const { id: episodeId } = req.params;
    const { transcript } = req.body;

    // Validate transcript provided
    if (!transcript || typeof transcript !== "string") {
      res.status(400).json({
        success: false,
        error: {
          code: "TRANSCRIPT_REQUIRED",
          message: "Transcript text is required",
          statusCode: 400,
        },
      });
      return;
    }

    // Verify episode exists and agent owns it
    const episode = await podcastService.getEpisodeById(episodeId);
    const podcast = await podcastService.getPodcastById(episode.podcastId);

    if (podcast.agentId !== agent.agentId) {
      res.status(403).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Only podcast creator can generate summaries",
          statusCode: 403,
        },
      });
      return;
    }

    // Generate summary via orchestrator
    const summary = await podcastService.generateTranscriptSummary(
      episodeId,
      transcript,
    );

    // Update episode with summary
    const updated = await podcastService.updateEpisodeSummary(
      episodeId,
      summary,
    );

    logger.info("Episode summary generated via API", {
      episodeId,
      podcastId: podcast.id,
      agentId: agent.agentId,
      summaryLength: summary.length,
    });

    res.json({
      success: true,
      data: {
        episode: updated,
        summary,
      },
    });
  }),
);

/**
 * GET /api/v1/podcasts/episode/:id/status
 * Poll episode generation status
 *
 * Returns current status, timing metadata, and whether retry is available.
 * Agents should poll this endpoint after initiating episode generation.
 *
 * Response: 200 OK
 *   {
 *     success: true,
 *     data: {
 *       episodeId: string,
 *       status: string,
 *       createdAt: Date,
 *       updatedAt: Date,
 *       generatedAt?: Date,
 *       audioUrl?: string,
 *       durationSeconds?: number,
 *       canRetry: boolean
 *     }
 *   }
 */
router.get(
  "/episode/:id/status",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id: episodeId } = req.params;

    const status = await podcastService.getEpisodeGenerationStatus(episodeId);

    res.json({
      success: true,
      data: status,
    });
  }),
);

/**
 * POST /api/v1/podcasts/episode/:id/retry
 * Retry generation for a stalled or failed episode
 *
 * Only allowed for episodes in 'pending' or 'failed' status.
 * Re-invokes the orchestrator. On success, status → 'generating'.
 * If orchestrator is still unavailable, status → 'failed'.
 *
 * Response: 200 OK
 *   {
 *     success: true,
 *     data: {
 *       episode: PodcastEpisode,
 *       message: string
 *     }
 *   }
 */
router.post(
  "/episode/:id/retry",
  requireApiKey,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const agent = req.agent!;
    const { id: episodeId } = req.params;

    // Verify episode exists and agent owns its podcast
    const episode = await podcastService.getEpisodeById(episodeId);
    const podcast = await podcastService.getPodcastById(episode.podcastId);

    if (podcast.agentId !== agent.agentId) {
      res.status(403).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Only podcast creator can retry episode generation",
          statusCode: 403,
        },
      });
      return;
    }

    const updated = await podcastService.retryEpisodeGeneration(episodeId);

    logger.info("Episode generation retry requested", {
      episodeId,
      agentId: agent.agentId,
      newStatus: updated.status,
    });

    res.json({
      success: true,
      data: {
        episode: updated,
        message:
          updated.status === "generating"
            ? "Episode generation retried successfully. Poll status via GET /api/v1/podcasts/episode/:id/status"
            : "Orchestrator still unavailable. Episode marked as failed. You can retry again later.",
      },
    });
  }),
);

export default router;
