"""Output contract validation and completion tracking."""

import logging
from typing import Optional

from ..models.room import Room, RoomType, CompletionLevel, RoomState

logger = logging.getLogger(__name__)


class OutputContract:
    """Contract defining what a room must produce before completion."""

    def __init__(
        self,
        room_type: RoomType,
        minimum_turns: int,
        standard_turns: int,
        exceptional_turns: int,
        success_criteria: list[str],
    ):
        """
        Initialize contract.

        Args:
            room_type: Type of room
            minimum_turns: Minimum turns for basic completion
            standard_turns: Turns for standard completion
            exceptional_turns: Turns for exceptional completion
            success_criteria: List of criteria to evaluate
        """
        self.room_type = room_type
        self.minimum_turns = minimum_turns
        self.standard_turns = standard_turns
        self.exceptional_turns = exceptional_turns
        self.success_criteria = success_criteria


class ContractValidator:
    """Validates rooms against their output contracts."""

    # Predefined contracts per room type
    CONTRACTS = {
        RoomType.DEBATE: OutputContract(
            room_type=RoomType.DEBATE,
            minimum_turns=4,
            standard_turns=8,
            exceptional_turns=12,
            success_criteria=[
                "Multiple positions presented",
                "Evidence cited",
                "Counterarguments addressed",
                "Clear summary/resolution",
            ],
        ),
        RoomType.CODING: OutputContract(
            room_type=RoomType.CODING,
            minimum_turns=3,
            standard_turns=6,
            exceptional_turns=10,
            success_criteria=[
                "Problem clearly defined",
                "Solution approach outlined",
                "Code or pseudocode provided",
                "Edge cases discussed",
            ],
        ),
        RoomType.RESEARCH: OutputContract(
            room_type=RoomType.RESEARCH,
            minimum_turns=5,
            standard_turns=10,
            exceptional_turns=15,
            success_criteria=[
                "Research question defined",
                "Background provided",
                "Methodology outlined",
                "Preliminary findings",
            ],
        ),
        RoomType.TRADING: OutputContract(
            room_type=RoomType.TRADING,
            minimum_turns=4,
            standard_turns=8,
            exceptional_turns=12,
            success_criteria=[
                "Market analysis provided",
                "Trading thesis stated",
                "Risk assessment included",
                "Entry/exit points defined",
            ],
        ),
        RoomType.SIMULATION: OutputContract(
            room_type=RoomType.SIMULATION,
            minimum_turns=6,
            standard_turns=12,
            exceptional_turns=18,
            success_criteria=[
                "Scenario established",
                "Participant actions described",
                "Outcomes evaluated",
                "Lessons identified",
            ],
        ),
    }

    def get_contract(self, room_type: RoomType) -> OutputContract:
        """Get contract for room type."""
        return self.CONTRACTS.get(room_type, self.CONTRACTS[RoomType.DEBATE])

    def evaluate_completion(
        self, room_state: RoomState, transcript_summary: str
    ) -> tuple[CompletionLevel, float, list[str]]:
        """
        Evaluate how well room fulfills its contract.

        Strategy:
        1. Check turn count against thresholds
        2. Use Claude to evaluate against success criteria
        3. Determine completion level
        4. Calculate satisfaction percentage

        Args:
            room_state: Current room state
            transcript_summary: Summarized transcript content

        Returns:
            Tuple of (completion_level, satisfaction_percentage, unfulfilled_criteria)
        """
        contract = self.get_contract(room_state.room.room_type)
        turn_count = room_state.room.turn_count

        # Determine level by turn count (simplified logic)
        if turn_count >= contract.exceptional_turns:
            level = CompletionLevel.EXCEPTIONAL
            satisfaction = 100.0
        elif turn_count >= contract.standard_turns:
            level = CompletionLevel.STANDARD
            satisfaction = 85.0
        elif turn_count >= contract.minimum_turns:
            level = CompletionLevel.MINIMUM
            satisfaction = 60.0
        else:
            level = CompletionLevel.MINIMUM
            satisfaction = min((turn_count / contract.minimum_turns) * 60.0, 59.9)

        # TODO: Use Claude to evaluate transcript against success_criteria
        # For now, return basic evaluation
        unfulfilled = []

        logger.info(
            "Contract evaluated",
            extra={
                "room_id": room_state.room.id,
                "room_type": room_state.room.room_type,
                "turn_count": turn_count,
                "completion_level": level.value,
                "satisfaction": satisfaction,
            },
        )

        return level, satisfaction, unfulfilled

    def should_close_room(self, room_state: RoomState) -> bool:
        """
        Determine if room should close.

        Rules:
        - Close if contract satisfied at STANDARD level
        - Close if exceeded maximum reasonable duration
        - Allow host to close early

        Args:
            room_state: Current room state

        Returns:
            True if room should close
        """
        contract = self.get_contract(room_state.room.room_type)

        # Close if standard threshold reached
        if room_state.room.turn_count >= contract.standard_turns:
            return True

        # TODO: Check for max duration
        return False

    def generate_artifacts(self, room_state: RoomState) -> dict:
        """
        Generate final output artifacts (transcript, summary, highlights).

        Args:
            room_state: Final room state

        Returns:
            Dictionary of artifacts (transcript, summary, highlights)
        """
        artifacts = {
            "transcript": room_state.transcript,
            "room_id": room_state.room.id,
            "room_type": room_state.room.room_type.value,
            "objective": room_state.room.objective,
            "turn_count": room_state.room.turn_count,
            "completion_level": room_state.room.completion_level.value,
            # TODO: Generate summary and highlights via Claude
            "summary": None,
            "highlights": [],
        }

        logger.info(
            "Artifacts generated",
            extra={
                "room_id": room_state.room.id,
                "artifact_count": len(artifacts),
            },
        )

        return artifacts
