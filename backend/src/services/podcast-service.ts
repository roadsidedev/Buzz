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
 * Part of Phase 1: Strategic Pivot (ClawPod + ClawZz integration)
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
}

export interface CreateEpisodeRequest {
  title: string;
  description?: string;
  sourceUrls?: string[];
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
        COUNT(DISTINCT pe.id) as episode_count,
        MAX(pe.published_at) as latest_episode_date,
        COALESCE(SUM(pa.total_listens), 0) as total_listens
      FROM podcast p
      LEFT JOIN podcast_episode pe ON p.id = pe.podcast_id
      LEFT JOIN podcast_analytics pa ON pe.id = pa.episode_id
      WHERE p.agent_id = $1
      GROUP BY p.id
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

      const podcast = this._rowToPodcast(result.rows[0]);

      logger.info("Podcast updated", {
        podcastId,
        changes: Object.keys(updates),
      });

      return podcast;
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
        COUNT(DISTINCT pe.id) as episode_count,
        MAX(pe.published_at) as latest_episode_date,
        COALESCE(SUM(pa.total_listens), 0) as total_listens
      FROM podcast p
      LEFT JOIN podcast_episode pe ON p.id = pe.podcast_id
      LEFT JOIN podcast_analytics pa ON pe.id = pa.episode_id
      WHERE p.id = $1
      GROUP BY p.id;
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
  async getEpisodeById(episodeId: string): Promise<PodcastEpisode> {
    const result: QueryResult<any> = await this.db.query(
      "SELECT * FROM podcast_episode WHERE id = $1",
      [episodeId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundError("Episode not found", {
        episodeId,
        code: "EPISODE_NOT_FOUND",
      });
    }

    return this._rowToPodcastEpisode(result.rows[0]);
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

    try {
      // Call orchestrator to generate content
      // (orchestrator handles script gen + TTS)
      logger.info("Requesting orchestrator for episode generation", {
        episodeId,
        podcastId,
        title: req.title,
      });

      const orchestratorResult = await this.orchestrator.generatePodcastEpisode(
        {
          podcastId,
          episodeId,
          title: req.title,
          sourceUrls: req.sourceUrls || [],
          voicePreferences: req.voicePreferences || {},
        },
      );

      // Charge generation cost via x402
      try {
        await this.payment.chargeGenerationCost(
          podcast.agentId,
          episodeId,
          orchestratorResult.estimatedCostUsdc,
        );
      } catch (paymentErr) {
        logger.error("Failed to charge generation cost", {
          episodeId,
          agentId: podcast.agentId,
          error:
            paymentErr instanceof Error ? paymentErr.message : String(paymentErr),
        });
        throw new PaymentError(
          "Failed to charge episode generation cost",
          paymentErr,
        );
      }

      // Create episode record in database (status: 'generating')
      const query = `
        INSERT INTO podcast_episode (
          id, podcast_id, title, description, status, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *;
      `;

      const result: QueryResult<any> = await this.db.query(query, [
        episodeId,
        podcastId,
        req.title.trim(),
        req.description || null,
        "generating",
        now,
        now,
      ]);

      const episode = this._rowToPodcastEpisode(result.rows[0]);

      logger.info("Episode generation initiated", {
        episodeId,
        podcastId,
        title: episode.title,
        status: episode.status,
      });

      return episode;
    } catch (err) {
      logger.error("Failed to generate episode", {
        podcastId,
        title: req.title,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
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
          generated_at = CASE WHEN $1 IN ('ready', 'distributed') THEN $5 ELSE generated_at END,
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
      SELECT 
        p.*,
        COUNT(DISTINCT pe.id) as episode_count,
        MAX(pe.published_at) as latest_episode_date,
        COALESCE(SUM(pa.total_listens), 0) as total_listens
      FROM podcast p
      LEFT JOIN podcast_episode pe ON p.id = pe.podcast_id
      LEFT JOIN podcast_analytics pa ON pe.id = pa.episode_id
      WHERE p.status = 'active'
        AND pa.recorded_at >= NOW() - INTERVAL '7 days'
    `;

    const params: any[] = [];

    if (category) {
      params.push(category.toLowerCase());
      query += ` AND p.category = $${params.length}`;
    }

    query += `
      GROUP BY p.id
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
