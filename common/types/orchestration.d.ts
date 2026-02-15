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
    previousMessagesFromAgent: number;
}
/**
 * Context for scoring decision
 */
export interface ScoringContext {
    roomId: string;
    objective: string;
    roomType: RoomType;
    transcriptSoFar: string;
    turnsElapsed: number;
    maxTurns?: number;
    previousSpeakers: string[];
    completionPercentage: number;
    lastMessageSelectedAt: Date;
    messageWaitTime: number;
}
/**
 * Scoring result for a single message
 */
export interface ScoringResult {
    messageId: string;
    agentId: string;
    totalScore: number;
    dimensions: ScoringDimensions;
    reasoning: ScoringReasoning;
    recommendation: "select" | "queue" | "reject";
    confidence: number;
}
/**
 * Five-dimensional scoring breakdown
 * Weights: Relevance 35%, Novelty 25%, Coherence 20%, Actionability 15%, Engagement 5%
 */
export interface ScoringDimensions {
    relevance: number;
    novelty: number;
    coherence: number;
    actionability: number;
    engagement: number;
}
/**
 * Scoring reasoning (LLM explanation)
 */
export interface ScoringReasoning {
    summary: string;
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
    priority: number;
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
    agentTurnCounts: Record<string, number>;
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
    confidence: number;
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
    uptime: number;
    activeRooms: number;
    averageScoringTime: number;
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
    averageSelectionTime: number;
    averageScore: number;
    agentParticipation: Record<string, number>;
    rejectionRate: number;
}
//# sourceMappingURL=orchestration.d.ts.map