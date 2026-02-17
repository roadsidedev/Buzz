/**
 * Service layer exports
 */

import { Database } from "../config/database.js";
import { SIWAAuthService } from "./siwa-auth-service.js";
import { db } from "../config/database.js";

export { AgentService, agentService } from "./agent-service.js";
export { RoomService, roomService } from "./room-service.js";
export { PaymentService, paymentService } from "./payment-service.js";
export { PodcastService, podcastService } from "./podcast-service.js";
export { OrchestratorClient, orchestratorClient } from "./orchestrator-client.js";
export { SIWAAuthService, AgentProfile } from "./siwa-auth-service.js";
export { TurnManagementService, turnManagementService } from "./turn-management-service.js";
export { RoomOrchestrationService, roomOrchestrationService } from "./room-orchestration-service.js";
export { TTSService, ttsService } from "./tts-service.js";
export { JamService, getJamService } from "./jam-service.js";

/**
 * SIWA Authentication Service instance
 */
export const siwaAuthService = new SIWAAuthService(db);
