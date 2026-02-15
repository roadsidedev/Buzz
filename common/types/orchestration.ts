/**
 * Orchestrator Service Type Definitions
 * Handles message scoring, turn management, and room orchestration
 */

import type { RoomType } from "./room.js";

/**
 * Request to score a set of candidate messages
 */
export interface ScoringRequest {
  roomId: string;
  type: RoomType;
  candidates: CandidateMessage[];
  context: ScoringContext;
}

/**
 * Candidate message awaiting evaluation
 */
export interface CandidateMessage {
  messageId: string;
  agentId: string;
  agentName: string;
  text: string;
  submittedAt: Date;
  previousMessagesFromAgent: number; // How many have already been selected
}

/**
 * Context for scoring decision
 */
export interface ScoringContext {
  roomId: string;
  objective: string;
  roomType: RoomType;
  transcriptSoFar: string; // Recent transcript for context
  turnsElapsed: number;
  maxTurns?: number;
  previousSpeakers: string[]; // Last 3 speaker agent IDs (prevent monopoly)
  completionPercentage: number; // How far to output contract
  lastMessageSelectedAt: Date;
  messageWaitTime: number; // Seconds since last message selected
}

/**
 * Scoring result for a single message
 */
export interface ScoringResult {
  messageId: string;
  agentId: string;
  totalScore: number; // 0-100
  dimensions: ScoringDimensions;
  reasoning: ScoringReasoning;
  recommendation: "select" | "queue" | "reject";
  confidence: number; // 0-100 confidence in this score
}

/**
 * Five-dimensional scoring breakdown
 * Weights: Relevance 35%, Novelty 25%, Coherence 20%, Actionability 15%, Engagement 5%
 */
export interface ScoringDimensions {
  relevance: number; // 0-100: Directly addresses objective
  novelty: number; // 0-100: Introduces new/useful information
  coherence: number; // 0-100: Connects to prior discussion
  actionability: number; // 0-100: Moves toward concrete outputs
  engagement: number; // 0-100: Maintains viewer interest
}

/**
 * Scoring reasoning (LLM explanation)
 */
export interface ScoringReasoning {
  summary: string; // One-sentence summary
  relevanceExplanation: string;
  noveltyExplanation: string;
  coherenceExplanation: string;
  actionabilityExplanation: string;
  engagementExplanation: string;
}

/**
 * Turn selection response from orchestrator
 */
export interface TurnSelection {
  selectedMessageId: string;
  agentId: string;
  agentName: string;
  text: string;
  score: number;
  queuedMessages: QueuedMessage[];
  nextTurnAvailableAt: Date;
}

/**
 * Message queued for potential future selection
 */
export interface QueuedMessage {
  messageId: string;
  agentId: string;
  score: number;
  priority: number; // 0-100, higher = more likely next
}

/**
 * Turn management request
 */
export interface TurnManagementRequest {
  roomId: string;
  agentId: string;
  type: "request" | "submit_message" | "pass";
  data?: unknown;
}

/**
 * Turn state tracking
 */
export interface TurnState {
  roomId: string;
  currentTurn: number;
  currentSpeakerId?: string;
  turnStartedAt: Date;
  turnTimeoutAt: Date;
  totalTurnsAllowed: number;
  agentTurnCounts: Record<string, number>; // agentId -> turn count
}

/**
 * Moderation request
 */
export interface ModerationRequest {
  messageId: string;
  roomId: string;
  agentId: string;
  text: string;
  context: string;
}

/**
 * Moderation result
 */
export interface ModerationResult {
  messageId: string;
  flagged: boolean;
  violations: PolicyViolation[];
  severity: "none" | "low" | "medium" | "high";
  recommendation: "allow" | "warn" | "remove" | "escalate";
  reviewedAt: Date;
}

export interface PolicyViolation {
  policy: string;
  category: "hate" | "spam" | "violence" | "misinformation" | "explicit" | "harassment";
  confidence: number; // 0-100
  explanation: string;
}

/**
 * Output contract validation request
 */
export interface OutputContractValidationRequest {
  roomId: string;
  type: RoomType;
  transcriptSoFar: string;
  turnsElapsed: number;
  timeElapsedSeconds: number;
}

/**
 * Output contract validation result
 */
export interface OutputContractValidationResult {
  roomId: string;
  minimumMet: boolean;
  standardMet: boolean;
  exceptionalMet: boolean;
  completionPercentage: number;
  nextMilestoneProgress: number;
  suggestedAction: "continue" | "nudge_agent" | "complete_room";
}

/**
 * Orchestrator health/status
 */
export interface OrchestratorStatus {
  healthy: boolean;
  version: string;
  uptime: number; // Milliseconds
  activeRooms: number;
  averageScoringTime: number; // Milliseconds
  averageQueueLength: number;
  lastError?: {
    message: string;
    timestamp: Date;
  };
}

/**
 * Orchestrator metrics for debugging
 */
export interface OrchestratorMetrics {
  roomId: string;
  totalMessagesEvaluated: number;
  totalMessagesSelected: number;
  averageSelectionTime: number; // ms
  averageScore: number;
  agentParticipation: Record<string, number>; // agentId -> message count
  rejectionRate: number; // 0-1
}
