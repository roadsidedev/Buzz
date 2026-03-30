/**
 * Contract Validator
 *
 * Port of orchestrator/src/services/output_contracts.py
 *
 * Each room type has a predefined contract specifying the number of turns
 * required to reach minimum / standard / exceptional completion.
 * The validator computes a satisfaction percentage and determines whether
 * the room should be closed.
 */

import type { RoomStateData, ContractSpec, ContractEvaluation } from "./types.js";

// ─── Contract definitions (mirrors Python ROOM_TYPE_CONTRACTS) ────────────────

const CONTRACTS: Record<string, ContractSpec> = {
  debate: {
    roomType: "debate",
    minimumTurns: 4,
    standardTurns: 8,
    exceptionalTurns: 12,
    successCriteria: [
      "Multiple positions represented",
      "Evidence or arguments provided",
      "Counterarguments addressed",
      "Summary or conclusion reached",
    ],
  },
  coding: {
    roomType: "coding",
    minimumTurns: 3,
    standardTurns: 6,
    exceptionalTurns: 10,
    successCriteria: [
      "Problem clearly defined",
      "Approach or algorithm proposed",
      "Code or pseudocode provided",
      "Edge cases considered",
    ],
  },
  research: {
    roomType: "research",
    minimumTurns: 5,
    standardTurns: 10,
    exceptionalTurns: 15,
    successCriteria: [
      "Research question articulated",
      "Background context provided",
      "Methodology described",
      "Findings or conclusions stated",
    ],
  },
  trading: {
    roomType: "trading",
    minimumTurns: 4,
    standardTurns: 8,
    exceptionalTurns: 12,
    successCriteria: [
      "Market analysis provided",
      "Trade thesis articulated",
      "Risk assessment included",
      "Entry/exit levels discussed",
    ],
  },
  simulation: {
    roomType: "simulation",
    minimumTurns: 6,
    standardTurns: 12,
    exceptionalTurns: 18,
    successCriteria: [
      "Scenario established",
      "Actions and decisions made",
      "Outcomes observed",
      "Lessons learned extracted",
    ],
  },
};

// Default contract for custom room types
const DEFAULT_CONTRACT: ContractSpec = {
  roomType: "custom",
  minimumTurns: 4,
  standardTurns: 8,
  exceptionalTurns: 12,
  successCriteria: ["Objective addressed"],
};

// ─── ContractValidator ────────────────────────────────────────────────────────

export class ContractValidator {
  getContract(roomType: string): ContractSpec {
    return CONTRACTS[roomType.toLowerCase()] ?? DEFAULT_CONTRACT;
  }

  /**
   * Evaluate the current room state against its contract.
   *
   * Satisfaction levels (mirrors Python percentages):
   *   < minimumTurns  → < 60%   (not yet closeable)
   *   >= minimumTurns → 60%     (minimum met — can close)
   *   >= standardTurns → 85%
   *   >= exceptionalTurns → 100%
   */
  evaluate(state: RoomStateData): ContractEvaluation {
    const contract = this.getContract(state.roomType);
    const turns = state.turnCount;

    let satisfaction: number;
    let level: ContractEvaluation["level"] = "minimum";

    if (turns >= contract.exceptionalTurns) {
      satisfaction = 100;
      level = "exceptional";
    } else if (turns >= contract.standardTurns) {
      const range = contract.exceptionalTurns - contract.standardTurns;
      satisfaction = range > 0
        ? 85 + ((turns - contract.standardTurns) / range) * 15
        : 85;
      level = "standard";
    } else if (turns >= contract.minimumTurns) {
      const range = contract.standardTurns - contract.minimumTurns;
      satisfaction = range > 0
        ? 60 + ((turns - contract.minimumTurns) / range) * 25
        : 60;
      level = "minimum";
    } else {
      satisfaction = contract.minimumTurns > 0
        ? (turns / contract.minimumTurns) * 60
        : 0;
      level = "minimum";
    }

    satisfaction = Math.min(100, Math.max(0, satisfaction));

    return {
      level,
      satisfaction,
      unfulfilledCriteria: turns < contract.minimumTurns ? contract.successCriteria : [],
      shouldClose: turns >= contract.minimumTurns,
    };
  }

  shouldClose(state: RoomStateData): boolean {
    return this.evaluate(state).shouldClose;
  }

  generateArtifacts(state: RoomStateData): Record<string, unknown> {
    const contract = this.getContract(state.roomType);
    const evaluation = this.evaluate(state);
    return {
      room_id: state.roomId,
      room_type: state.roomType,
      contract_spec: contract,
      completion_level: evaluation.level,
      satisfaction_percentage: evaluation.satisfaction,
      total_turns: state.turnCount,
      transcript_length: state.transcript.length,
    };
  }
}
