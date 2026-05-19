// @ts-nocheck
/**
 * Podcast Service
 *
 * Manages podcast series lifecycle:
 * - Creation and metadata management
 * - Episode generation via orchestrator
 * - Distribution to external platforms
 * - Subscription tracking
 * - Analytics aggregation
 *
 * Part of Phase 1: Strategic Pivot (ClawPod + Buzz integration)
 */

import { Pool, QueryResult } from "pg";
import { v4 as uuidv4 } from "uuid";
import logger from "@/utils/logger";
import {
  ValidationError,
  NotFoundError,
  PaymentError,
} from "@/utils/errors";
import { OrchestratorClient } from "@/services/orchestrator-client";
import { PaymentService } from "@/services/payment-service";
import { getTTSService } from "@/services/tts-service";
import { getAudioStorageService } from "@/services/audio-storage-service";

// ===================================================================
// Type Definitions
// ===================================================================

export interface CreatePodcastRequest {
  title: string;
  description?: string;
  category: string;
  coverImageUrl?: string;
}

export interface Podcast {
  id: string;
  agentId: string;
  title: string;
  description?: string;
  category: string;
  coverImageUrl?: string;
  status: "active" | "inactive" | "archived";
  createdAt: Date;
  updatedAt: Date;
  episodeCount?: number;
  latestEpisodeDate?: Date;
  totalListens?: number;
  audioUrl?: string;
  duration?: string;
  author?: string;
  authorAvatar?: string;
}

export interface CreateEpisodeRequest {
  title: string;
  description?: string;
  sourceUrls?: string[];
  format?: "monologue" | "dialogue";
  voicePreferences?: {
    primaryVoiceId?: string;
    secondaryVoiceId?: string;
  };
}

export interface PodcastEpisode {
  id: string;
  podcastId: string;
  title: string;
  description?: string;
  transcript?: string;
  audioUrl?: string;
  durationSeconds?: number;
  audioFormat: "mp3" | "ogg" | "wav";
  format: "monologue" | "dialogue";
  status: "draft" | "generating" | "ready" | "distributed" | "failed";
  generatedAt?: Date;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PodcastDistribution {
  id: string;
  episodeId: string;
  platform: "spotify" | "apple_podcasts" | "youtube" | "rss";
  platformEpisodeId?: string;
  platformUrl?: string;
  status: "pending" | "distributing" | "live" | "failed";
  errorMessage?: string;
  distributedAt?: Date;
}

export interface PodcastAnalytics {
  id: string;
  episodeId: string;
  totalListens: number;
  uniqueListeners: number;
  completionRate: number;
  averageListenTimeSeconds: number;
  replays: number;
  shares: number;
  comments: number;
  recordedAt: Date;
}

// ===================================================================
// Podcast Service Class
// ===================================================================

export class PodcastService {
  constructor(
    private db: Pool,
    private orchestrator: OrchestratorClient,
    private payment: PaymentService,
  ) {}

  /**
   * Create a new podcast series
   *
   * @param agentId - Agent creating the podcast
   * @param req - Podcast creation request
   * @returns Created podcast
   * @throws ValidationError if input invalid
   */
  async createPodcast(
    agentId: string,
    req: CreatePodcastRequest,
  ): Promise<Podcast> {
    // Validation
    if (!req.title || req.title.trim().length === 0) {
      throw new ValidationError("Podcast title required", {
        field: "title",
        code: "TITLE_REQUIRED",
      });
    }

    if (!req.category || req.category.trim().length === 0) {
      throw new ValidationError("Category required", {
        field: "category",
        code: "CATEGORY_REQUIRED",
      });
    }

    const validCategories = [
      "tech",
      "finance",
      "creative",
      "dev",
      "research",
      "other",
    ];
    if (!validCategories.includes(req.category.toLowerCase())) {
      throw new ValidationError("Invalid category", {
        field: "category",
        provided: req.category,
        valid: validCategories,
        code: "CATEGORY_INVALID",
      });
    }

    const podcastId = uuidv4();
    const now = new Date();

    try {
      const query = `
        INSERT INTO podcast (
          id, agent_id, title, description, category, 
          cover_image_url, status, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *;
      `;

      const result: QueryResult<any> = await this.db.query(query, [
        podcastId,
        agentId,
        req.title.trim(),
        req.description || null,
        req.category.toLowerCase(),
        req.coverImageUrl || null,
        "active",
        now,
        now,
      ]);

      const podcast = this._rowToPodcast(result.rows[0]);

      logger.info("Podcast created", {
        podcastId: podcast.id,
        agentId,
        title: podcast.title,
        category: podcast.category,
      });

      // SPAWN FEE — waived during trial (first 5 podcasts per agent are free)
      const FREE_PODCAST_TRIAL_LIMIT = 5;
      try {
        const countResult = await this.db.query<{ count: string }>(
          `SELECT COUNT(*)::int AS count FROM podcast WHERE agent_id = $1`,
          [agentId],
        );
        const totalCreated = Number(countResult.rows[0]?.count ?? 0);
        const isTrialPodcast = totalCreated <= FREE_PODCAST_TRIAL_LIMIT;

        if (!isTrialPodcast) {
          const agentRow = await this.db.query(
            `SELECT erc8004_address FROM agent WHERE id = $1`,
            [agentId],
          );
          const walletAddress: string | null =
            agentRow.rows[0]?.erc8004_address ?? null;
          if (walletAddress) {
            const payment = await this.payment.chargeSpawnFee(
              agentId,
              podcast.id,
              walletAddress,
            );
            await this.db.query(
              `UPDATE podcast SET spawn_fee_payment_id = $1 WHERE id = $2`,
              [payment.id, podcast.id],
            );
            logger.info("Podcast spawn fee charged", {
              podcastId: podcast.id,
              paymentId: payment.id,
            });
          } else {
            logger.warn("Podcast spawn fee skipped: no wallet on agent", {
              agentId,
            });
          }
        } else {
          logger.info("Trial period: podcast spawn fee waived", {
            agentId,
            totalCreated,
            trialLimit: FREE_PODCAST_TRIAL_LIMIT,
          });
        }
      } catch (feeErr) {
        // Non-blocking — podcast is returned regardless of fee outcome
        logger.error("Podcast spawn fee charge failed", {
          agentId,
          podcastId: podcast.id,
          error: feeErr instanceof Error ? feeErr.message : String(feeErr),
        });
      }

      return podcast;
    } catch (err) {
      logger.error("Failed to create podcast", {
        agentId,
        title: req.title,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  /**
   * Fetch podcasts by agent
   *
   * @param agentId - Agent ID
   * @param limit - Max results (default 50)
   * @param offset - Pagination offset (default 0)
   * @returns Array of podcasts with episode counts
   */
  async getPodcastsByAgent(
    agentId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<Podcast[]> {
    const query = `
      SELECT 
        p.*,
        a.username as author_name,
        a.avatar as author_avatar,
        COUNT(DISTINCT pe.id) as episode_count,
        MAX(pe.published_at) as latest_episode_date,
        COALESCE(SUM(pa.total_listens), 0) as total_listens
      FROM podcast p
      LEFT JOIN agent a ON p.agent_id = a.id
      LEFT JOIN podcast_episode pe ON p.id = pe.podcast_id
      LEFT JOIN podcast_analytics pa ON pe.id = pa.episode_id
      WHERE p.agent_id = $1
      GROUP BY p.id, a.id
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    try {
      const result: QueryResult<any> = await this.db.query(query, [
        agentId,
        limit,
        offset,
      ]);

      return result.rows.map((row) => this._rowToPodcast(row));
    } catch (err) {
      logger.error("Failed to fetch podcasts for agent", {
        agentId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  /**
   * Update podcast metadata
   *
   * @param podcastId - Podcast ID
   * @param updates - Fields to update (title, description, category, status, coverImageUrl)
   * @returns Updated podcast
   * @throws NotFoundError if podcast not found
   */
  async updatePodcast(
    podcastId: string,
    updates: Partial<CreatePodcastRequest> & { status?: string },
  ): Promise<Podcast> {
    // Build update query
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (updates.title !== undefined) {
      fields.push(`title = $${paramCount}`);
      values.push(updates.title.trim());
      paramCount++;
    }

    if (updates.description !== undefined) {
      fields.push(`description = $${paramCount}`);
      values.push(updates.description || null);
      paramCount++;
    }

    if (updates.category !== undefined) {
      fields.push(`category = $${paramCount}`);
      values.push(updates.category.toLowerCase());
      paramCount++;
    }

    if (updates.coverImageUrl !== undefined) {
      fields.push(`cover_image_url = $${paramCount}`);
      values.push(updates.coverImageUrl || null);
      paramCount++;
    }

    if ((updates as any).status !== undefined) {
      fields.push(`status = $${paramCount}`);
      values.push((updates as any).status);
      paramCount++;
    }

    fields.push(`updated_at = $${paramCount}`);
    values.push(new Date());

    values.push(podcastId);

    const query = `
      UPDATE podcast
      SET ${fields.join(", ")}
      WHERE id = $${paramCount + 1}
      RETURNING *;
    `;

    try {
      const result: QueryResult<any> = await this.db.query(query, values);

      if (result.rows.length === 0) {
        throw new NotFoundError("Podcast not found", {
          podcastId,
          code: "PODCAST_NOT_FOUND",
        });
      }

      // Need to fetch again to get joined fields
      return this.getPodcast(podcastId);
    } catch (err) {
      logger.error("Failed to update podcast", {
        podcastId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  /**
   * Get single podcast by ID
   *
   * @param podcastId - Podcast ID
   * @returns Podcast with stats
   * @throws NotFoundError if not found
   */
  /**
   * Alias for getPodcast for API consistency
   */
  async getPodcastById(podcastId: string): Promise<Podcast> {
    return this.getPodcast(podcastId);
  }

  async getPodcast(podcastId: string): Promise<Podcast> {
    const query = `
      SELECT 
        p.*,
        a.username as author_name,
        a.avatar as author_avatar,
        COUNT(DISTINCT pe.id) as episode_count,
        MAX(pe.published_at) as latest_episode_date,
        COALESCE(SUM(pa.total_listens), 0) as total_listens
      FROM podcast p
      LEFT JOIN agent a ON p.agent_id = a.id
      LEFT JOIN podcast_episode pe ON p.id = pe.podcast_id
      LEFT JOIN podcast_analytics pa ON pe.id = pa.episode_id
      WHERE p.id = $1
      GROUP BY p.id, a.id;
    `;

    try {
      const result: QueryResult<any> = await this.db.query(query, [
        podcastId,
      ]);

      if (result.rows.length === 0) {
        throw new NotFoundError("Podcast not found", {
          podcastId,
          code: "PODCAST_NOT_FOUND",
        });
      }

      return this._rowToPodcast(result.rows[0]);
    } catch (err) {
      logger.error("Failed to fetch podcast", {
        podcastId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  /**
   * Get episodes by podcast
   *
   * @param podcastId - Podcast ID
   * @param limit - Max results (default 20)
   * @param offset - Pagination offset (default 0)
   * @param status - Optional status filter
   * @returns Array of episodes
   */
  async getEpisodesByPodcast(
    podcastId: string,
    limit: number = 20,
    offset: number = 0,
    status?: string,
  ): Promise<PodcastEpisode[]> {
    let query = `
      SELECT * FROM podcast_episode
      WHERE podcast_id = $1
    `;
    const params: any[] = [podcastId];

    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2};`;
    params.push(limit, offset);

    try {
      const result: QueryResult<any> = await this.db.query(query, params);
      return result.rows.map((row) => this._rowToPodcastEpisode(row));
    } catch (err) {
      logger.error("Failed to fetch episodes for podcast", {
        podcastId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  /**
   * Get single episode by ID
   *
   * @param episodeId - Episode ID
   * @returns Episode details
   * @throws NotFoundError if not found
   */
  async getEpisodeById(episodeId: string): Promise<PodcastEpisode & { agentId: string }> {
    const result: QueryResult<any> = await this.db.query(
      `SELECT pe.*, p.agent_id 
       FROM podcast_episode pe
       JOIN podcast p ON pe.podcast_id = p.id
       WHERE pe.id = $1`,
      [episodeId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundError("Episode not found", {
        episodeId,
        code: "EPISODE_NOT_FOUND",
      });
    }

    const episode = this._rowToPodcastEpisode(result.rows[0]);
    return {
      ...episode,
      agentId: result.rows[0].agent_id,
    };
  }

  /**
   * Generate new episode for podcast
   *
   * Orchestrates:
   * 1. Script generation from sources (orchestrator)
   * 2. TTS synthesis (ElevenLabs via orchestrator)
   * 3. Audio upload to S3
   * 4. Transcript storage
   * 5. Episode metadata save
   *
   * @param podcastId - Podcast ID
   * @param req - Episode generation request
   * @returns Created episode (status: 'generating')
   * @throws ValidationError if podcast not found
   * @throws PaymentError if generation cost charge fails
   */
  async generateEpisode(
    podcastId: string,
    req: CreateEpisodeRequest,
  ): Promise<PodcastEpisode> {
    // Verify podcast exists
    const podcast = await this.getPodcast(podcastId);

    // Validate episode request
    if (!req.title || req.title.trim().length === 0) {
      throw new ValidationError("Episode title required", {
        field: "title",
        code: "TITLE_REQUIRED",
      });
    }

    const episodeId = uuidv4();
    const now = new Date();

    const episodeFormat = req.format ?? "monologue";

    // Create episode record first with status 'pending'
    const insertQuery = `
      INSERT INTO podcast_episode (
        id, podcast_id, title, description, status, format, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;

    const insertResult: QueryResult<any> = await this.db.query(insertQuery, [
      episodeId,
      podcastId,
      req.title.trim(),
      req.description || null,
      "pending",
      episodeFormat,
      now,
      now,
    ]);

    const episode = this._rowToPodcastEpisode(insertResult.rows[0]);

    // Try orchestrator — graceful degradation if unavailable
    let orchestratorResult: any;
    try {
      logger.info("Requesting orchestrator for episode generation", {
        episodeId,
        podcastId,
        title: req.title,
      });

      orchestratorResult = await this.orchestrator.generatePodcastEpisode({
        podcastId,
        episodeId,
        title: req.title,
        sourceUrls: req.sourceUrls || [],
        voicePreferences: req.voicePreferences || {},
        format: episodeFormat,
      });
    } catch (orchErr) {
      logger.warn("Orchestrator unavailable, episode queued as pending", {
        episodeId,
        podcastId,
        error: orchErr instanceof Error ? orchErr.message : String(orchErr),
      });
      return episode;
    }

    // Fetch agent wallet address for payment
    let walletAddress: string | null = null;
    try {
      const agentResult = await this.db.query(
        "SELECT erc8004_address FROM agent WHERE id = $1",
        [podcast.agentId],
      );
      walletAddress = agentResult.rows[0]?.erc8004_address ?? null;
    } catch (dbErr) {
      logger.warn("Could not fetch agent wallet for payment", {
        agentId: podcast.agentId,
        error: dbErr instanceof Error ? dbErr.message : String(dbErr),
      });
    }

    // Charge generation cost via x402
    if (walletAddress) {
      try {
        await this.payment.chargeGenerationCost(
          podcast.agentId,
          episodeId,
          walletAddress,
          orchestratorResult.estimatedCostUsdc,
        );
      } catch (paymentErr) {
        logger.warn("Failed to charge generation cost, episode stays pending", {
          episodeId,
          agentId: podcast.agentId,
          error:
            paymentErr instanceof Error ? paymentErr.message : String(paymentErr),
        });
        return episode;
      }
    }

    // Update episode status to 'generating' after orchestrator + payment succeed.
    // Also persist the script returned by the orchestrator so finalize doesn't
    // depend on Redis cache being available.
    const script = orchestratorResult?.script || null;
    const updateResult: QueryResult<any> = await this.db.query(
      `UPDATE podcast_episode SET status = $1, transcript = COALESCE($2, transcript), updated_at = $3 WHERE id = $4 RETURNING *;`,
      ["generating", script, new Date(), episodeId],
    );

    const updatedEpisode = this._rowToPodcastEpisode(updateResult.rows[0]);

    logger.info("Episode generation initiated", {
      episodeId,
      podcastId,
      title: updatedEpisode.title,
      status: updatedEpisode.status,
    });

    // Kick off TTS synthesis + storage upload in the background.
    // Do NOT await — the API response returns immediately with "generating" status
    // while finalization runs asynchronously.
    this.finalizeEpisode(episodeId).catch((err) => {
      logger.error("Background finalization failed", {
        episodeId,
        error: err instanceof Error ? err.message : String(err),
      });
    });

    return updatedEpisode;
  }

  /**
   * Fetch episodes for podcast
   *
   * @param podcastId - Podcast ID
   * @param statusFilter - Optional status filter ('ready', 'distributed', etc.)
   * @param limit - Max results
   * @param offset - Pagination
   * @returns Array of episodes
   */
  async getEpisodes(
    podcastId: string,
    statusFilter?: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<PodcastEpisode[]> {
    let query = `
      SELECT * FROM podcast_episode
      WHERE podcast_id = $1
    `;

    const params: any[] = [podcastId];

    if (statusFilter) {
      query += ` AND status = $${params.length + 1}`;
      params.push(statusFilter);
    }

    query += ` ORDER BY published_at DESC NULLS LAST, created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2};`;
    params.push(limit, offset);

    try {
      const result: QueryResult<any> = await this.db.query(query, params);
      return result.rows.map((row) => this._rowToPodcastEpisode(row));
    } catch (err) {
      logger.error("Failed to fetch episodes", {
        podcastId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  /**
   * Update episode status (e.g., 'generating' → 'ready')
   *
   * Called by orchestrator async processing job
   *
   * @param episodeId - Episode ID
   * @param status - New status
   * @param audioUrl - Audio URL (if transitioning to 'ready')
   * @param transcript - Transcript text (if available)
   * @param durationSeconds - Audio duration (if available)
   */
  async updateEpisodeStatus(
    episodeId: string,
    status: "draft" | "generating" | "ready" | "distributed" | "failed",
    audioUrl?: string,
    transcript?: string,
    durationSeconds?: number,
  ): Promise<PodcastEpisode> {
    const now = new Date();

    try {
      const query = `
        UPDATE podcast_episode
        SET
          status = $1,
          audio_url = COALESCE($2, audio_url),
          transcript = COALESCE($3, transcript),
          duration_seconds = COALESCE($4, duration_seconds),
          generated_at = CASE WHEN $7 IN ('ready', 'distributed') THEN $5 ELSE generated_at END,
          updated_at = $5
        WHERE id = $6
        RETURNING *;
      `;

      const result: QueryResult<any> = await this.db.query(query, [
        status,
        audioUrl || null,
        transcript || null,
        durationSeconds || null,
        now,
        episodeId,
        status,
      ]);

      if (result.rows.length === 0) {
        throw new NotFoundError("Episode not found", {
          episodeId,
          code: "EPISODE_NOT_FOUND",
        });
      }

      const episode = this._rowToPodcastEpisode(result.rows[0]);

      logger.info("Episode status updated", {
        episodeId,
        newStatus: episode.status,
        hasAudio: !!episode.audioUrl,
        durationSeconds: episode.durationSeconds,
      });

      return episode;
    } catch (err) {
      logger.error("Failed to update episode status", {
        episodeId,
        status,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  /**
   * Distribute episode to external platforms
   *
   * Creates distribution records for Spotify, Apple, YouTube, RSS
   * Async jobs will update status → 'live' as platforms confirm
   *
   * @param episodeId - Episode ID
   * @returns Array of distribution records created
   */
  async distributeEpisode(episodeId: string): Promise<PodcastDistribution[]> {
    const episode = await this._getEpisode(episodeId);

    if (!episode) {
      throw new NotFoundError("Episode not found", {
        episodeId,
        code: "EPISODE_NOT_FOUND",
      });
    }

    if (episode.status !== "ready") {
      throw new ValidationError(
        "Episode must be in ready status to distribute",
        {
          episodeId,
          currentStatus: episode.status,
          code: "EPISODE_NOT_READY",
        },
      );
    }

    const platforms = ["spotify", "apple_podcasts", "youtube", "rss"];
    const distributions: PodcastDistribution[] = [];

    try {
      for (const platform of platforms) {
        const distributionId = uuidv4();

        const query = `
          INSERT INTO podcast_distribution (
            id, episode_id, platform, status, updated_at
          )
          VALUES ($1, $2, $3, $4, $5)
          RETURNING *;
        `;

        const result: QueryResult<any> = await this.db.query(query, [
          distributionId,
          episodeId,
          platform,
          "pending",
          new Date(),
        ]);

        distributions.push(this._rowToDistribution(result.rows[0]));

        logger.info("Distribution record created", {
          distributionId,
          episodeId,
          platform,
          status: "pending",
        });
      }

      // TODO: Trigger async distribution jobs via event bus
      // Event: episode:distribute → distribute to each platform

      return distributions;
    } catch (err) {
      logger.error("Failed to distribute episode", {
        episodeId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  /**
   * Get new arrival podcasts — recently created, sorted by popularity
   *
   * Logic: podcasts created within the last 30 days, ordered by total listens DESC.
   * Used to surface "hot new" content on the discovery page New Arrival slot.
   *
   * @param limit - Number of results (default 10)
   * @param windowDays - How many days back to look (default 30)
   * @returns New arrival podcasts sorted by listen count
   */
  async getNewArrivals(
    limit: number = 10,
    windowDays: number = 30,
  ): Promise<Podcast[]> {
    const query = `
      WITH LatestEpisodes AS (
        SELECT DISTINCT ON (podcast_id)
          podcast_id,
          audio_url,
          duration_seconds
        FROM podcast_episode
        WHERE status = 'ready'
        ORDER BY podcast_id, published_at DESC NULLS LAST, created_at DESC
      )
      SELECT
        p.*,
        a.username as author_name,
        a.avatar as author_avatar,
        COUNT(DISTINCT pe.id) as episode_count,
        MAX(pe.published_at) as latest_episode_date,
        COALESCE(SUM(pa.total_listens), 0) as total_listens,
        le.audio_url as latest_audio_url,
        le.duration_seconds as latest_duration
      FROM podcast p
      LEFT JOIN agent a ON p.agent_id = a.id
      LEFT JOIN podcast_episode pe ON p.id = pe.podcast_id
      LEFT JOIN podcast_analytics pa ON pe.id = pa.episode_id
      INNER JOIN LatestEpisodes le ON p.id = le.podcast_id
      WHERE p.status = 'active'
        AND p.created_at >= NOW() - ($2 || ' days')::INTERVAL
      GROUP BY p.id, a.id, le.audio_url, le.duration_seconds
      ORDER BY total_listens DESC, p.created_at DESC
      LIMIT $1;
    `;

    try {
      const result: QueryResult<any> = await this.db.query(query, [limit, windowDays]);
      return result.rows.map((row) => this._rowToPodcast(row));
    } catch (err) {
      logger.error("Failed to fetch new arrival podcasts", {
        windowDays,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  /**
   * Get trending podcasts (global discovery)
   *
   * @param limit - Number of results
   * @param category - Optional category filter
   * @returns Trending podcasts by recent listens
   */
  async getTrendingPodcasts(
    limit: number = 20,
    category?: string,
  ): Promise<Podcast[]> {
    let query = `
      WITH LatestEpisodes AS (
        SELECT DISTINCT ON (podcast_id)
          podcast_id,
          audio_url,
          duration_seconds
        FROM podcast_episode
        WHERE status = 'ready'
        ORDER BY podcast_id, published_at DESC NULLS LAST, created_at DESC
      )
      SELECT
        p.*,
        a.username as author_name,
        a.avatar as author_avatar,
        COUNT(DISTINCT pe.id) as episode_count,
        MAX(pe.published_at) as latest_episode_date,
        COALESCE(SUM(pa.total_listens), 0) as total_listens,
        le.audio_url as latest_audio_url,
        le.duration_seconds as latest_duration
      FROM podcast p
      LEFT JOIN agent a ON p.agent_id = a.id
      LEFT JOIN podcast_episode pe ON p.id = pe.podcast_id
      LEFT JOIN podcast_analytics pa ON pe.id = pa.episode_id
        AND pa.recorded_at >= NOW() - INTERVAL '7 days'
      INNER JOIN LatestEpisodes le ON p.id = le.podcast_id
      WHERE p.status = 'active'
    `;

    const params: any[] = [];

    if (category) {
      params.push(category.toLowerCase());
      query += ` AND p.category = $${params.length}`;
    }

    query += `
      GROUP BY p.id, a.id, le.audio_url, le.duration_seconds
      ORDER BY total_listens DESC
      LIMIT $${params.length + 1};
    `;

    params.push(limit);

    try {
      const result: QueryResult<any> = await this.db.query(query, params);
      return result.rows.map((row) => this._rowToPodcast(row));
    } catch (err) {
      logger.error("Failed to fetch trending podcasts", {
        category,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  /**
   * Generate a summary from episode transcript using orchestrator LLM
   *
   * Calls orchestrator service to create a concise summary
   * of the episode transcript (max 5 sentences).
   *
   * @param episodeId - Episode ID
   * @param transcript - Full episode transcript
   * @returns Summary text (up to 500 characters)
   * @throws NotFoundError if episode not found
   * @throws PaymentError if LLM call fails
   */
  async generateTranscriptSummary(
    episodeId: string,
    transcript: string,
  ): Promise<string> {
    // Validate inputs
    if (!episodeId || episodeId.trim().length === 0) {
      throw new ValidationError("Episode ID required", {
        field: "episodeId",
        code: "EPISODE_ID_REQUIRED",
      });
    }

    if (!transcript || transcript.trim().length === 0) {
      throw new ValidationError("Transcript required", {
        field: "transcript",
        code: "TRANSCRIPT_REQUIRED",
      });
    }

    try {
      // Truncate transcript to ~5000 chars to avoid token explosion
      const truncatedTranscript = transcript.substring(0, 5000);

      logger.info("Generating transcript summary via orchestrator", {
        episodeId,
        transcriptLength: transcript.length,
        truncatedLength: truncatedTranscript.length,
      });

      // Call orchestrator to generate summary
      const summary = await this.orchestrator.generateSummary(
        truncatedTranscript,
      );

      logger.info("Transcript summary generated", {
        episodeId,
        summaryLength: summary.length,
      });

      return summary;
    } catch (err) {
      logger.error("Failed to generate transcript summary", {
        episodeId,
        error: err instanceof Error ? err.message : String(err),
      });

      // If orchestrator fails, return truncated transcript as fallback
      if (transcript.length > 500) {
        const truncated = transcript.substring(0, 500) + "...";
        logger.warn("Using truncated transcript as summary fallback", {
          episodeId,
          fallbackLength: truncated.length,
        });
        return truncated;
      }

      throw new PaymentError(
        "Failed to generate transcript summary",
        err,
      );
    }
  }

  /**
   * Update episode with generated summary
   *
   * Stores transcript summary in database after generation.
   *
   * @param episodeId - Episode ID
   * @param summary - Generated summary text
   * @returns Updated episode
   */
  async updateEpisodeSummary(
    episodeId: string,
    summary: string,
  ): Promise<PodcastEpisode> {
    if (!episodeId || !summary) {
      throw new ValidationError("Episode ID and summary required", {
        code: "INVALID_SUMMARY_UPDATE",
      });
    }

    const now = new Date();

    try {
      const query = `
        UPDATE podcast_episode
        SET 
          transcript = $1,
          updated_at = $2
        WHERE id = $3
        RETURNING *;
      `;

      const result: QueryResult<any> = await this.db.query(query, [
        summary,
        now,
        episodeId,
      ]);

      if (result.rows.length === 0) {
        throw new NotFoundError("Episode not found", {
          episodeId,
          code: "EPISODE_NOT_FOUND",
        });
      }

      const episode = this._rowToPodcastEpisode(result.rows[0]);

      logger.info("Episode summary updated", {
        episodeId,
        summaryLength: summary.length,
      });

      return episode;
    } catch (err) {
      logger.error("Failed to update episode summary", {
        episodeId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  // ===================================================================
  // Episode Retry & Status Methods
  // ===================================================================

  /**
   * Retry generation for a stalled episode.
   *
   * If the orchestrator was unavailable when the episode was first created,
   * the episode stays in 'pending' status with no audio. This method
   * re-invokes the orchestrator and transitions the episode to 'generating'
   * on success, or 'failed' if the orchestrator is still unreachable.
   *
   * @param episodeId - Episode ID to retry
   * @returns Updated episode
   * @throws NotFoundError if episode not found
   * @throws ValidationError if episode is not in a retryable state
   */
  async retryEpisodeGeneration(episodeId: string): Promise<PodcastEpisode> {
    const episode = await this.getEpisodeById(episodeId);

    // Only retry episodes stuck in 'pending' or 'failed'
    if (!["pending", "failed"].includes(episode.status)) {
      throw new ValidationError(
        "Episode is not in a retryable state",
        {
          episodeId,
          currentStatus: episode.status,
          retryableStatuses: ["pending", "failed"],
          code: "EPISODE_NOT_RETRYABLE",
        },
      );
    }

    const podcast = await this.getPodcast(episode.podcastId);

    // Attempt orchestrator call
    try {
      logger.info("Retrying episode generation via orchestrator", {
        episodeId,
        podcastId: episode.podcastId,
        previousStatus: episode.status,
      });

      const retryResult = await this.orchestrator.generatePodcastEpisode({
        podcastId: episode.podcastId,
        episodeId,
        title: episode.title,
        sourceUrls: [],
        voicePreferences: {},
      });

      // Persist the script immediately so finalize doesn't rely on Redis cache
      const retryScript = retryResult?.script || null;
      if (retryScript) {
        await this.db.query(
          `UPDATE podcast_episode SET transcript = $1, updated_at = $2 WHERE id = $3`,
          [retryScript, new Date(), episodeId],
        );
      }

      // Orchestrator accepted — move to 'generating'
      const updated = await this.updateEpisodeStatus(episodeId, "generating");

      logger.info("Episode generation retry succeeded", {
        episodeId,
        newStatus: "generating",
      });

      return updated;
    } catch (err) {
      // Orchestrator still unavailable — mark as 'failed' so agents
      // have visibility, but allow future retries.
      logger.warn("Episode generation retry failed — marking as failed", {
        episodeId,
        error: err instanceof Error ? err.message : String(err),
      });

      const failed = await this.updateEpisodeStatus(episodeId, "failed");
      return failed;
    }
  }

  /**
   * Get generation status for an episode.
   *
   * Returns the current status along with timing metadata so agents
   * can poll for completion.
   *
   * @param episodeId - Episode ID
   * @returns Status details
   */
  async getEpisodeGenerationStatus(episodeId: string): Promise<{
    episodeId: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    generatedAt?: Date;
    audioUrl?: string;
    durationSeconds?: number;
    canRetry: boolean;
  }> {
    const episode = await this.getEpisodeById(episodeId);

    return {
      episodeId: episode.id,
      status: episode.status,
      createdAt: episode.createdAt,
      updatedAt: episode.updatedAt,
      generatedAt: episode.generatedAt,
      audioUrl: episode.audioUrl,
      durationSeconds: episode.durationSeconds,
      canRetry: ["pending", "failed"].includes(episode.status),
    };
  }

  /**
   * Finalize an episode: synthesize audio via TTS, upload to storage,
   * then mark the episode as 'ready'.
   *
   * Safe to call when episode is in 'generating' status. Fetches the
   * script cached by the orchestrator, passes it through ElevenLabs TTS,
   * uploads the resulting audio (graceful degradation if storage is not
   * configured), and updates the episode record.
   *
   * @param episodeId - Episode to finalize
   * @returns Updated episode with status 'ready'
   */
  async finalizeEpisode(episodeId: string): Promise<PodcastEpisode> {
    const episode = await this.getEpisodeById(episodeId);

    // 1. Get transcript — prefer orchestrator Redis cache, fall back to DB column
    //    (DB column is populated during generateEpisode/retryEpisodeGeneration).
    let transcript: string | undefined = episode.transcript ?? undefined;
    let durationSeconds: number | undefined;
    let audioUrl: string | undefined;

    try {
      const orchestratorStatus = await this.orchestrator.getPodcastEpisodeStatus(episodeId);
      if (orchestratorStatus.transcript) transcript = orchestratorStatus.transcript;
      durationSeconds = orchestratorStatus.durationSeconds ?? undefined;
      audioUrl = orchestratorStatus.audioUrl ?? undefined;
    } catch (err) {
      logger.warn("finalizeEpisode: orchestrator cache unavailable, using DB transcript", {
        episodeId,
        hasDbTranscript: !!transcript,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // 2. TTS synthesis (if we have a transcript and storage-backed audio isn't available)
    if (!audioUrl && transcript) {
      try {
        const tts = getTTSService();
        if (tts.isEnabled()) {
          const format = episode.format ?? "monologue";
          let result: { audioBuffer: Buffer; durationMs: number } | null = null;

          if (format === "dialogue") {
            const secondaryVoiceId = (episode as any).secondaryVoiceId ?? tts["config"]?.defaultVoiceId;
            result = await tts.synthesizeDialogue(
              transcript,
              tts["config"]?.defaultVoiceId,
              secondaryVoiceId,
            );
          } else {
            result = await tts.synthesize({ text: transcript });
          }

          if (result) {
            durationSeconds = Math.round(result.durationMs / 1000);

            // 3. Upload audio
            try {
              const storage = getAudioStorageService();
              if (storage) {
                const uploaded = await storage.upload(result.audioBuffer, episodeId);
                audioUrl = uploaded ?? undefined;
              }
            } catch (uploadErr) {
              logger.warn("finalizeEpisode: audio upload failed (graceful degradation)", {
                episodeId,
                error: uploadErr instanceof Error ? uploadErr.message : String(uploadErr),
              });
            }
          }
        }
      } catch (ttsErr) {
        logger.warn("finalizeEpisode: TTS synthesis failed (graceful degradation)", {
          episodeId,
          error: ttsErr instanceof Error ? ttsErr.message : String(ttsErr),
        });
      }
    }

    // 4. Mark episode ready
    const updated = await this.updateEpisodeStatus(
      episodeId,
      "ready",
      audioUrl,
      transcript,
      durationSeconds,
    );

    logger.info("Episode finalized", {
      episodeId,
      audioUrl: audioUrl ?? null,
      durationSeconds: durationSeconds ?? null,
      transcriptLength: transcript?.length ?? 0,
    });

    return updated;
  }

  // ===================================================================
  // Private Helper Methods
  // ===================================================================

  private _rowToPodcast(row: any): Podcast {
    return {
      id: row.id,
      agentId: row.agent_id,
      title: row.title,
      description: row.description,
      category: row.category,
      coverImageUrl: row.cover_image_url,
      status: row.status,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      episodeCount: row.episode_count ? parseInt(row.episode_count) : 0,
      latestEpisodeDate: row.latest_episode_date
        ? new Date(row.latest_episode_date)
        : undefined,
      totalListens: row.total_listens
        ? parseInt(row.total_listens)
        : 0,
      author: row.author_name || "Agent_Unknown",
      authorAvatar: row.author_avatar || null,
      audioUrl: row.latest_audio_url || null,
      duration: row.latest_duration ? `${Math.floor(row.latest_duration / 60)}:${(row.latest_duration % 60).toString().padStart(2, '0')}` : "0:00",
    };
  }

  private _rowToPodcastEpisode(row: any): PodcastEpisode {
    return {
      id: row.id,
      podcastId: row.podcast_id,
      title: row.title,
      description: row.description,
      transcript: row.transcript,
      audioUrl: row.audio_url,
      durationSeconds: row.duration_seconds,
      audioFormat: row.audio_format || "mp3",
      format: row.format || "monologue",
      status: row.status,
      generatedAt: row.generated_at ? new Date(row.generated_at) : undefined,
      publishedAt: row.published_at ? new Date(row.published_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private _rowToDistribution(row: any): PodcastDistribution {
    return {
      id: row.id,
      episodeId: row.episode_id,
      platform: row.platform,
      platformEpisodeId: row.platform_episode_id,
      platformUrl: row.platform_url,
      status: row.status,
      errorMessage: row.error_message,
      distributedAt: row.distributed_at
        ? new Date(row.distributed_at)
        : undefined,
    };
  }

  private async _getEpisode(episodeId: string): Promise<any | null> {
    const result: QueryResult<any> = await this.db.query(
      "SELECT * FROM podcast_episode WHERE id = $1",
      [episodeId],
    );
    return result.rows[0] || null;
  }
}

// Import at the bottom to avoid circular dependencies
import { db } from "@/config/database.js";
import { orchestratorClient } from "@/services/orchestrator-client.js";
import { paymentService } from "@/services/payment-service.js";

// Singleton instance
export const podcastService = new PodcastService(
  db,
  orchestratorClient,
  paymentService,
);

export default PodcastService;
