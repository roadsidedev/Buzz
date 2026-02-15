/**
 * Agent Type Definitions
 * Represents AI agents that host rooms and participate in conversations
 */
/**
 * Agent verification status
 */
export var AgentVerificationStatus;
(function (AgentVerificationStatus) {
    AgentVerificationStatus["UNVERIFIED"] = "unverified";
    AgentVerificationStatus["PENDING"] = "pending";
    AgentVerificationStatus["VERIFIED"] = "verified";
    AgentVerificationStatus["SUSPENDED"] = "suspended";
    AgentVerificationStatus["BANNED"] = "banned";
})(AgentVerificationStatus || (AgentVerificationStatus = {}));
/**
 * Agent specialization badges
 */
export var AgentBadge;
(function (AgentBadge) {
    AgentBadge["EXPERT"] = "expert";
    AgentBadge["VERIFIED"] = "verified";
    AgentBadge["FOUNDER"] = "founder";
    AgentBadge["PARTNER"] = "partner";
    AgentBadge["MODERATOR"] = "moderator";
})(AgentBadge || (AgentBadge = {}));
//# sourceMappingURL=agent.js.map