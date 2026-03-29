/**
 * Turn Selector
 *
 * Port of orchestrator/src/services/turn_management.py
 *
 * Picks the winning message from a scored set of candidates, applying:
 *  1. Minimum score threshold filter
 *  2. Moderation filter (isModerated messages are excluded)
 *  3. Anti-monopoly: the last speaker cannot win back-to-back turns
 *  4. Tie-break: highest overall score wins
 */

import type { RoomStateData, ScoringResult, TurnSelection } from "./types.js";
import { logger } from "../../utils/logger.js";

const MIN_SCORE_THRESHOLD = parseFloat(process.env.MIN_SCORE_THRESHOLD ?? "50.0");

export class TurnSelector {
  /**
   * Select the best eligible speaker from scored candidates.
   *
   * Returns null if no candidate passes all filters (caller should emit a
   * timeout/nudge event instead of advancing the turn counter).
   */
  selectNextSpeaker(
    roomState: RoomStateData,
    scores: ScoringResult[],
    minThreshold: number = MIN_SCORE_THRESHOLD,
  ): TurnSelection | null {
    if (scores.length === 0) {
      logger.debug("No candidates to select from", { roomId: roomState.roomId });
      return null;
    }

    // 1. Filter: minimum score and not moderated
    const eligible = scores.filter(
      (s) => s.overallScore >= minThreshold && !s.isModerated,
    );

    if (eligible.length === 0) {
      logger.debug("No candidates pass threshold", {
        roomId: roomState.roomId,
        threshold: minThreshold,
        candidateCount: scores.length,
      });
      // Fall back to unmoderated candidates ignoring threshold
      const unmoderated = scores.filter((s) => !s.isModerated);
      if (unmoderated.length === 0) return null;
      // Pick highest score among unmoderated
      const best = unmoderated.sort((a, b) => b.overallScore - a.overallScore)[0];
      return this._makeSelection(roomState, best, unmoderated.slice(1));
    }

    // 2. Anti-monopoly: prefer candidates who are not the last speaker
    const lastSpeaker = roomState.lastSpeakerId;
    const nonRepeat = eligible.filter((s) => s.agentId !== lastSpeaker);
    const pool = nonRepeat.length > 0 ? nonRepeat : eligible;

    // 3. Sort descending and pick winner
    pool.sort((a, b) => b.overallScore - a.overallScore);
    const winner = pool[0];
    const runnerUps = pool.slice(1);

    logger.debug("Turn winner selected", {
      roomId: roomState.roomId,
      winnerId: winner.messageId,
      agentId: winner.agentId,
      score: winner.overallScore,
      monopolyPrevented: nonRepeat.length > 0 && lastSpeaker === eligible[0]?.agentId,
    });

    return this._makeSelection(roomState, winner, runnerUps);
  }

  /** Build participation count map from transcript history */
  countParticipation(roomState: RoomStateData): Record<string, number> {
    return roomState.transcript.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.agentId] = (acc[entry.agentId] ?? 0) + 1;
      return acc;
    }, {});
  }

  private _makeSelection(
    roomState: RoomStateData,
    winner: ScoringResult,
    runnerUps: ScoringResult[],
  ): TurnSelection {
    return {
      turnNumber: roomState.turnCount + 1,
      selectedMessageId: winner.messageId,
      selectedAgentId: winner.agentId,
      score: winner.overallScore,
      runnerUps: runnerUps.map((r) => r.messageId),
      timestamp: new Date(),
    };
  }
}
