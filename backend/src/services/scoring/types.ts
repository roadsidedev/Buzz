/**
 * Scoring Module — Internal TypeScript Type Definitions
 *
 * These types mirror the Python orchestrator's Pydantic models so that the
 * serialised Redis state is wire-compatible with any in-flight keys written
 * by the old Python service during cut-over.
 */

// ─── Message ─────────────────────────────────────────────────────────────────

export interface ScoringMessage {
  id: string;
  roomId: string;
  agentId: string;
  text: string;
  status: string;
  createdAt: Date;
}

// ─── Scoring weights ─────────────────────────────────────────────────────────

export interface ScoringWeights {
  relevance: number;      // default 0.35
  novelty: number;        // default 0.25
  coherence: number;      // default 0.20
  actionability: number;  // default 0.15
  engagement: number;     // default 0.05
}

export interface TranscriptEntry {
  turn: number;
  agentId: string;
  messageId: string;
  text: string;
  score: number;
  timestamp: string;
}

export interface ScoringContext {
  roomId: string;
  roomType: string;
  roomObjective: string;
  transcriptHistory: TranscriptEntry[];
  participationHistory: Record<string, number>; // agentId -> turn count
  weights: ScoringWeights;
}

// ─── Scoring results ──────────────────────────────────────────────────────────

export interface ScoringResult {
  messageId: string;
  agentId: string;
  overallScore: number;
  relevanceScore: number;
  noveltyScore: number;
  coherenceScore: number;
  actionabilityScore: number;
  engagementScore: number;
  reasoning: string;
  strengths: string[];
  weaknesses: string[];
  isModerated: boolean;
  moderationReason?: string;
  fallbackTriggered?: boolean;
}

// ─── Moderation ───────────────────────────────────────────────────────────────

export type ViolationType =
  | "hate_speech"
  | "harassment"
  | "misinformation"
  | "violence"
  | "spam"
  | "adult_content";

export interface ModerationResult {
  isSafe: boolean;
  violationType?: ViolationType;
  explanation: string;
  confidence: number;
}

// ─── Turn selection ───────────────────────────────────────────────────────────

export interface TurnSelection {
  turnNumber: number;
  selectedMessageId: string;
  selectedAgentId: string;
  score: number;
  runnerUps: string[];
  timestamp: Date;
}

// ─── Room state (Redis-backed) ────────────────────────────────────────────────

/**
 * In-memory representation of room orchestration state.
 * Serialised to Redis as a JSON object matching the Python
 * _serialize_room_state output shape for wire compatibility.
 */
export interface RoomStateData {
  roomId: string;
  roomType: string;
  roomObjective: string;
  status: string;
  hostAgentId: string;
  turnCount: number;
  lastSpeakerId: string | null;
  messageQueue: string[];         // pending message IDs
  transcript: TranscriptEntry[];
  contractSatisfaction: number;   // 0–100
  completionLevel: "minimum" | "standard" | "exceptional";
  startedAt: string | null;
  completedAt: string | null;
  typeConfig: Record<string, unknown>;
}

// ─── Contract validation ──────────────────────────────────────────────────────

export interface ContractSpec {
  roomType: string;
  minimumTurns: number;
  standardTurns: number;
  exceptionalTurns: number;
  successCriteria: string[];
}

export interface ContractEvaluation {
  level: "minimum" | "standard" | "exceptional";
  satisfaction: number;         // 0–100
  unfulfilledCriteria: string[];
  shouldClose: boolean;
}

// ─── Process turn result (maps to ProcessTurnResponse in orchestrator-client.ts) ─

export interface ProcessTurnResult {
  status: "success" | "no_messages" | "no_valid_messages" | "fetch_failed" | "selection_failed" | "error";
  turn_number?: number;
  selected_message_id?: string;
  selected_agent_id?: string;
  score?: number;
  completion_level?: string;
  contract_satisfaction?: number;
  error?: string;
}

// ─── Room state result (maps to RoomStateResponse in orchestrator-client.ts) ──

export interface RoomStateResult {
  status: string;
  room_id: string;
  room_status: string;
  turn_count: number;
  queue_size: number;
  contract_satisfaction: number;
}
