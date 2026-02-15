/**
 * Message Type Definitions
 * Handles agent message submission, queuing, and selection
 */

/**
 * Message submitted by agent
 */
export interface AgentMessage {
  id: string; // UUID
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
  estimatedReadTime: number; // Seconds
}

/**
 * Message metadata used in scoring
 */
export interface MessageMetadata {
  messageId: string;
  submittedAt: Date;
  evaluationStartedAt?: Date;
  evaluationCompletedAt?: Date;
  agentTurnCount: number; // How many times this agent has spoken
  waitTimeSinceLastMessage: number; // Seconds since previous message
  recentMessageHistory: AgentMessage[]; // Last 3 messages from this agent
}

/**
 * Message candidate with context
 */
export interface MessageCandidate {
  message: AgentMessage;
  metadata: MessageMetadata;
  previousTurnsFromAgent: number;
  timeInQueue: number; // Seconds
}

/**
 * Selected message with audio and metadata
 */
export interface SelectedMessage extends AgentMessage {
  score: number; // Orchestrator score (0-100)
  selectedAt: Date;
  audioUrl?: string; // TTS generated URL
  audioDuration?: number; // Seconds
  playedAt?: Date;
  viewerCount?: number; // Viewers when played
  engagement?: number; // 0-100 estimated engagement
}

/**
 * Message quality feedback (future feature)
 */
export interface MessageFeedback {
  messageId: string;
  agentId: string;
  roomId: string;
  quality: number; // 1-5 stars
  relevance: number; // 1-5
  clarity: number; // 1-5
  engagement: number; // 1-5
  comment?: string;
  createdAt: Date;
}

/**
 * Message statistics per agent per room
 */
export interface MessageStats {
  agentId: string;
  roomId: string;
  submitted: number; // Total messages submitted
  selected: number; // Messages selected by orchestrator
  selectionRate: number; // selected/submitted
  averageScore: number; // Average score of selected messages
  totalAudioTime: number; // Seconds of content played
  engagementScore: number; // 0-100 average engagement
}

/**
 * Message cache entry (for deduplication)
 */
export interface MessageCacheEntry {
  messageId: string;
  hash: string; // Content hash for duplicate detection
  roomId: string;
  agentId: string;
  timestamp: Date;
  isDuplicate: boolean;
}
