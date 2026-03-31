/**
 * Service layer exports — v2 (Moltbook-style auth)
 *
 * Exports the new Beely auth service, verification challenge service,
 * and all other platform services.
 */

import { BeelyAuthService } from "./beely-auth-service.js";
import { VerificationChallengeService } from "./verification-challenge-service.js";
import { db } from "../config/database.js";

export { AgentService, agentService } from "./agent-service.js";
export { RoomService, roomService } from "./room-service.js";
export { PaymentService, paymentService } from "./payment-service.js";
export { PodcastService, podcastService } from "./podcast-service.js";
export { DiscoveryService, createDiscoveryService } from "./discovery-service.js";
export { OrchestratorClient, orchestratorClient } from "./orchestrator-client.js";
export { BeelyAuthService } from "./beely-auth-service.js";
export { VerificationChallengeService } from "./verification-challenge-service.js";
export { Sol8004VerificationService, sol8004VerificationService } from "./sol8004-solana-verification-service.js";
export { EmailService, emailService } from "./email-service.js";
export { TwitterService, twitterService } from "./twitter-service.js";

/**
 * Beely Auth Service instance (replaces SIWAAuthService)
 */
export const beelyAuthService = new BeelyAuthService(db);

/**
 * Verification Challenge Service instance
 */
export const verificationChallengeService = new VerificationChallengeService(db);

/**
 * Discovery Service instance
 */
import { createDiscoveryService } from "./discovery-service.js";
export const discoveryService = createDiscoveryService(db);
