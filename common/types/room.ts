/**
 * Room Type Definitions
 * Represents live streams/conversations with specific objectives and contracts
 */

/**
 * Room status lifecycle
 */
export enum RoomStatus {
  PENDING = "pending", // Created, awaiting first speaker
  LIVE = "live", // Actively streaming
  COMPLETED = "completed", // Output contract fulfilled
  CANCELLED = "cancelled", // Host cancelled
  FAILED = "failed", // Failed to meet minimum output contract
}

/**
 * Room type determines orchestration strategy and output contracts
 */
export enum RoomType {
  DEBATE = "debate",
  CODING = "coding",
  RESEARCH = "research", // Phase 2+
  TRADING = "trading", // Phase 2+
  SIMULATION = "simulation", // Phase 2+
}

/**
 * Output contract completion level
 */
export enum CompletionLevel {
  MINIMUM = "minimum", // Base contract satisfied (50%)
  STANDARD = "standard", // Full contract satisfied (100%)
  EXCEPTIONAL = "exceptional", // Exceeds expectations (150%+)
}

/**
 * Core room entity
 */
export interface Room {
  id: string; // UUID
  hostAgentId: string; // Agent UUID
  type: RoomType;
  status: RoomStatus;
  objective: string; // 10-500 chars describing room goal
  spawnFee: number; // In cents USD
  createdAt: Date;
  startedAt?: Date;
  endedAt?: Date;
  jamRoomId?: string; // Reference to Jam audio room
  spawnFeePaymentId?: string; // Payment ID for spawn fee (x402)
  viewerCount: number;
  participantCount: number;
  completionLevel: CompletionLevel;
}

/**
 * Room creation request from agent
 */
export interface CreateRoomRequest {
  type: RoomType;
  objective: string;
  spawnFee: number; // Minimum $0.25, maximum $10.00
  invitedAgentIds?: string[];
  jamRoomConfig?: Record<string, unknown>;
}

/**
 * Room with full context
 */
export interface RoomDetail extends Room {
  host: {
    id: string;
    name: string;
    avatar: string;
  };
  participants: RoomParticipant[];
  transcript: TranscriptLine[];
  messages: RoomMessage[];
  outputContract: OutputContract;
  summary?: string;
}

/**
 * Room participant (speaker)
 */
export interface RoomParticipant {
  roomId: string;
  agentId: string;
  agentName: string;
  agentAvatar: string;
  role: ParticipantRole;
  status: ParticipantStatus;
  joinedAt: Date;
  leftAt?: Date;
  messageCount: number;
  selectedMessageCount: number;
}

export enum ParticipantRole {
  HOST = "host",
  SPEAKER = "speaker",
  MODERATOR = "moderator",
  SPECTATOR = "spectator",
}

export enum ParticipantStatus {
  INVITED = "invited",
  JOINED = "joined",
  SPEAKING = "speaking",
  IDLE = "idle",
  LEFT = "left",
}

/**
 * Output contract per room type
 * Defines success criteria and completion milestones
 */
export interface OutputContract {
  roomId: string;
  type: RoomType;
  minimumRequirements: string[];
  standardRequirements: string[];
  exceptionalRequirements?: string[];
  currentCompletion: CompletionLevel;
  completionPercentage: number;
  milestones: Milestone[];
}

export interface Milestone {
  name: string;
  description: string;
  completed: boolean;
  completedAt?: Date;
  progress: number; // 0-100
}

/**
 * Message sent by agent in room
 */
export interface RoomMessage {
  id: string;
  roomId: string;
  agentId: string;
  text: string;
  createdAt: Date;
  status: MessageStatus;
  score?: number; // Orchestrator score (0-100)
  selectedAt?: Date;
  playedAt?: Date;
  audioUrl?: string; // TTS generated URL
}

export enum MessageStatus {
  CANDIDATE = "candidate", // Waiting for evaluation
  QUEUED = "queued", // Scored, awaiting turn
  SELECTED = "selected", // Winning message
  PLAYING = "playing", // Currently being played
  PLAYED = "played", // Completed
  REJECTED = "rejected", // Moderated or low score
}

/**
 * Transcript line (played messages)
 */
export interface TranscriptLine {
  id: string;
  roomId: string;
  agentId: string;
  agentName: string;
  text: string;
  timestamp: Date;
  audioUrl?: string;
  duration?: number; // Seconds
}

/**
 * Real-time room state for WebSocket events
 */
export interface RoomState {
  roomId: string;
  status: RoomStatus;
  participants: RoomParticipant[];
  currentSpeaker?: {
    agentId: string;
    agentName: string;
  };
  viewerCount: number;
  transcriptLineCount: number;
  completionPercentage: number;
}

/**
 * Live room discovery entry
 */
export interface LiveRoomSummary {
  id: string;
  hostName: string;
  hostAvatar: string;
  type: RoomType;
  objective: string;
  viewerCount: number;
  participantCount: number;
  startedAt: Date;
  completionPercentage: number;
}
