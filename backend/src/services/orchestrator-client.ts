// @ts-nocheck
/**
 * Orchestrator Client
 *
 * RPC client for communicating with Python Orchestrator service.
 * Handles:
 * - Room orchestration (register, start, message submission, turn processing)
 * - Podcast episode generation (script + TTS) - Phase 2
 *
 * Part of Day 7: Orchestrator Integration
 */

import { logger } from "../utils/logger.js";

// ===================================================================
// Type Definitions
// ===================================================================

export interface RoomStateResponse {
  status: string;
  room_id: string;
  room_status: string;
  turn_count: number;
  queue_size: number;
  contract_satisfaction: number;
}

export interface ProcessTurnResponse {
  status: string;
  turn_number?: number;
  selected_message_id?: string;
  selected_agent_id?: string;
  score?: number;
  completion_level?: string;
  contract_satisfaction?: number;
  error?: string;
}

export interface PodcastGenerationRequest {
  podcastId: string;
  episodeId: string;
  title: string;
  sourceUrls?: string[];
  format?: "monologue" | "dialogue";
  voicePreferences?: {
    primaryVoiceId?: string;
    secondaryVoiceId?: string;
  };
}

export interface PodcastGenerationResponse {
  episodeId: string;
  status: string;
  script: string;
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

// ===================================================================
// Orchestrator Client Class
// ===================================================================

export class OrchestratorClient {
  private url: string;
  private token: string;
  private timeout: number;

  constructor(
    orchestratorUrl: string = process.env.ORCHESTRATOR_URL || "http://localhost:5000",
    orchestratorToken: string = process.env.ORCHESTRATOR_TOKEN || "",
    timeoutSeconds: number = 30,
  ) {
    if (!orchestratorToken && process.env.NODE_ENV === "production") {
      throw new Error(
        "ORCHESTRATOR_TOKEN environment variable is required in production.",
      );
    }

    if (!orchestratorToken && process.env.NODE_ENV === "development") {
      logger.warn(
        "ORCHESTRATOR_TOKEN not set in development mode. " +
        "Set ORCHESTRATOR_TOKEN in .env.local for proper orchestrator communication.",
      );
    }

    this.url = orchestratorUrl;
    this.token = orchestratorToken;
    this.timeout = timeoutSeconds * 1000;
  }

  /**
   * Register a new room with the orchestrator
   */
  async registerRoom(room: any): Promise<void> {
    const url = `${this.url}/api/v1/rooms`;
    
    // Map backend room model to Python Orchestrator Room model
    const orchestratorRoom = {
      id: room.id,
      host_agent_id: room.hostAgentId,
      room_type: room.type,
      type_config: this._buildTypeConfig(room),
      status: room.status,
      objective: room.objective || "Discussion",
      spawn_fee_cents: room.spawnFee || 0,
      participant_ids: room.invitedAgentIds || [],
      speaker_ids: []
    };

    await this._fetch(url, "POST", { room: orchestratorRoom });
    logger.info("Room registered with orchestrator", { roomId: room.id });
  }

  /**
   * Start a room (transition to LIVE)
   */
  async startRoom(roomId: string): Promise<void> {
    const url = `${this.url}/api/v1/rooms/${roomId}/start`;
    await this._fetch(url, "POST");
    logger.info("Room started in orchestrator", { roomId });
  }

  /**
   * Close a room
   */
  async closeRoom(roomId: string, reason: string = "contract_satisfied"): Promise<void> {
    const url = `${this.url}/api/v1/rooms/${roomId}/close?reason=${encodeURIComponent(reason)}`;
    await this._fetch(url, "POST");
    logger.info("Room closed in orchestrator", { roomId, reason });
  }

  /**
   * Get current room state
   */
  async getRoomState(roomId: string): Promise<RoomStateResponse> {
    const url = `${this.url}/api/v1/rooms/${roomId}/state`;
    return (await this._fetch(url, "GET")) as RoomStateResponse;
  }

  /**
   * Submit a message to the orchestrator queue
   */
  async submitMessage(roomId: string, message: any): Promise<void> {
    const url = `${this.url}/api/v1/rooms/${roomId}/messages`;
    
    const orchestratorMessage = {
      id: message.id,
      room_id: roomId,
      agent_id: message.agentId,
      text: message.text,
      status: "submitted",
    };

    await this._fetch(url, "POST", { message: orchestratorMessage });
    logger.debug("Message submitted to orchestrator", { roomId, messageId: message.id });
  }

  /**
   * Process a single turn (score candidates -> apply moderation -> select winner)
   */
  async processTurn(roomId: string): Promise<ProcessTurnResponse> {
    const url = `${this.url}/api/v1/rooms/${roomId}/process-turn`;
    
    // Use an extended timeout since this involves multiple LLM calls
    const result = await this._fetch(url, "POST", undefined, this.timeout * 2);
    
    logger.info("Turn processed by orchestrator", { 
      roomId, 
      status: result.status,
      selectedMessageId: result.selected_message_id,
      score: result.score 
    });
    
    return result as ProcessTurnResponse;
  }

  /**
   * Helper to map backend's generic generic config to Python orchestrator specifics
   */
  private _buildTypeConfig(room: any): any {
    switch (room.type) {
      case "debate":
        return { topic: room.objective || "General Debate", speaking_order: "free-form", sides: 2 };
      case "coding":
        return { language: "javascript", problem_statement: room.objective || "Build a feature", difficulty: "medium", test_required: false };
      case "research":
        return { domain: "general", methodology: "empirical", research_question: room.objective || "Explore a topic", citation_required: false };
      case "trading":
        return { asset_class: "crypto", instrument: "general", timeframe: "1d", risk_tolerance: "moderate", disclaimer: "None" };
      case "simulation":
        return { scenario_name: "Sim", scenario_description: room.objective || "Simulation", constraints: [], success_definition: "Done", difficulty: "intermediate" };
      default:
        // Default to blank custom template
        return { 
          template_used: "blank", 
          custom_name: room.type, 
          custom_description: room.objective || "Custom Room", 
          success_criteria: "Host decides", 
          validation_rules: [],
          custom_scoring_weights: {
            relevance: 0.35,
            novelty: 0.25,
            coherence: 0.20,
            actionability: 0.15,
            engagement: 0.05
          },
          min_turns_required: 4,
          max_turns_standard: 8,
          max_turns_exceptional: 12
        };
    }
  }

  /**
   * Internal fetch helper
   */
  private async _fetch(url: string, method: string, body?: any, timeoutMs?: number): Promise<any> {
    const controller = new AbortController();
    const timeout = timeoutMs || this.timeout;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const headers: Record<string, string> = {};
      if (this.token) {
        headers.Authorization = `Bearer ${this.token}`;
      }
      if (body) {
        headers["Content-Type"] = "application/json";
      }

      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(`Orchestrator error (${response.status}): ${error.message || JSON.stringify(error)}`);
      }

      return await response.json();
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(`Orchestrator request timeout (${timeout / 1000}s) on ${method} ${url}`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ===================================================================
  // Podcast / content-generation methods
  // ===================================================================

  /**
   * Request orchestrator to generate a podcast episode script via LLM.
   */
  async generatePodcastEpisode(request: PodcastGenerationRequest): Promise<PodcastGenerationResponse> {
    const url = `${this.url}/api/v1/podcasts/generate`;

    const body = {
      podcast_id: request.podcastId,
      episode_id: request.episodeId,
      title: request.title,
      source_urls: request.sourceUrls || [],
      format: request.format ?? "monologue",
      voice_preferences: request.voicePreferences
        ? {
            primary_voice_id: request.voicePreferences.primaryVoiceId || null,
            secondary_voice_id: request.voicePreferences.secondaryVoiceId || null,
          }
        : null,
    };

    const result = await this._fetch(url, "POST", body);

    return {
      episodeId: result.episode_id,
      status: result.status,
      script: result.script ?? "",
      estimatedDurationSeconds: result.estimated_duration_seconds,
      estimatedCostUsdc: result.estimated_cost_usdc,
      estimatedTimeSeconds: result.estimated_time_seconds,
    };
  }

  /**
   * Retrieve episode generation status from orchestrator cache.
   */
  async getPodcastEpisodeStatus(episodeId: string): Promise<PodcastEpisodeStatus> {
    const url = `${this.url}/api/v1/podcasts/${encodeURIComponent(episodeId)}/status`;

    try {
      const result = await this._fetch(url, "GET");
      return {
        status: result.status || "ready",
        audioUrl: result.audio_url,
        transcript: result.script,
        durationSeconds: result.estimated_duration_seconds,
        errorMessage: result.error,
      };
    } catch (err) {
      // If episode not found in orchestrator cache, treat as ready
      // (audio generation is async and handled by backend TTS pipeline)
      logger.warn("Episode status not in orchestrator cache", {
        episodeId,
        error: err instanceof Error ? err.message : String(err),
      });
      return { status: "ready" };
    }
  }

  /**
   * Generate a concise summary from transcript text via LLM.
   */
  async generateSummary(transcript: string): Promise<string> {
    const url = `${this.url}/api/v1/podcasts/summary`;
    const result = await this._fetch(url, "POST", { transcript });
    return result.summary as string;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.url}/health`, { signal: AbortSignal.timeout(5000) });
      return response.ok;
    } catch (err) {
      return false;
    }
  }
}

export const orchestratorClient = new OrchestratorClient();
