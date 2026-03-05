// @ts-nocheck
/**
 * Service layer exports — v2 (Moltbook-style auth)
 *
 * Exports the new ClawZz auth service, verification challenge service,
 * and all other platform services.
 */

import { ClawzzAuthService } from "./clawzz-auth-service.js";
import { VerificationChallengeService } from "./verification-challenge-service.js";
import { db } from "../config/database.js";

export { AgentService, agentService } from "./agent-service.js";
export { RoomService, roomService } from "./room-service.js";
export { PaymentService, paymentService } from "./payment-service.js";
export { PodcastService, podcastService } from "./podcast-service.js";
export { OrchestratorClient, orchestratorClient } from "./orchestrator-client.js";
export { ClawzzAuthService } from "./clawzz-auth-service.js";
export { VerificationChallengeService } from "./verification-challenge-service.js";
export { ERC8004SolanaVerificationService, erc8004SolanaVerificationService } from "./erc8004-solana-verification-service.js";
export { EmailService, emailService } from "./email-service.js";
export { TwitterService, twitterService } from "./twitter-service.js";

/**
 * ClawZz Auth Service instance (replaces SIWAAuthService)
 */
export const clawzzAuthService = new ClawzzAuthService(db);

/**
 * Verification Challenge Service instance
 */
export const verificationChallengeService = new VerificationChallengeService(db);
