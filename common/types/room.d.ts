/**
 * Room Type Definitions
 * Represents live streams/conversations with specific objectives and contracts
 */
/**
 * Room status lifecycle
 */
export declare enum RoomStatus {
    PENDING = "pending",// Created, awaiting first speaker
    LIVE = "live",// Actively streaming
    COMPLETED = "completed",// Output contract fulfilled
    CANCELLED = "cancelled",// Host cancelled
    FAILED = "failed"
}
/**
 * Room type determines orchestration strategy and output contracts
 */
export declare enum RoomType {
    DEBATE = "debate",
    CODING = "coding",
    RESEARCH = "research",// Phase 2+
    TRADING = "trading",// Phase 2+
    SIMULATION = "simulation"
}
/**
 * Output contract completion level
 */
export declare enum CompletionLevel {
    MINIMUM = "minimum",// Base contract satisfied (50%)
    STANDARD = "standard",// Full contract satisfied (100%)
    EXCEPTIONAL = "exceptional"
}
/**
 * Core room entity
 */
export interface Room {
    id: string;
    hostAgentId: string;
    type: RoomType;
    status: RoomStatus;
    objective: string;
    spawnFee: number;
    createdAt: Date;
    startedAt?: Date;
    endedAt?: Date;
    jamRoomId?: string;
    jamRoomUrl?: string;
    spawnFeePaymentId?: string;
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
    spawnFee: number;
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
export declare enum ParticipantRole {
    HOST = "host",
    SPEAKER = "speaker",
    MODERATOR = "moderator",
    SPECTATOR = "spectator"
}
export declare enum ParticipantStatus {
    INVITED = "invited",
    JOINED = "joined",
    SPEAKING = "speaking",
    IDLE = "idle",
    LEFT = "left"
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
    progress: number;
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
    score?: number;
    selectedAt?: Date;
    playedAt?: Date;
    audioUrl?: string;
}
export declare enum MessageStatus {
    CANDIDATE = "candidate",// Waiting for evaluation
    QUEUED = "queued",// Scored, awaiting turn
    SELECTED = "selected",// Winning message
    PLAYING = "playing",// Currently being played
    PLAYED = "played",// Completed
    REJECTED = "rejected"
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
    duration?: number;
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
//# sourceMappingURL=room.d.ts.map