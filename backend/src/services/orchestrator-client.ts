/**
 * Orchestrator Client
 *
 * Previously: RPC client to an external Python FastAPI service.
 * Now: Thin facade over LocalOrchestratorAdapter (TypeScript, in-process).
 *
 * All exported interfaces (ProcessTurnResponse, RoomStateResponse, etc.) are
 * unchanged so that every existing caller compiles and behaves identically.
 * The circular HTTP dependency (backend ↔ orchestrator) is fully eliminated.
 */

import { LocalOrchestratorAdapter } from "./scoring/index.js";
import { RoomStateStore } from "./scoring/room-state-store.js";
import { getCacheService } from "./cache-service.js";
import { messageRepository } from "../repositories/message-repository.js";
import { logger } from "../utils/logger.js";

// ===================================================================
// Type Definitions (unchanged — callers must not need to change)
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
// Adapter singleton (lazy-initialised)
// ===================================================================

let _adapter: LocalOrchestratorAdapter | null = null;

function getAdapter(): LocalOrchestratorAdapter {
  if (!_adapter) {
    const redisClient = getCacheService().getRedisClient();
    const store = new RoomStateStore(redisClient);
    _adapter = new LocalOrchestratorAdapter(messageRepository, store);
  }
  return _adapter;
}

/** Reset adapter singleton — for testing only */
export function resetOrchestratorAdapter(): void {
  _adapter = null;
}

// ===================================================================
// OrchestratorClient class — same public surface, local implementation
// ===================================================================

export class OrchestratorClient {
  /**
   * Register a new room with the orchestrator
   */
  async registerRoom(room: {
    id: string;
    hostAgentId: string;
    type: string;
    objective?: string;
    spawnFee?: number;
    invitedAgentIds?: string[];
    status?: string;
    typeConfig?: Record<string, unknown>;
  }): Promise<void> {
    await getAdapter().registerRoom(room);
    logger.info("Room registered with local orchestrator", { roomId: room.id });
  }

  /**
   * Start a room (transition to LIVE)
   */
  async startRoom(roomId: string): Promise<void> {
    await getAdapter().startRoom(roomId);
    logger.info("Room started in local orchestrator", { roomId });
  }

  /**
   * Close a room
   */
  async closeRoom(roomId: string, reason: string = "contract_satisfied"): Promise<void> {
    await getAdapter().closeRoom(roomId, reason);
    logger.info("Room closed in local orchestrator", { roomId, reason });
  }

  /**
   * Get current room state
   */
  async getRoomState(roomId: string): Promise<RoomStateResponse> {
    return getAdapter().getRoomState(roomId) as Promise<RoomStateResponse>;
  }

  /**
   * Submit a message to the orchestrator queue
   */
  async submitMessage(
    roomId: string,
    message: { id: string; agentId: string; text: string },
  ): Promise<void> {
    await getAdapter().submitMessage(roomId, {
      id: message.id,
      agentId: message.agentId,
      text: message.text,
    });
    logger.debug("Message submitted to local orchestrator", { roomId, messageId: message.id });
  }

  /**
   * Process a single turn (score candidates -> apply moderation -> select winner)
   */
  async processTurn(roomId: string): Promise<ProcessTurnResponse> {
    const result = await getAdapter().processTurn(roomId);

    logger.info("Turn processed by local orchestrator", {
      roomId,
      status: result.status,
      selectedMessageId: result.selected_message_id,
      score: result.score,
    });

    return result as ProcessTurnResponse;
  }

  // ===================================================================
  // Podcast / content-generation methods
  // ===================================================================

  async generatePodcastEpisode(request: PodcastGenerationRequest): Promise<PodcastGenerationResponse> {
    return getAdapter().generatePodcastEpisode({
      podcastId: request.podcastId,
      episodeId: request.episodeId,
      title: request.title,
      sourceUrls: request.sourceUrls,
      format: request.format,
    });
  }

  async getPodcastEpisodeStatus(episodeId: string): Promise<PodcastEpisodeStatus> {
    return getAdapter().getPodcastEpisodeStatus(episodeId);
  }

  async generateSummary(transcript: string): Promise<string> {
    return getAdapter().generateSummary(transcript);
  }

  /**
   * Health check — always healthy since there's no remote service to check
   */
  async healthCheck(): Promise<boolean> {
    return true;
  }
}

export const orchestratorClient = new OrchestratorClient();
