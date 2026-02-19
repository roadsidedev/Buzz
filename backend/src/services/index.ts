// @ts-nocheck
/**
 * Service layer exports
 */

import { Database } from "../config/database";
import { SIWAAuthService } from "./siwa-auth-service";
import { db } from "../config/database";

export { AgentService, agentService } from "./agent-service";
export { RoomService, roomService } from "./room-service";
export { PaymentService, paymentService } from "./payment-service";
export { PodcastService, podcastService } from "./podcast-service";
export { OrchestratorClient, orchestratorClient } from "./orchestrator-client";
export { SIWAAuthService } from "./siwa-auth-service";

/**
 * SIWA Authentication Service instance
 */
export const siwaAuthService = new SIWAAuthService(db);
