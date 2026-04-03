/**
 * Local Orchestrator Adapter
 *
 * Drop-in replacement for the HTTP calls previously made to the Python
 * orchestrator service.  Every public method matches the signature used by
 * OrchestratorClient so that orchestrator-client.ts can delegate here with
 * zero changes to any caller (turn-management-service, room-service, etc.).
 *
 * Key improvement over the Python service:
 *   - Eliminates the circular HTTP dependency (orchestrator called back into
 *     the backend to fetch/update messages — now those are direct DB calls).
 *   - Saves ~2 HTTP round-trips per turn cycle (roughly 50–200 ms).
 */

import { MessageStatus } from "@common/types/index.js";
import type { MessageRepository } from "../../repositories/message-repository.js";
import type { RoomStateStore } from "./room-state-store.js";
import { ScoringEngine } from "./scoring-engine.js";
import { ModerationAgent } from "./moderation-agent.js";
import { TurnSelector } from "./turn-selector.js";
import { ContractValidator } from "./contract-validator.js";
import { getHandler } from "./room-type-handlers.js";
import { getLLMClient, SCORING_MODEL } from "./llm-provider.js";
import type {
  RoomStateData,
  ScoringContext,
  TranscriptEntry,
  ProcessTurnResult,
  RoomStateResult,
} from "./types.js";
import { logger } from "../../utils/logger.js";

const MAX_CANDIDATES = 10;

// ─── LocalOrchestratorAdapter ─────────────────────────────────────────────────

export class LocalOrchestratorAdapter {
  private scoringEngine: ScoringEngine;
  private moderationAgent: ModerationAgent;
  private turnSelector: TurnSelector;
  private contractValidator: ContractValidator;

  constructor(
    private readonly messageRepo: MessageRepository,
    private readonly stateStore: RoomStateStore,
  ) {
    this.scoringEngine = new ScoringEngine();
    this.moderationAgent = new ModerationAgent();
    this.turnSelector = new TurnSelector();
    this.contractValidator = new ContractValidator();
  }

  // ─── Room lifecycle ──────────────────────────────────────────────────────────

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
    const state: RoomStateData = {
      roomId: room.id,
      hostAgentId: room.hostAgentId,
      roomType: room.type,
      status: room.status ?? "pending",
      roomObjective: room.objective ?? "Discussion",
      typeConfig: room.typeConfig ?? _buildTypeConfig(room),
      turnCount: 0,
      lastSpeakerId: null,
      messageQueue: [],
      transcript: [],
      contractSatisfaction: 0,
      completionLevel: "minimum",
      startedAt: null,
      completedAt: null,
    };

    await this.stateStore.createRoom(state);
    logger.info("Room registered in local orchestrator", { roomId: room.id });
  }

  async startRoom(roomId: string): Promise<void> {
    const state = await this._getOrCreateState(roomId);
    state.status = "live";
    state.startedAt = new Date().toISOString();
    await this.stateStore.updateRoom(state);
    logger.info("Room started in local orchestrator", { roomId });
  }

  async closeRoom(roomId: string, reason: string = "contract_satisfied"): Promise<void> {
    const state = await this._getOrCreateState(roomId);
    state.status = "completed";
    state.completedAt = new Date().toISOString();
    await this.stateStore.updateRoom(state);
    logger.info("Room closed in local orchestrator", { roomId, reason });
  }

  // ─── Room state ───────────────────────────────────────────────────────────────

  async getRoomState(roomId: string): Promise<RoomStateResult> {
    const state = await this.stateStore.getRoom(roomId);

    if (!state) {
      // Return a minimal 404-like result — callers fall back to basic validation
      throw new Error(`Room state not found for room ${roomId}`);
    }

    return {
      status: "ok",
      room_id: roomId,
      room_status: state.status,
      turn_count: state.turnCount,
      queue_size: state.messageQueue.length,
      contract_satisfaction: state.contractSatisfaction,
    };
  }

  // ─── Message submission ───────────────────────────────────────────────────────

  async submitMessage(roomId: string, message: { id: string; agentId: string; text: string }): Promise<void> {
    const state = await this._getOrCreateState(roomId);
    if (!state.messageQueue.includes(message.id)) {
      state.messageQueue.push(message.id);
      await this.stateStore.updateRoom(state);
    }
  }

  // ─── Core turn processing (replaces Python process_turn) ─────────────────────

  async processTurn(roomId: string): Promise<ProcessTurnResult> {
    // 1. Load room state (create minimal state from DB if missing in Redis)
    const state = await this._getOrCreateState(roomId);

    // Auto-start: if orchestrator state is "pending" but DB room is "live",
    // transition to live. This handles cases where startRoom() failed silently
    // (e.g. Redis error during agent join) or the radio-runner created the room
    // directly without going through the frontend join flow.
    if (state.status !== "live") {
      try {
        const { pool } = await import("../../config/database.js");
        const { rows } = await pool.query(
          `SELECT status FROM room WHERE id = $1`,
          [roomId],
        );
        if (rows.length > 0 && rows[0].status === "live") {
          logger.info("Auto-starting room in orchestrator (DB is live, orchestrator is pending)", { roomId });
          state.status = "live";
          state.startedAt = new Date().toISOString();
          await this.stateStore.updateRoom(state);
        } else {
          return { status: "error", error: `Room ${roomId} is not live (status: ${state.status})` };
        }
      } catch {
        return { status: "error", error: `Room ${roomId} is not live (status: ${state.status})` };
      }
    }

    // 2. Fetch candidate messages directly from DB (eliminates HTTP callback)
    const candidates = await this.messageRepo.getByRoomAndStatus(roomId, MessageStatus.CANDIDATE);
    const limited = candidates.slice(0, MAX_CANDIDATES);

    if (limited.length === 0) {
      return { status: "no_messages", turn_number: state.turnCount };
    }

    // 3. Build scoring context
    const handler = getHandler(state.roomType, state.typeConfig);
    const handlerWeights = handler.getScoringWeights();

    const context: ScoringContext = {
      roomId,
      roomType: state.roomType,
      roomObjective: state.roomObjective,
      transcriptHistory: state.transcript,
      participationHistory: this.turnSelector.countParticipation(state),
      weights: handlerWeights,
    };

    const scoringMessages = limited.map((m) => ({
      id: m.id,
      roomId: m.roomId,
      agentId: m.agentId,
      text: m.text,
      status: m.status,
      createdAt: m.createdAt,
    }));

    // 4. Score all candidates in parallel
    let scores = await this.scoringEngine.scoreBatch(scoringMessages, context);

    // 5. Apply moderation
    scores = await Promise.all(
      scores.map((s, i) => this.moderationAgent.updateScoringForViolations(s, scoringMessages[i])),
    );

    // 6. Update DB: mark all candidates as QUEUED (scored, awaiting turn selection) or
    //    REJECTED (failed moderation). No HTTP callback needed.
    await Promise.all(
      scores.map((s) =>
        this.messageRepo.updateStatus(
          s.messageId,
          s.isModerated ? MessageStatus.REJECTED : MessageStatus.QUEUED,
          { score: s.overallScore },
        ),
      ),
    );

    // 7. Select winner
    const selection = this.turnSelector.selectNextSpeaker(state, scores);

    if (!selection) {
      return {
        status: "no_valid_messages",
        turn_number: state.turnCount,
        error: "No candidates passed threshold or moderation",
      };
    }

    // 8. Mark winner as SELECTED in DB
    await this.messageRepo.updateStatus(selection.selectedMessageId, MessageStatus.SELECTED, {
      score: selection.score,
      selectedAt: selection.timestamp,
    });

    // 9. Update room state
    const winnerMsg = limited.find((m) => m.id === selection.selectedMessageId);
    const transcriptEntry: TranscriptEntry = {
      turn: selection.turnNumber,
      agentId: selection.selectedAgentId,
      messageId: selection.selectedMessageId,
      text: winnerMsg?.text ?? "",
      score: selection.score,
      timestamp: selection.timestamp.toISOString(),
    };

    state.turnCount = selection.turnNumber;
    state.lastSpeakerId = selection.selectedAgentId;
    state.transcript.push(transcriptEntry);
    // Remove processed message IDs from queue
    const processedIds = new Set(limited.map((m) => m.id));
    state.messageQueue = state.messageQueue.filter((id) => !processedIds.has(id));

    // 10. Evaluate contract
    const evaluation = this.contractValidator.evaluate(state);
    state.contractSatisfaction = evaluation.satisfaction;
    state.completionLevel = evaluation.level;

    // 11. Persist updated state
    await this.stateStore.updateRoom(state);

    logger.info("Turn processed locally", {
      roomId,
      turnNumber: selection.turnNumber,
      selectedMessageId: selection.selectedMessageId,
      agentId: selection.selectedAgentId,
      score: selection.score,
      contractSatisfaction: evaluation.satisfaction,
    });

    return {
      status: "success",
      turn_number: selection.turnNumber,
      selected_message_id: selection.selectedMessageId,
      selected_agent_id: selection.selectedAgentId,
      score: selection.score,
      completion_level: evaluation.level,
      contract_satisfaction: evaluation.satisfaction,
    };
  }

  // ─── Podcast / content generation ────────────────────────────────────────────

  async generatePodcastEpisode(request: {
    podcastId: string;
    episodeId: string;
    title: string;
    sourceUrls?: string[];
    format?: "monologue" | "dialogue";
  }): Promise<{
    episodeId: string;
    status: string;
    script: string;
    estimatedDurationSeconds: number;
    estimatedCostUsdc: number;
    estimatedTimeSeconds: number;
  }> {
    const format = request.format ?? "monologue";
    const script = await this._generatePodcastScript(request.title, request.sourceUrls ?? [], format);

    // Rough duration estimate: ~150 words/min TTS
    const wordCount = script.split(/\s+/).length;
    const estimatedDurationSeconds = Math.round((wordCount / 150) * 60);

    return {
      episodeId: request.episodeId,
      status: "ready",
      script,
      estimatedDurationSeconds,
      estimatedCostUsdc: 0,
      estimatedTimeSeconds: 0,
    };
  }

  async getPodcastEpisodeStatus(episodeId: string): Promise<{
    status: "draft" | "generating" | "ready" | "failed";
    audioUrl?: string;
    transcript?: string;
    durationSeconds?: number;
    errorMessage?: string;
  }> {
    // Episodes are generated synchronously — always ready once created
    return { status: "ready" };
  }

  async generateSummary(transcript: string): Promise<string> {
    if (!transcript.trim()) return "";

    try {
      const client = getLLMClient();
      const response = await client.messagesCreate({
        model: SCORING_MODEL,
        maxTokens: 512,
        messages: [
          {
            role: "user",
            content: `Summarize this AI agent conversation transcript in 3-5 concise sentences:\n\n${transcript.slice(0, 8000)}`,
          },
        ],
      });
      return response.content[0]?.text?.trim() ?? "";
    } catch (err) {
      logger.warn("Summary generation failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return "";
    }
  }

  // ─── Private helpers ──────────────────────────────────────────────────────────

  private async _getOrCreateState(roomId: string): Promise<RoomStateData> {
    const existing = await this.stateStore.getRoom(roomId);
    if (existing) return existing;

    // Redis state was wiped or never created — recover from DB.
    // The radio-runner creates rooms with status "live" in the DB, so we
    // must check the actual DB status instead of defaulting to "pending",
    // otherwise processTurn() will reject every turn for radio rooms.
    let dbStatus = "pending";
    let dbRoomType = "custom";
    let dbObjective = "";
    let dbHostAgentId = "";
    try {
      const { pool } = await import("../../config/database.js");
      const { rows } = await pool.query(
        `SELECT status, type, objective, host_agent_id FROM room WHERE id = $1`,
        [roomId],
      );
      if (rows.length > 0) {
        dbStatus = rows[0].status;
        dbRoomType = rows[0].type || "custom";
        dbObjective = rows[0].objective || "";
        dbHostAgentId = rows[0].host_agent_id || "";
      }
    } catch {
      // DB unavailable — fall back to defaults
    }

    const minimal: RoomStateData = {
      roomId,
      hostAgentId: dbHostAgentId,
      roomType: dbRoomType,
      status: dbStatus,
      roomObjective: dbObjective,
      typeConfig: {},
      turnCount: 0,
      lastSpeakerId: null,
      messageQueue: [],
      transcript: [],
      contractSatisfaction: 0,
      completionLevel: "minimum",
      startedAt: new Date().toISOString(),
      completedAt: null,
    };

    await this.stateStore.createRoom(minimal);
    return minimal;
  }

  private async _generatePodcastScript(
    title: string,
    sourceUrls: string[],
    format: "monologue" | "dialogue",
  ): Promise<string> {
    try {
      const client = getLLMClient();
      const sourcesStr = sourceUrls.length > 0 ? `\nSources: ${sourceUrls.join(", ")}` : "";
      const prompt = format === "dialogue"
        ? `Write a short podcast dialogue script (2 hosts) about: "${title}"${sourcesStr}. Keep it under 500 words.`
        : `Write a short podcast monologue script about: "${title}"${sourcesStr}. Keep it under 500 words.`;

      const response = await client.messagesCreate({
        model: SCORING_MODEL,
        maxTokens: 1024,
        messages: [{ role: "user", content: prompt }],
      });
      return response.content[0]?.text?.trim() ?? "";
    } catch {
      return `Podcast episode: ${title}`;
    }
  }
}

// ─── Utility: replicate type-config builder from orchestrator-client.ts ──────

function _buildTypeConfig(room: { type: string; objective?: string }): Record<string, unknown> {
  switch (room.type) {
    case "debate":
      return { topic: room.objective ?? "General Debate", speaking_order: "free-form", sides: 2 };
    case "coding":
      return { language: "javascript", problem_statement: room.objective ?? "Build a feature", difficulty: "medium", test_required: false };
    case "research":
      return { domain: "general", methodology: "empirical", research_question: room.objective ?? "Explore a topic", citation_required: false };
    case "trading":
      return { asset_class: "crypto", instrument: "general", timeframe: "1d", risk_tolerance: "moderate", disclaimer: "None" };
    case "simulation":
      return { scenario_name: "Sim", scenario_description: room.objective ?? "Simulation", constraints: [], success_definition: "Done", difficulty: "intermediate" };
    default:
      return {
        template_used: "blank",
        custom_name: room.type,
        custom_description: room.objective ?? "Custom Room",
        success_criteria: "Host decides",
        validation_rules: [],
        custom_scoring_weights: { relevance: 0.35, novelty: 0.25, coherence: 0.20, actionability: 0.15, engagement: 0.05 },
        min_turns_required: 4,
        max_turns_standard: 8,
        max_turns_exceptional: 12,
      };
  }
}
