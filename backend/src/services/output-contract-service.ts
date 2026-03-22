// @ts-nocheck
/**
 * Output Contract Service
 *
 * Validates room completion against output contracts:
 * - Define contracts per room type
 * - Track progress toward completion
 * - Determine when rooms can close
 *
 * Contract Types:
 * - Debate: Minimum 4 turns, both perspectives heard
 * - Coding: Working solution, tested, code reviewed
 * - Research: Key findings documented, sources cited
 * - Trading: Trade rationale explained, risk assessed
 * - Simulation: Outcome simulated, parameters logged
 *
 * Part of Day 7: Room Completion Detection
 */

import type { Room, RoomType, CompletionLevel } from "@common/types/index";
import type { OutputContractValidationRequest } from "@common/types/index";
import { orchestratorClient } from "./orchestrator-client.js";
import { roomRepository, messageRepository } from "../repositories/index.js";
import { logger } from "../utils/logger.js";
import { NotFoundError } from "../utils/errors.js";

// ===================================================================
// Contract Definitions
// ===================================================================

interface ContractSpec {
  roomType: RoomType;
  minimumRequirements: string[];
  standardRequirements: string[];
  exceptionalRequirements?: string[];
  minimumTurns: number;
  minimumAudioSeconds: number;
  minimumParticipants: number;
}

const DEFAULT_CONTRACT: ContractSpec = {
  roomType: "custom",
  minimumRequirements: ["Room objective stated", "At least one participant spoke"],
  standardRequirements: [
    "All minimum requirements met",
    "Discussion progressed toward objective",
    "Summary or conclusion reached",
  ],
  minimumTurns: 2,
  minimumAudioSeconds: 60,
  minimumParticipants: 1,
};

const CONTRACTS: Record<string, ContractSpec> = {
  debate: {
    roomType: "debate",
    minimumRequirements: [
      "At least 2 different perspectives presented",
      "Each perspective spoken for at least 30 seconds",
      "Direct response to opposing view",
    ],
    standardRequirements: [
      "All minimum requirements met",
      "At least 4 turns completed",
      "Each side gets equal speaking time (within 20%)",
      "Evidence or reasoning provided",
    ],
    exceptionalRequirements: [
      "6+ turns",
      "Novel argument introduced",
      "Debate consensus reached or clear winner declared",
    ],
    minimumTurns: 2,
    minimumAudioSeconds: 60,
    minimumParticipants: 2,
  },

  coding: {
    roomType: "coding",
    minimumRequirements: [
      "Problem stated clearly",
      "Approach documented",
      "Initial code shared",
    ],
    standardRequirements: [
      "All minimum requirements met",
      "Working solution demonstrated",
      "Code tested with examples",
      "Edge cases considered",
    ],
    exceptionalRequirements: [
      "Optimization discussed",
      "Alternative approaches compared",
      "Production-ready code",
    ],
    minimumTurns: 3,
    minimumAudioSeconds: 120,
    minimumParticipants: 2,
  },

  research: {
    roomType: "research",
    minimumRequirements: [
      "Research question defined",
      "Key sources identified",
      "Initial findings presented",
    ],
    standardRequirements: [
      "All minimum requirements met",
      "Main findings synthesized",
      "Sources cited",
      "Limitations acknowledged",
    ],
    exceptionalRequirements: [
      "Novel insight provided",
      "Comprehensive literature review",
      "Actionable recommendations",
    ],
    minimumTurns: 4,
    minimumAudioSeconds: 180,
    minimumParticipants: 2,
  },

  trading: {
    roomType: "trading",
    minimumRequirements: [
      "Trade thesis stated",
      "Risk/reward identified",
      "Entry/exit criteria defined",
    ],
    standardRequirements: [
      "All minimum requirements met",
      "Market analysis provided",
      "Position sizing discussed",
      "Risk management plan outlined",
    ],
    exceptionalRequirements: [
      "Multi-leg strategy",
      "Hedge strategy discussed",
      "Historical precedent cited",
    ],
    minimumTurns: 3,
    minimumAudioSeconds: 90,
    minimumParticipants: 2,
  },

  simulation: {
    roomType: "simulation",
    minimumRequirements: [
      "Scenario parameters defined",
      "Initial conditions set",
      "Simulation run",
    ],
    standardRequirements: [
      "All minimum requirements met",
      "Outcomes documented",
      "Key metrics logged",
      "Interpretation provided",
    ],
    exceptionalRequirements: [
      "Sensitivity analysis",
      "Multiple scenarios tested",
      "Novel parameters explored",
    ],
    minimumTurns: 3,
    minimumAudioSeconds: 120,
    minimumParticipants: 2,
  },
};

// ===================================================================
// Type Definitions
// ===================================================================

export interface CompletionStatus {
  roomId: string;
  completionPercentage: number;
  minimumMet: boolean;
  standardMet: boolean;
  exceptionalMet: boolean;
  completionLevel: CompletionLevel;
  suggestedAction: "continue" | "close";
  failedRequirements: string[];
  nextMilestone?: string;
}

// ===================================================================
// Output Contract Service
// ===================================================================

export class OutputContractService {
  /**
   * Check if room meets output contract
   *
   * Calls orchestrator to validate against transcript
   *
   * @param roomId - Room ID
   * @returns Completion status
   */
  async checkCompletion(roomId: string): Promise<CompletionStatus> {
    // 1. GET ROOM
    const room = await roomRepository.getById(roomId);
    if (!room) {
      throw new NotFoundError("Room not found", { roomId });
    }

    // 2. GET TRANSCRIPT
    const messages = await messageRepository.getByRoom(roomId);
    const played = messages.filter((m) => m.status === "played");
    const transcript = played
      .map((m) => `${m.agentId}: ${m.text}`)
      .join("\n");

    // 3. BUILD VALIDATION REQUEST
    const request: OutputContractValidationRequest = {
      roomId,
      type: room.type,
      transcriptSoFar: transcript,
      turnsElapsed: room.turnCount || 0,
      timeElapsedSeconds: room.startedAt
        ? (Date.now() - room.startedAt.getTime()) / 1000
        : 0,
    };

    // 4. CALL ORCHESTRATOR
    let result;
    try {
      result = await orchestratorClient.validateOutputContract(request);
    } catch (err) {
      logger.error("Output contract validation failed", {
        roomId,
        error: err instanceof Error ? err.message : String(err),
      });

      // Fallback: basic validation
      return this._basicValidation(room, messages);
    }

    // 5. DETERMINE COMPLETION LEVEL
    let completionLevel: CompletionLevel = "minimum";
    if (result.exceptionalMet) {
      completionLevel = "exceptional";
    } else if (result.standardMet) {
      completionLevel = "standard";
    }

    // 6. BUILD STATUS
    const contract = CONTRACTS[room.type] ?? DEFAULT_CONTRACT;
    const failed = this._getFailedRequirements(
      room,
      messages,
      contract,
      result.minimumMet,
    );

    const status: CompletionStatus = {
      roomId,
      completionPercentage: result.completionPercentage,
      minimumMet: result.minimumMet,
      standardMet: result.standardMet,
      exceptionalMet: result.exceptionalMet,
      completionLevel,
      suggestedAction: result.minimumMet ? "close" : "continue",
      failedRequirements: failed,
      nextMilestone: this._getNextMilestone(
        result.completionPercentage,
        completionLevel,
      ),
    };

    logger.info("Completion checked", {
      roomId,
      completionLevel,
      completionPercentage: result.completionPercentage,
    });

    return status;
  }

  /**
   * Get contract for room type
   *
   * @param roomType - Room type
   * @returns Contract specification
   */
  getContract(roomType: string): ContractSpec {
    return CONTRACTS[roomType] ?? DEFAULT_CONTRACT;
  }

  /**
   * Basic validation (fallback when orchestrator unavailable)
   *
   * @param room - Room
   * @param messages - All messages
   * @returns Completion status
   */
  private _basicValidation(
    room: Room,
    messages: RoomMessage[],
  ): CompletionStatus {
    const contract = CONTRACTS[room.type] ?? DEFAULT_CONTRACT;
    const played = messages.filter((m) => m.status === "played");

    // Calculate metrics
    const turnsMet = room.turnCount >= contract.minimumTurns;
    const audioSeconds = played.length * 30; // Estimate 30s per message
    const audioMet = audioSeconds >= contract.minimumAudioSeconds;

    const uniqueAgents = new Set(messages.map((m) => m.agentId)).size;
    const participantsMet = uniqueAgents >= contract.minimumParticipants;

    const minimumMet = turnsMet && audioMet && participantsMet;

    const completionPercentage = Math.min(
      100,
      Math.round(
        ((room.turnCount / contract.minimumTurns) * 50 +
          (audioSeconds / contract.minimumAudioSeconds) * 30 +
          (uniqueAgents / contract.minimumParticipants) * 20) /
          100 *
          100,
      ),
    );

    return {
      roomId: room.id,
      completionPercentage,
      minimumMet,
      standardMet: false,
      exceptionalMet: false,
      completionLevel: minimumMet ? "minimum" : "minimum",
      suggestedAction: minimumMet ? "close" : "continue",
      failedRequirements: [
        !turnsMet ? `Need ${contract.minimumTurns} turns (have ${room.turnCount})` : "",
        !audioMet
          ? `Need ${contract.minimumAudioSeconds}s audio (have ~${audioSeconds}s)`
          : "",
        !participantsMet ? `Need ${contract.minimumParticipants} participants (have ${uniqueAgents})` : "",
      ].filter(Boolean),
    };
  }

  /**
   * Get failed requirements
   *
   * @param room - Room
   * @param messages - Messages
   * @param contract - Contract
   * @param minimumMet - Is minimum met
   * @returns List of failed requirement strings
   */
  private _getFailedRequirements(
    room: Room,
    messages: RoomMessage[],
    contract: ContractSpec,
    minimumMet: boolean,
  ): string[] {
    if (minimumMet) {
      return [];
    }

    const failed = [];
    const played = messages.filter((m) => m.status === "played");

    if (room.turnCount < contract.minimumTurns) {
      failed.push(
        `Need ${contract.minimumTurns} turns (have ${room.turnCount})`,
      );
    }

    const audioSeconds = played.length * 30;
    if (audioSeconds < contract.minimumAudioSeconds) {
      failed.push(
        `Need ${contract.minimumAudioSeconds}s of audio (have ~${audioSeconds}s)`,
      );
    }

    const uniqueAgents = new Set(messages.map((m) => m.agentId)).size;
    if (uniqueAgents < contract.minimumParticipants) {
      failed.push(
        `Need ${contract.minimumParticipants} participants (have ${uniqueAgents})`,
      );
    }

    return failed;
  }

  /**
   * Get next milestone description
   *
   * @param completionPercentage - Current progress
   * @param level - Current completion level
   * @returns Milestone description or undefined
   */
  private _getNextMilestone(
    completionPercentage: number,
    level: CompletionLevel,
  ): string | undefined {
    if (completionPercentage < 50) {
      return `${Math.round(50 - completionPercentage)}% to minimum requirement`;
    } else if (completionPercentage < 100) {
      return `${Math.round(100 - completionPercentage)}% to standard requirement`;
    } else if (level !== "exceptional") {
      return "Work toward exceptional completion";
    }

    return undefined;
  }
}

/**
 * Singleton instance
 */
export const outputContractService = new OutputContractService();
