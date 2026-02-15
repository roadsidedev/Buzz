/**
 * Orchestrator Client
 *
 * RPC client for communicating with Python Orchestrator service.
 * Handles:
 * - Podcast episode generation (script + TTS)
 * - Episode status polling
 * - Message scoring for rooms
 * - Turn selection
 *
 * Part of Week 2: Backend Integration
 */

import { logger } from "../utils/logger.js";
import { PaymentError } from "../utils/errors.js";

// ===================================================================
// Type Definitions
// ===================================================================

export interface PodcastGenerationRequest {
  podcastId: string;
  episodeId: string;
  title: string;
  sourceUrls?: string[];
  voicePreferences?: {
    primaryVoiceId?: string;
    secondaryVoiceId?: string;
  };
}

export interface PodcastGenerationResponse {
  episodeId: string;
  status: "generating";
  estimatedDurationSeconds: number;
  estimatedCostUsdc: number;
  estimatedTimeSeconds: number;
}

export interface PodcastEpisodeStatus {
  status: "draft" | "generating" | "ready" | "failed";
  audioUrl?: string;
  transcript?: string;
  durationSeconds?: number;
  errorMessage?: string;
}

export interface RoomMessageScoringRequest {
  roomId: string;
  messages: Array<{
    messageId: string;
    agentId: string;
    text: string;
  }>;
  context: {
    roomType: string;
    objective: string;
    history: Array<{ agentId: string; text: string }>;
  };
}

export interface RoomMessageScore {
  messageId: string;
  score: number; // 0-100
  dimensions: {
    relevance: number;
    novelty: number;
    coherence: number;
    actionability: number;
    engagement: number;
  };
}

// ===================================================================
// Orchestrator Client Class
// ===================================================================

export class OrchestratorClient {
  private url: string;
  private token: string;
  private timeout: number; // milliseconds

  constructor(
    orchestratorUrl: string = process.env.ORCHESTRATOR_URL || "http://localhost:5000",
    orchestratorToken: string = process.env.ORCHESTRATOR_TOKEN || "dev-token",
    timeoutSeconds: number = 30,
  ) {
    this.url = orchestratorUrl;
    this.token = orchestratorToken;
    this.timeout = timeoutSeconds * 1000;
  }

  /**
   * Generate podcast episode (script + TTS)
   *
   * Calls orchestrator to:
   * 1. Generate script from source URLs (if provided)
   * 2. Synthesize script to audio using ElevenLabs
   * 3. Upload audio to S3
   * 4. Return audio URL + metadata
   *
   * @param request - Podcast generation request
   * @returns Generation metadata with cost estimate
   * @throws Error if orchestrator request fails
   */
  async generatePodcastEpisode(
    request: PodcastGenerationRequest,
  ): Promise<PodcastGenerationResponse> {
    const url = `${this.url}/api/v1/podcasts/generate-episode`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          message: response.statusText,
        }));
        throw new Error(
          `Orchestrator error (${response.status}): ${error.message || JSON.stringify(error)}`,
        );
      }

      const data = (await response.json()) as PodcastGenerationResponse;

      logger.info("Orchestrator generated episode", {
        episodeId: request.episodeId,
        podcastId: request.podcastId,
        estimatedCostUsdc: data.estimatedCostUsdc,
      });

      return data;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        logger.error("Orchestrator RPC timeout", {
          method: "generatePodcastEpisode",
          episodeId: request.episodeId,
          timeoutSeconds: this.timeout / 1000,
        });
        throw new Error(
          `Orchestrator request timeout (${this.timeout / 1000}s)`,
        );
      }

      logger.error("Orchestrator RPC failed", {
        method: "generatePodcastEpisode",
        episodeId: request.episodeId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Get podcast episode generation status
   *
   * Polls orchestrator for episode generation progress
   *
   * @param episodeId - Episode ID
   * @returns Status with audio URL and transcript when ready
   * @throws Error if orchestrator request fails
   */
  async getPodcastEpisodeStatus(episodeId: string): Promise<PodcastEpisodeStatus> {
    const url = `${this.url}/api/v1/podcasts/episodes/${episodeId}/status`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          message: response.statusText,
        }));
        throw new Error(
          `Orchestrator error (${response.status}): ${error.message || JSON.stringify(error)}`,
        );
      }

      const data = (await response.json()) as PodcastEpisodeStatus;

      logger.debug("Episode status polled", {
        episodeId,
        status: data.status,
      });

      return data;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        logger.error("Orchestrator RPC timeout", {
          method: "getPodcastEpisodeStatus",
          episodeId,
          timeoutSeconds: this.timeout / 1000,
        });
        throw new Error(
          `Orchestrator request timeout (${this.timeout / 1000}s)`,
        );
      }

      logger.error("Orchestrator RPC failed", {
        method: "getPodcastEpisodeStatus",
        episodeId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Score candidate messages for room turn selection
   *
   * Calls orchestrator to score messages on 5 dimensions:
   * - Relevance: Does message address objective?
   * - Novelty: Does it introduce new info?
   * - Coherence: Does it connect to prior discussion?
   * - Actionability: Does it move toward concrete outputs?
   * - Engagement: Does it maintain viewer interest?
   *
   * @param request - Message scoring request
   * @returns Array of scores (one per message)
   * @throws Error if orchestrator request fails
   */
  async scoreMessages(
    request: RoomMessageScoringRequest,
  ): Promise<RoomMessageScore[]> {
    const url = `${this.url}/api/v1/rooms/score-messages`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          message: response.statusText,
        }));
        throw new Error(
          `Orchestrator error (${response.status}): ${error.message || JSON.stringify(error)}`,
        );
      }

      const scores = (await response.json()) as RoomMessageScore[];

      logger.info("Messages scored by orchestrator", {
        roomId: request.roomId,
        messageCount: scores.length,
        topScore: scores[0]?.score || 0,
      });

      return scores;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        logger.error("Orchestrator RPC timeout", {
          method: "scoreMessages",
          roomId: request.roomId,
          timeoutSeconds: this.timeout / 1000,
        });
        throw new Error(
          `Orchestrator request timeout (${this.timeout / 1000}s)`,
        );
      }

      logger.error("Orchestrator RPC failed", {
        method: "scoreMessages",
        roomId: request.roomId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Health check for orchestrator
   *
   * @returns true if orchestrator is healthy
   */
  async healthCheck(): Promise<boolean> {
    const url = `${this.url}/health`;

    try {
      const response = await fetch(url, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });

      logger.debug("Orchestrator health check", {
        status: response.status,
        ok: response.ok,
      });

      return response.ok;
    } catch (err) {
      logger.warn("Orchestrator health check failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }
}

/**
 * Singleton instance
 */
export const orchestratorClient = new OrchestratorClient();
