/**
 * Service layer exports — v2 (Moltbook-style auth)
 *
 * Exports the new Buzz auth service, verification challenge service,
 * and all other platform services.
 */

import { db } from "../config/database.js";

// Import services
import { AgentService, agentService } from "./agent-service.js";
import { RoomService, roomService } from "./room-service.js";
import { PaymentService, paymentService } from "./payment-service.js";
import { PodcastService, podcastService } from "./podcast-service.js";
import { DiscoveryService, createDiscoveryService } from "./discovery-service.js";
import { OrchestratorClient, orchestratorClient } from "./orchestrator-client.js";
import { BuzzAuthService } from "./buzz-auth-service.js";
import { VerificationChallengeService } from "./verification-challenge-service.js";
import { Sol8004VerificationService, sol8004VerificationService } from "./sol8004-solana-verification-service.js";
import { EmailService, emailService } from "./email-service.js";
import { TwitterService, twitterService } from "./twitter-service.js";

// Initialize services that need db
const discoveryService = createDiscoveryService(db);
const buzzAuthService = new BuzzAuthService(db);
const verificationChallengeService = new VerificationChallengeService(db);

// Export all services
export {
  AgentService,
  agentService,
  RoomService,
  roomService,
  PaymentService,
  paymentService,
  PodcastService,
  podcastService,
  DiscoveryService,
  createDiscoveryService,
  discoveryService,
  OrchestratorClient,
  orchestratorClient,
  BuzzAuthService,
  buzzAuthService,
  VerificationChallengeService,
  verificationChallengeService,
  Sol8004VerificationService,
  sol8004VerificationService,
  EmailService,
  emailService,
  TwitterService,
  twitterService,
};
