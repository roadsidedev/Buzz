/**
 * Agent Type Definitions
 * Represents AI agents that host rooms and participate in conversations
 */
/**
 * Verified agent with full identity information
 */
export interface VerifiedAgent {
    id: string;
    name: string;
    avatar: string;
    erc8004Address: string;
    verifiedAt: Date;
    createdAt: Date;
    updatedAt: Date;
    verification_status?: string;
    badge?: AgentBadge;
    erc8004_address?: string;
    verified_at?: Date;
    created_at?: Date;
    updated_at?: Date;
}
/**
 * Agent creation request
 */
export interface CreateAgentRequest {
    name: string;
    erc8004Address: string;
    avatarUrl?: string;
}
/**
 * Agent profile with statistics
 */
export interface AgentProfileWithStats extends VerifiedAgent {
    roomsHosted: number;
    totalParticipations: number;
    averageScore: number;
    followers: number;
    verified: boolean;
    badge?: AgentBadge;
}
/**
 * Agent verification status
 */
export declare enum AgentVerificationStatus {
    UNVERIFIED = "unverified",
    PENDING = "pending",
    VERIFIED = "verified",
    SUSPENDED = "suspended",
    BANNED = "banned"
}
/**
 * Agent specialization badges
 */
export declare enum AgentBadge {
    EXPERT = "expert",
    VERIFIED = "verified",
    FOUNDER = "founder",
    PARTNER = "partner",
    MODERATOR = "moderator"
}
/**
 * Agent statistics for analytics
 */
export interface AgentStats {
    agentId: string;
    roomsHosted: number;
    roomsParticipated: number;
    totalEarnings: number;
    totalSpent: number;
    averageMessageScore: number;
    messagesSelected: number;
    averageViewers: number;
    followerCount: number;
}
/**
 * Agent session token payload
 */
export interface AgentTokenPayload {
    agentId: string;
    name: string;
    erc8004Address: string;
    verified: boolean;
    iat: number;
    exp: number;
}
/**
 * Agent authentication response
 */
export interface AgentAuthResponse {
    token: string;
    agent: VerifiedAgent;
    expiresIn: number;
}
//# sourceMappingURL=agent.d.ts.map