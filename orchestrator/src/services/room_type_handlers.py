"""Room type handlers for specialized orchestration logic.

Each room type has custom:
- Scoring weights (which dimensions matter most)
- Message validation rules
- Artifact extraction
- Contract progress evaluation
"""

from abc import ABC, abstractmethod
from abc import ABC, abstractmethod
from typing import Optional, Dict, List, Any
from src.models.room import (
    RoomType,
    RoomTypeConfig,
    DebateConfig,
    CodingConfig,
    ResearchConfig,
    TradingConfig,
    SimulationConfig,
    CustomConfig,
)
from src.models.message import Message
import logging

logger = logging.getLogger(__name__)


class RoomTypeHandler(ABC):
    """Abstract base class for room type handlers."""

    @abstractmethod
    def get_custom_scoring_weights(self) -> dict:
        """Return scoring weights for this room type.

        Returns dict with keys: relevance, novelty, coherence, actionability, engagement.
        Values must be floats 0.0-1.0 that sum to 1.0.

        Returns:
            dict: Scoring dimension weights
        """
        pass

    @abstractmethod
    def validate_message_content(self, message: Message) -> bool:
        """Validate if a message is appropriate for this room type.

        Args:
            message: The agent's message to validate

        Returns:
            bool: True if valid, False if should be rejected
        """
        pass

    @abstractmethod
    def extract_artifacts(self, transcript: list[dict]) -> dict:
        """Extract room-type-specific artifacts from the transcript.

        Args:
            transcript: List of completed turns with selected messages

        Returns:
            dict: Artifacts (summary, highlights, structured outputs, etc)
        """
        pass

    @abstractmethod
    def evaluate_contract_progress(self, messages: list[Message], turn_count: int) -> float:
        """Evaluate how close the room is to completing its output contract.

        Args:
            messages: All messages in the room
            turn_count: Number of completed turns

        Returns:
            float: Progress 0.0-100.0 (0=not started, 100=contract complete)
        """
        pass


class DebateHandler(RoomTypeHandler):
    """Handler for debate rooms.

    Debate values novelty (new arguments) and coherence (building on prior points).
    Success requires presenting multiple perspectives and evidence.
    """

    def __init__(self, config: DebateConfig):
        self.config = config

    def get_custom_scoring_weights(self) -> dict:
        """Debate values novelty (new arguments) and coherence (building on prior)."""
        return {
            "relevance": 0.30,  # Stay on topic
            "novelty": 0.30,  # New arguments matter (vs repeating)
            "coherence": 0.25,  # Build on prior points
            "actionability": 0.10,  # Less critical for debate
            "engagement": 0.05,  # Audience interest
        }

    def validate_message_content(self, message: Message) -> bool:
        """Debate messages should present arguments, not questions or off-topic comments."""
        # Reject very short messages (likely incomplete arguments)
        if len(message.text) < 20:
            return False

        # Reject if looks like a question only (ends with ?)
        if message.text.strip().endswith("?"):
            return False

        return True

    def extract_artifacts(self, transcript: list[dict]) -> dict:
        """Extract pro/con arguments, evidence, and summary."""
        pro_arguments = []
        con_arguments = []
        key_evidence = []

        for turn in transcript:
            text = turn.get("text", "")
            # Simple heuristic: first half might be pro, second might be con
            # In production, use NLP to detect stance
            if len(pro_arguments) <= len(con_arguments):
                pro_arguments.append(text[:200])
            else:
                con_arguments.append(text[:200])

        return {
            "debate_topic": self.config.topic,
            "sides": self.config.sides,
            "pro_arguments": pro_arguments,
            "con_arguments": con_arguments,
            "key_evidence": key_evidence,
            "conclusion_summary": "Debate concluded with multiple perspectives presented.",
        }

    def evaluate_contract_progress(self, messages: list[Message], turn_count: int) -> float:
        """Debate completion: need multiple sides presented and evidence."""
        # Debate needs at least 6 turns (multiple people, both sides)
        min_turns = 6
        standard_turns = 10
        exceptional_turns = 14

        if turn_count < min_turns:
            return (turn_count / min_turns) * 33.33
        elif turn_count < standard_turns:
            return 33.33 + ((turn_count - min_turns) / (standard_turns - min_turns)) * 33.34
        elif turn_count < exceptional_turns:
            return 66.67 + ((turn_count - standard_turns) / (exceptional_turns - standard_turns)) * 33.33
        else:
            return 100.0


class CodingHandler(RoomTypeHandler):
    """Handler for coding challenge rooms.

    Coding values actionability (working code) and coherence (building incrementally).
    Success requires a working solution.
    """

    def __init__(self, config: CodingConfig):
        self.config = config

    def get_custom_scoring_weights(self) -> dict:
        """Coding values actionability (working code) and coherence (building on prior)."""
        return {
            "relevance": 0.25,  # Stay focused on problem
            "novelty": 0.15,  # Creative solutions matter, but less critical
            "coherence": 0.30,  # Build on prior attempts
            "actionability": 0.25,  # Runnable code is critical
            "engagement": 0.05,  # Less critical
        }

    def validate_message_content(self, message: Message) -> bool:
        """Coding messages should contain code or technical discussion."""
        # Accept code blocks or technical explanations
        has_code_block = "```" in message.text or "def " in message.text or "class " in message.text
        has_technical_terms = any(
            term in message.text.lower()
            for term in ["function", "algorithm", "data structure", "bug", "refactor", "test"]
        )

        return len(message.text) > 30 and (has_code_block or has_technical_terms)

    def extract_artifacts(self, transcript: list[dict]) -> dict:
        """Extract final solution, key steps, and quality metrics."""
        final_code = None
        approach = ""
        edge_cases = []

        # Simple extraction: assume last code block is final solution
        for turn in reversed(transcript):
            text = turn.get("text", "")
            if "```" in text:
                final_code = text
                break

        return {
            "language": self.config.language,
            "problem": self.config.problem_statement,
            "difficulty": self.config.difficulty,
            "final_solution": final_code or "Solution in progress",
            "approach": approach,
            "edge_cases_addressed": edge_cases,
            "tests_required": self.config.test_required,
        }

    def evaluate_contract_progress(self, messages: list[Message], turn_count: int) -> float:
        """Coding completion: need problem understanding, approach, code, and testing."""
        # Coding needs: problem understanding (1-2 turns), solution (3-6 turns), testing (7+)
        min_turns = 3
        standard_turns = 6
        exceptional_turns = 10

        if turn_count < min_turns:
            return (turn_count / min_turns) * 33.33
        elif turn_count < standard_turns:
            return 33.33 + ((turn_count - min_turns) / (standard_turns - min_turns)) * 33.34
        elif turn_count < exceptional_turns:
            return 66.67 + ((turn_count - standard_turns) / (exceptional_turns - standard_turns)) * 33.33
        else:
            return 100.0


class ResearchHandler(RoomTypeHandler):
    """Handler for research discussion rooms.

    Research values relevance (on-topic) and novelty (new findings).
    Success requires presenting methodology and findings.
    """

    def __init__(self, config: ResearchConfig):
        self.config = config

    def get_custom_scoring_weights(self) -> dict:
        """Research values relevance (on-topic) and novelty (new findings)."""
        return {
            "relevance": 0.35,  # Stay on research question
            "novelty": 0.30,  # New findings/insights critical
            "coherence": 0.20,  # Connect to prior research
            "actionability": 0.10,  # Recommendations/implications
            "engagement": 0.05,  # Clarity of presentation
        }

    def validate_message_content(self, message: Message) -> bool:
        """Research messages should discuss findings, not just questions."""
        # Reject if too short or pure question
        if len(message.text) < 50:
            return False

        # Accept if discusses findings, methodology, or evidence
        research_terms = ["found", "result", "data", "study", "evidence", "methodology", "analysis"]
        has_research_content = any(term in message.text.lower() for term in research_terms)

        return has_research_content or len(message.text) > 200

    def extract_artifacts(self, transcript: list[dict]) -> dict:
        """Extract research question, methodology, findings, and implications."""
        return {
            "domain": self.config.domain,
            "research_question": self.config.research_question,
            "methodology": self.config.methodology,
            "key_findings": [turn.get("text", "")[:300] for turn in transcript[-3:]],
            "implications": "Research discussion concluded with findings presented.",
            "citations_required": self.config.citation_required,
        }

    def evaluate_contract_progress(self, messages: list[Message], turn_count: int) -> float:
        """Research completion: need question, methodology, findings, implications."""
        min_turns = 5
        standard_turns = 10
        exceptional_turns = 15

        if turn_count < min_turns:
            return (turn_count / min_turns) * 33.33
        elif turn_count < standard_turns:
            return 33.33 + ((turn_count - min_turns) / (standard_turns - min_turns)) * 33.34
        elif turn_count < exceptional_turns:
            return 66.67 + ((turn_count - standard_turns) / (exceptional_turns - standard_turns)) * 33.33
        else:
            return 100.0


class TradingHandler(RoomTypeHandler):
    """Handler for trading analysis rooms.

    Trading values actionability (entry/exit points) and relevance (market analysis).
    Success requires presenting thesis and risk assessment.
    """

    def __init__(self, config: TradingConfig):
        self.config = config

    def get_custom_scoring_weights(self) -> dict:
        """Trading values actionability (entry/exit) and relevance (market focus)."""
        return {
            "relevance": 0.30,  # Market analysis on-topic
            "novelty": 0.15,  # New perspectives matter less
            "coherence": 0.20,  # Build on technical analysis
            "actionability": 0.30,  # Entry/exit points critical
            "engagement": 0.05,  # Clarity of recommendations
        }

    def validate_message_content(self, message: Message) -> bool:
        """Trading messages should discuss analysis, not speculation."""
        # Require minimum length for substantive analysis
        if len(message.text) < 50:
            return False

        # Look for analysis terms
        analysis_terms = [
            "support",
            "resistance",
            "trend",
            "entry",
            "exit",
            "stop loss",
            "target",
            "analysis",
        ]
        return any(term in message.text.lower() for term in analysis_terms)

    def extract_artifacts(self, transcript: list[dict]) -> dict:
        """Extract trading thesis, analysis, risk assessment, and entry/exit points."""
        return {
            "asset_class": self.config.asset_class,
            "instrument": self.config.instrument,
            "timeframe": self.config.timeframe,
            "trading_thesis": "Analysis concluded.",
            "entry_points": "See transcript for identified entry levels.",
            "exit_targets": "See transcript for profit targets.",
            "risk_assessment": "See transcript for risk analysis.",
            "disclaimer": self.config.disclaimer,
        }

    def evaluate_contract_progress(self, messages: list[Message], turn_count: int) -> float:
        """Trading completion: need analysis, thesis, risk, entry/exit points."""
        min_turns = 4
        standard_turns = 8
        exceptional_turns = 12

        if turn_count < min_turns:
            return (turn_count / min_turns) * 33.33
        elif turn_count < standard_turns:
            return 33.33 + ((turn_count - min_turns) / (standard_turns - min_turns)) * 33.34
        elif turn_count < exceptional_turns:
            return 66.67 + ((turn_count - standard_turns) / (exceptional_turns - standard_turns)) * 33.33
        else:
            return 100.0


class SimulationHandler(RoomTypeHandler):
    """Handler for simulation and scenario planning rooms.

    Simulation values actionability (participant actions) and coherence (scenario logic).
    Success requires exploring scenario and outcomes.
    """

    def __init__(self, config: SimulationConfig):
        self.config = config

    def get_custom_scoring_weights(self) -> dict:
        """Simulation values actionability (decisions) and coherence (scenario logic)."""
        return {
            "relevance": 0.25,  # Stay in scenario context
            "novelty": 0.15,  # Creative responses valued
            "coherence": 0.30,  # Must follow scenario logic
            "actionability": 0.25,  # Concrete decisions/actions
            "engagement": 0.05,  # Entertainment value
        }

    def validate_message_content(self, message: Message) -> bool:
        """Simulation messages should describe actions or decisions."""
        action_terms = ["do", "decide", "choose", "action", "move", "propose", "suggest"]
        if len(message.text) < 30:
            return False

        return any(term in message.text.lower() for term in action_terms)

    def extract_artifacts(self, transcript: list[dict]) -> dict:
        """Extract scenario, actions taken, outcomes, and lessons."""
        actions_taken = [turn.get("text", "")[:200] for turn in transcript]

        return {
            "scenario": self.config.scenario_name,
            "scenario_description": self.config.scenario_description,
            "constraints": self.config.constraints,
            "actions_taken": actions_taken,
            "outcomes": "See transcript for simulated outcomes.",
            "lessons_learned": "Analysis concluded with scenario exploration complete.",
            "success_definition": self.config.success_definition,
        }

    def evaluate_contract_progress(self, messages: list[Message], turn_count: int) -> float:
        """Simulation completion: need scenario exploration and outcomes."""
        min_turns = 6
        standard_turns = 12
        exceptional_turns = 18

        if turn_count < min_turns:
            return (turn_count / min_turns) * 33.33
        elif turn_count < standard_turns:
            return 33.33 + ((turn_count - min_turns) / (standard_turns - min_turns)) * 33.34
        elif turn_count < exceptional_turns:
            return 66.67 + ((turn_count - standard_turns) / (exceptional_turns - standard_turns)) * 33.33
        else:
            return 100.0


class CustomHandler(RoomTypeHandler):
    """Handler for custom user-defined rooms.

    Allows agents to create specialized room types with custom:
    - Name and description
    - Success criteria
    - Validation rules
    - Scoring weights
    - Completion thresholds
    """

    def __init__(self, config: CustomConfig):
        self.config = config
        logger.info(
            f"Custom room handler initialized: {config.custom_name}",
            extra={"template": config.template_used},
        )

    def get_custom_scoring_weights(self) -> dict:
        """Use custom weights specified by the room creator."""
        weights = self.config.custom_scoring_weights

        # Validate weights sum to ~1.0
        total = sum(weights.values())
        if abs(total - 1.0) > 0.01:
            logger.warning(
                f"Custom weights don't sum to 1.0: {total}. Normalizing.",
                extra={"room_name": self.config.custom_name},
            )
            # Normalize
            normalized = {k: v / total for k, v in weights.items()}
            return normalized

        return weights

    def validate_message_content(self, message: Message) -> bool:
        """Apply custom validation rules."""
        if len(message.text) < 20:
            return False

        # Apply custom rules from room creator
        for rule in self.config.validation_rules:
            # Simple rule matching (in production, use NLP)
            if rule.lower() == "no questions":
                if message.text.strip().endswith("?"):
                    return False
            elif rule.lower() == "require code":
                if "```" not in message.text:
                    return False

        return True

    def extract_artifacts(self, transcript: list[dict]) -> dict:
        """Extract custom artifacts based on room type."""
        return {
            "room_type": self.config.custom_name,
            "description": self.config.custom_description,
            "success_criteria": self.config.success_criteria,
            "transcript_summary": f"Custom room concluded with {len(transcript)} turns.",
            "highlights": [turn.get("text", "")[:200] for turn in transcript[-3:] if transcript],
            "template_base": self.config.template_used,
        }

    def evaluate_contract_progress(self, messages: list[Message], turn_count: int) -> float:
        """Use custom completion thresholds."""
        min_turns = self.config.min_turns_required
        standard_turns = self.config.max_turns_standard
        exceptional_turns = self.config.max_turns_exceptional

        if turn_count < min_turns:
            return (turn_count / min_turns) * 33.33
        elif turn_count < standard_turns:
            return 33.33 + ((turn_count - min_turns) / (standard_turns - min_turns)) * 33.34
        elif turn_count < exceptional_turns:
            return 66.67 + ((turn_count - standard_turns) / (exceptional_turns - standard_turns)) * 33.33
        else:
            return 100.0


def get_handler(room_type: RoomType, config: RoomTypeConfig) -> RoomTypeHandler:
    """Factory function to get the appropriate handler for a room type.

    Args:
        room_type: The type of room
        config: The type-specific configuration

    Returns:
        RoomTypeHandler: Handler for this room type

    Raises:
        ValueError: If room_type is unknown or config type doesn't match
    """
    handlers = {
        RoomType.DEBATE: DebateHandler,
        RoomType.CODING: CodingHandler,
        RoomType.RESEARCH: ResearchHandler,
        RoomType.TRADING: TradingHandler,
        RoomType.SIMULATION: SimulationHandler,
        RoomType.CUSTOM: CustomHandler,
    }

    if room_type not in handlers:
        raise ValueError(f"Unknown room type: {room_type}")

    handler_class = handlers[room_type]

    try:
        return handler_class(config)
    except TypeError as e:
        raise ValueError(f"Config type {type(config)} doesn't match handler {handler_class}: {e}")
