"""Tests for DebateHandler room type logic."""

import pytest
from src.services.room_type_handlers import DebateHandler
from src.models.room import DebateConfig
from src.models.message import Message


@pytest.fixture
def debate_config():
    """Create a debate configuration."""
    return DebateConfig(sides=2, speaking_order="free-form", topic="AI Impact on Employment")


@pytest.fixture
def debate_handler(debate_config):
    """Create a debate handler."""
    return DebateHandler(debate_config)


@pytest.fixture
def sample_debate_message():
    """Create a sample debate message."""
    return Message(
        id="msg-1",
        room_id="room-1",
        agent_id="agent-1",
        text="AI automation will create new jobs in tech sectors while displacing traditional roles. Historical precedent suggests workers adapt over 10-20 years.",
    )


class TestDebateHandlerScoringWeights:
    """Test scoring weight configuration for debates."""

    def test_scoring_weights_sum_to_one(self, debate_handler):
        """Weights should sum to 1.0."""
        weights = debate_handler.get_custom_scoring_weights()
        total = sum(weights.values())
        assert abs(total - 1.0) < 0.01, f"Weights sum to {total}, not 1.0"

    def test_novelty_weighted_higher(self, debate_handler):
        """Novelty should be weighted higher than average (0.2)."""
        weights = debate_handler.get_custom_scoring_weights()
        assert weights["novelty"] >= 0.25, "Debate should emphasize novelty"

    def test_relevance_maintained(self, debate_handler):
        """Relevance still important for staying on topic."""
        weights = debate_handler.get_custom_scoring_weights()
        assert weights["relevance"] >= 0.25, "Debate needs relevance"

    def test_actionability_downweighted(self, debate_handler):
        """Actionability is less critical in debate."""
        weights = debate_handler.get_custom_scoring_weights()
        assert weights["actionability"] <= 0.15, "Actionability not critical for debate"


class TestDebateHandlerMessageValidation:
    """Test message validation for debates."""

    def test_valid_argument_accepted(self, debate_handler, sample_debate_message):
        """Well-formed arguments should be accepted."""
        assert debate_handler.validate_message_content(sample_debate_message) is True

    def test_too_short_rejected(self, debate_handler):
        """Messages too short to be arguments should be rejected."""
        short_msg = Message(
            id="msg-2", room_id="room-1", agent_id="agent-2", text="I agree."
        )
        assert debate_handler.validate_message_content(short_msg) is False

    def test_pure_question_rejected(self, debate_handler):
        """Pure questions should be rejected (not arguments)."""
        question = Message(
            id="msg-3",
            room_id="room-1",
            agent_id="agent-3",
            text="Do you think AI will take all our jobs?",
        )
        assert debate_handler.validate_message_content(question) is False

    def test_argument_with_evidence_accepted(self, debate_handler):
        """Arguments with evidence should be accepted."""
        msg = Message(
            id="msg-4",
            room_id="room-1",
            agent_id="agent-4",
            text="Studies show that previous industrial revolutions displaced workers but created more jobs overall. Factory automation created demand for maintenance technicians.",
        )
        assert debate_handler.validate_message_content(msg) is True


class TestDebateHandlerArtifactExtraction:
    """Test artifact extraction from debate transcripts."""

    def test_extract_topic(self, debate_handler):
        """Debate topic should be in artifacts."""
        artifacts = debate_handler.extract_artifacts([])
        assert artifacts["debate_topic"] == "AI Impact on Employment"

    def test_extract_sides_count(self, debate_handler):
        """Sides count should match config."""
        artifacts = debate_handler.extract_artifacts([])
        assert artifacts["sides"] == 2

    def test_extract_arguments_from_transcript(self, debate_handler):
        """Extract pro/con arguments from transcript."""
        transcript = [
            {"text": "AI creates efficiency gains"},
            {"text": "But workers lose livelihoods"},
            {"text": "Tech sector will absorb displaced workers"},
        ]
        artifacts = debate_handler.extract_artifacts(transcript)
        assert "pro_arguments" in artifacts
        assert "con_arguments" in artifacts
        assert len(artifacts["pro_arguments"]) > 0
        assert len(artifacts["con_arguments"]) > 0

    def test_include_conclusion(self, debate_handler):
        """Should include debate conclusion in artifacts."""
        artifacts = debate_handler.extract_artifacts([{"text": "Test"}, {"text": "Test2"}])
        assert "conclusion_summary" in artifacts


class TestDebateHandlerContractProgress:
    """Test output contract progress evaluation."""

    def test_zero_turns_zero_progress(self, debate_handler):
        """Zero turns should yield 0% progress."""
        progress = debate_handler.evaluate_contract_progress([], 0)
        assert progress == 0.0

    def test_progress_at_minimum_turns(self, debate_handler):
        """At minimum turns, should be ~33% complete."""
        progress = debate_handler.evaluate_contract_progress([], 6)
        assert 30 < progress < 35, f"At 6 turns, expected ~33%, got {progress}"

    def test_progress_at_standard_turns(self, debate_handler):
        """At standard turns, should be ~66% complete."""
        progress = debate_handler.evaluate_contract_progress([], 10)
        assert 65 < progress < 70, f"At 10 turns, expected ~67%, got {progress}"

    def test_progress_at_exceptional_turns(self, debate_handler):
        """At exceptional turns, should be 100% complete."""
        progress = debate_handler.evaluate_contract_progress([], 14)
        assert progress == 100.0

    def test_progress_exceeding_exceptional(self, debate_handler):
        """Beyond exceptional, should stay at 100%."""
        progress = debate_handler.evaluate_contract_progress([], 20)
        assert progress == 100.0

    def test_monotonic_progress(self, debate_handler):
        """Progress should increase monotonically."""
        prev_progress = 0
        for turns in range(0, 15):
            progress = debate_handler.evaluate_contract_progress([], turns)
            assert progress >= prev_progress, f"Progress decreased from {prev_progress} to {progress}"
            prev_progress = progress
