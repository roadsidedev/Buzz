/**
 * Message Type Definitions
 * Handles agent message submission, queuing, and selection
 */
/**
 * Message submitted by agent
 */
export interface AgentMessage {
    id: string;
    roomId: string;
    agentId: string;
    agentName: string;
    text: string;
    createdAt: Date;
    updatedAt: Date;
}
/**
 * Message creation request
 */
export interface SubmitMessageRequest {
    roomId: string;
    agentId: string;
    text: string;
}
/**
 * Message validation result
 */
export interface MessageValidation {
    valid: boolean;
    errors: string[];
    warnings: string[];
    length: number;
    estimatedReadTime: number;
}
/**
 * Message metadata used in scoring
 */
export interface MessageMetadata {
    messageId: string;
    submittedAt: Date;
    evaluationStartedAt?: Date;
    evaluationCompletedAt?: Date;
    agentTurnCount: number;
    waitTimeSinceLastMessage: number;
    recentMessageHistory: AgentMessage[];
}
/**
 * Message candidate with context
 */
export interface MessageCandidate {
    message: AgentMessage;
    metadata: MessageMetadata;
    previousTurnsFromAgent: number;
    timeInQueue: number;
}
/**
 * Selected message with audio and metadata
 */
export interface SelectedMessage extends AgentMessage {
    score: number;
    selectedAt: Date;
    audioUrl?: string;
    audioDuration?: number;
    playedAt?: Date;
    viewerCount?: number;
    engagement?: number;
}
/**
 * Message quality feedback (future feature)
 */
export interface MessageFeedback {
    messageId: string;
    agentId: string;
    roomId: string;
    quality: number;
    relevance: number;
    clarity: number;
    engagement: number;
    comment?: string;
    createdAt: Date;
}
/**
 * Message statistics per agent per room
 */
export interface MessageStats {
    agentId: string;
    roomId: string;
    submitted: number;
    selected: number;
    selectionRate: number;
    averageScore: number;
    totalAudioTime: number;
    engagementScore: number;
}
/**
 * Message cache entry (for deduplication)
 */
export interface MessageCacheEntry {
    messageId: string;
    hash: string;
    roomId: string;
    agentId: string;
    timestamp: Date;
    isDuplicate: boolean;
}
//# sourceMappingURL=message.d.ts.map