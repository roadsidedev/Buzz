"""Turn management and speaker selection logic."""

import logging
from datetime import datetime, timedelta
from typing import Optional

from ..config.settings import settings
from ..models.message import Message, ScoringResult, TurnSelection
from ..models.room import RoomState

logger = logging.getLogger(__name__)


class TurnManager:
    """Manages turn-taking and prevents speaker monopoly."""

    def __init__(self):
        """Initialize turn manager."""
        self.turn_timeout = settings.TURN_TIMEOUT_SECONDS

    def select_next_speaker(
        self, room_state: RoomState, scores: list[ScoringResult]
    ) -> TurnSelection:
        """
        Select the best message and prepare turn.

        Strategy:
        1. Filter messages that pass minimum quality threshold
        2. Prevent last speaker from speaking again (unless only option)
        3. Diversify speakers (penalize frequent talkers)
        4. Select highest-scoring remaining message
        5. Prepare turn metadata

        Args:
            room_state: Current room state with history
            scores: Scored candidates

        Returns:
            TurnSelection with decision details
        """
        # Sort by score descending
        sorted_scores = sorted(scores, key=lambda s: s.overall_score, reverse=True)

        # Count participation to detect monopoly
        participation_count = self._count_participation(room_state)

        # Filter candidates (apply rules)
        eligible = []
        for score in sorted_scores:
            # Rule 1: Pass quality threshold
            if score.overall_score < settings.MIN_SCORE_THRESHOLD:
                continue

            # Rule 2: Skip if moderated
            if score.is_moderated:
                continue

            # Rule 3: Skip if same agent spoke last turn (unless it's the only option)
            if score.agent_id == room_state.last_speaker_id and len(eligible) > 0:
                continue

            # Rule 4: Penalize frequent talkers (TODO: consider giving them lower priority)
            eligible.append(score)

        if not eligible:
            # Fallback: use highest-scoring even if it violates some rules
            if sorted_scores:
                eligible = [sorted_scores[0]]
            else:
                raise ValueError("No eligible messages for turn selection")

        selected = eligible[0]
        runner_ups = [s.message_id for s in eligible[1:3]]  # Track close contenders

        turn = TurnSelection(
            turn_number=room_state.room.turn_count + 1,
            selected_message_id=selected.message_id,
            selected_agent_id=selected.agent_id,
            score=selected.overall_score,
            runner_ups=runner_ups,
        )

        logger.info(
            "Turn selected",
            extra={
                "room_id": room_state.room.id,
                "turn_number": turn.turn_number,
                "selected_agent": selected.agent_id,
                "score": selected.overall_score,
                "eligible_count": len(eligible),
            },
        )

        return turn

    def _count_participation(self, room_state: RoomState) -> dict[str, int]:
        """Count messages per agent in transcript."""
        counts = {}
        for entry in room_state.transcript:
            agent_id = entry.get("agent_id")
            if agent_id:
                counts[agent_id] = counts.get(agent_id, 0) + 1
        return counts

    def check_timeout(self, room_state: RoomState) -> bool:
        """
        Check if room has exceeded turn timeout.

        Args:
            room_state: Current room state

        Returns:
            True if timeout exceeded
        """
        if not room_state.room.started_at:
            return False

        elapsed = datetime.utcnow() - room_state.room.started_at
        return elapsed > timedelta(seconds=self.turn_timeout)

    def create_fallback_message(self, room_state: RoomState) -> str:
        """
        Generate fallback message when no candidates available.

        Args:
            room_state: Current room state

        Returns:
            Generic system message
        """
        return (
            f"Awaiting agent responses to advance discussion toward: {room_state.room.objective}"
        )

    async def handle_timeout(self, room_state: RoomState) -> Optional[str]:
        """
        Handle turn timeout (no messages within time limit).

        Strategy:
        1. Log timeout event
        2. Generate fallback message
        3. Continue room (don't close)

        Args:
            room_state: Current room state

        Returns:
            Fallback message ID or None
        """
        logger.warning(
            "Turn timeout",
            extra={
                "room_id": room_state.room.id,
                "turn_number": room_state.room.turn_count,
                "timeout_seconds": self.turn_timeout,
            },
        )

        # TODO: Implement fallback message generation and insertion
        return None
