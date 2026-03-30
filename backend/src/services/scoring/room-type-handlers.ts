/**
 * Room Type Handlers
 *
 * Port of orchestrator/src/services/room_type_handlers.py
 *
 * Each room type overrides the default scoring weights, validates message
 * content, and extracts type-specific output artifacts from the transcript.
 */

import type { ScoringWeights, TranscriptEntry } from "./types.js";

// ─── Handler interface ────────────────────────────────────────────────────────

export interface RoomTypeHandler {
  getScoringWeights(): ScoringWeights;
  validateMessageContent(text: string, config: Record<string, unknown>): boolean;
  evaluateContractProgress(turnCount: number, minTurns: number): number; // 0-100
  extractArtifacts(transcript: TranscriptEntry[]): Record<string, unknown>;
}

// ─── Default weights (mirrors Python settings defaults) ───────────────────────

const DEFAULT_WEIGHTS: ScoringWeights = {
  relevance: 0.35,
  novelty: 0.25,
  coherence: 0.20,
  actionability: 0.15,
  engagement: 0.05,
};

// ─── Concrete handlers ────────────────────────────────────────────────────────

class DebateHandler implements RoomTypeHandler {
  getScoringWeights(): ScoringWeights {
    // Debate: argumentation quality prioritises novelty of argument and coherence;
    // relevance stays high; actionability is low (debate rarely ends with actions).
    // Sum: 0.35 + 0.30 + 0.25 + 0.05 + 0.05 = 1.00
    return { relevance: 0.35, novelty: 0.30, coherence: 0.25, actionability: 0.05, engagement: 0.05 };
  }

  validateMessageContent(text: string): boolean {
    return text.trim().length > 0;
  }

  evaluateContractProgress(turnCount: number, minTurns: number): number {
    return Math.min(100, (turnCount / minTurns) * 100);
  }

  extractArtifacts(transcript: TranscriptEntry[]): Record<string, unknown> {
    return {
      positions: [...new Set(transcript.map((t) => t.agentId))],
      total_turns: transcript.length,
      transcript_summary: transcript.map((t) => ({ turn: t.turn, agent: t.agentId, score: t.score })),
    };
  }
}

class CodingHandler implements RoomTypeHandler {
  getScoringWeights(): ScoringWeights {
    // Coding: coherence of the solution and concrete actionability (actual code) matter most;
    // novelty and relevance are lower; engagement minimal.
    // Sum: 0.25 + 0.20 + 0.30 + 0.20 + 0.05 = 1.00
    return { relevance: 0.25, novelty: 0.20, coherence: 0.30, actionability: 0.20, engagement: 0.05 };
  }

  validateMessageContent(text: string): boolean {
    return text.trim().length > 0;
  }

  evaluateContractProgress(turnCount: number, minTurns: number): number {
    return Math.min(100, (turnCount / minTurns) * 100);
  }

  extractArtifacts(transcript: TranscriptEntry[]): Record<string, unknown> {
    const codeBlocks = transcript
      .map((t) => t.text)
      .filter((t) => t.includes("```") || t.includes("function") || t.includes("class "));
    return {
      code_snippets_found: codeBlocks.length,
      contributors: [...new Set(transcript.map((t) => t.agentId))],
      total_turns: transcript.length,
    };
  }
}

class ResearchHandler implements RoomTypeHandler {
  getScoringWeights(): ScoringWeights {
    return { ...DEFAULT_WEIGHTS, relevance: 0.35, novelty: 0.30, coherence: 0.20, actionability: 0.10 };
  }

  validateMessageContent(text: string): boolean {
    return text.trim().length > 0;
  }

  evaluateContractProgress(turnCount: number, minTurns: number): number {
    return Math.min(100, (turnCount / minTurns) * 100);
  }

  extractArtifacts(transcript: TranscriptEntry[]): Record<string, unknown> {
    return {
      research_contributors: [...new Set(transcript.map((t) => t.agentId))],
      total_turns: transcript.length,
      average_score: transcript.length
        ? transcript.reduce((s, t) => s + t.score, 0) / transcript.length
        : 0,
    };
  }
}

class TradingHandler implements RoomTypeHandler {
  getScoringWeights(): ScoringWeights {
    // Trading: actionability (concrete trade setups) and relevance (to the market/asset)
    // dominate; coherence of analysis is important; engagement is irrelevant.
    // Sum: 0.30 + 0.15 + 0.25 + 0.25 + 0.05 = 1.00
    return { relevance: 0.30, novelty: 0.15, coherence: 0.25, actionability: 0.25, engagement: 0.05 };
  }

  validateMessageContent(text: string): boolean {
    return text.trim().length > 0;
  }

  evaluateContractProgress(turnCount: number, minTurns: number): number {
    return Math.min(100, (turnCount / minTurns) * 100);
  }

  extractArtifacts(transcript: TranscriptEntry[]): Record<string, unknown> {
    return {
      analysts: [...new Set(transcript.map((t) => t.agentId))],
      total_turns: transcript.length,
    };
  }
}

class SimulationHandler implements RoomTypeHandler {
  getScoringWeights(): ScoringWeights {
    // Simulation: scenario coherence is paramount; actionability (decisions/moves) is high;
    // relevance to scenario objective matters; novelty of actions is secondary.
    // Sum: 0.25 + 0.15 + 0.35 + 0.20 + 0.05 = 1.00
    return { relevance: 0.25, novelty: 0.15, coherence: 0.35, actionability: 0.20, engagement: 0.05 };
  }

  validateMessageContent(text: string): boolean {
    return text.trim().length > 0;
  }

  evaluateContractProgress(turnCount: number, minTurns: number): number {
    return Math.min(100, (turnCount / minTurns) * 100);
  }

  extractArtifacts(transcript: TranscriptEntry[]): Record<string, unknown> {
    return {
      participants: [...new Set(transcript.map((t) => t.agentId))],
      total_turns: transcript.length,
    };
  }
}

class CustomHandler implements RoomTypeHandler {
  constructor(private readonly typeConfig: Record<string, unknown>) {}

  getScoringWeights(): ScoringWeights {
    const custom = this.typeConfig.custom_scoring_weights as Partial<ScoringWeights> | undefined;
    if (!custom) return DEFAULT_WEIGHTS;
    return {
      relevance: custom.relevance ?? DEFAULT_WEIGHTS.relevance,
      novelty: custom.novelty ?? DEFAULT_WEIGHTS.novelty,
      coherence: custom.coherence ?? DEFAULT_WEIGHTS.coherence,
      actionability: custom.actionability ?? DEFAULT_WEIGHTS.actionability,
      engagement: custom.engagement ?? DEFAULT_WEIGHTS.engagement,
    };
  }

  validateMessageContent(text: string): boolean {
    return text.trim().length > 0;
  }

  evaluateContractProgress(turnCount: number, minTurns: number): number {
    return Math.min(100, (turnCount / minTurns) * 100);
  }

  extractArtifacts(transcript: TranscriptEntry[]): Record<string, unknown> {
    return {
      participants: [...new Set(transcript.map((t) => t.agentId))],
      total_turns: transcript.length,
    };
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function getHandler(
  roomType: string,
  typeConfig: Record<string, unknown> = {},
): RoomTypeHandler {
  switch (roomType.toLowerCase()) {
    case "debate":
      return new DebateHandler();
    case "coding":
      return new CodingHandler();
    case "research":
      return new ResearchHandler();
    case "trading":
      return new TradingHandler();
    case "simulation":
      return new SimulationHandler();
    default:
      return new CustomHandler(typeConfig);
  }
}
