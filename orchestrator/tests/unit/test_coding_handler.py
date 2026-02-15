"""Tests for CodingHandler room type logic."""

import pytest
from src.services.room_type_handlers import CodingHandler
from src.models.room import CodingConfig
from src.models.message import Message


@pytest.fixture
def coding_config():
    """Create a coding configuration."""
    return CodingConfig(
        language="python",
        framework="fastapi",
        problem_statement="Implement a REST API endpoint that returns sorted data",
        test_required=True,
        difficulty="medium",
    )


@pytest.fixture
def coding_handler(coding_config):
    """Create a coding handler."""
    return CodingHandler(coding_config)


class TestCodingHandlerScoringWeights:
    """Test scoring weights for coding rooms."""

    def test_actionability_weighted_high(self, coding_handler):
        """Actionability (working code) should be heavily weighted."""
        weights = coding_handler.get_custom_scoring_weights()
        assert weights["actionability"] >= 0.25, "Coding should emphasize working code"

    def test_coherence_important(self, coding_handler):
        """Coherence matters for building incrementally."""
        weights = coding_handler.get_custom_scoring_weights()
        assert weights["coherence"] >= 0.25, "Coding needs coherent progression"

    def test_weights_sum_to_one(self, coding_handler):
        """Weights must sum to 1.0."""
        weights = coding_handler.get_custom_scoring_weights()
        assert abs(sum(weights.values()) - 1.0) < 0.01


class TestCodingHandlerMessageValidation:
    """Test message validation for coding rooms."""

    def test_code_block_accepted(self, coding_handler):
        """Messages with code blocks should be accepted."""
        msg = Message(
            id="msg-1",
            room_id="room-1",
            agent_id="agent-1",
            text="Here's the implementation:\n```python\ndef sort_data(data):\n    return sorted(data)\n```",
        )
        assert coding_handler.validate_message_content(msg) is True

    def test_technical_discussion_accepted(self, coding_handler):
        """Technical discussions should be accepted."""
        msg = Message(
            id="msg-2",
            room_id="room-1",
            agent_id="agent-2",
            text="We need to refactor this algorithm to use a more efficient data structure. An AVL tree would give us O(log n) insertion.",
        )
        assert coding_handler.validate_message_content(msg) is True

    def test_non_technical_rejected(self, coding_handler):
        """Non-technical messages should be rejected."""
        msg = Message(
            id="msg-3",
            room_id="room-1",
            agent_id="agent-3",
            text="This is a great project to work on!",
        )
        assert coding_handler.validate_message_content(msg) is False

    def test_too_short_rejected(self, coding_handler):
        """Very short messages rejected."""
        msg = Message(
            id="msg-4",
            room_id="room-1",
            agent_id="agent-4",
            text="Done",
        )
        assert coding_handler.validate_message_content(msg) is False

    def test_function_definition_accepted(self, coding_handler):
        """Function definitions should be accepted."""
        msg = Message(
            id="msg-5",
            room_id="room-1",
            agent_id="agent-5",
            text="def quick_sort(arr):\n    if len(arr) <= 1:\n        return arr\n    pivot = arr[0]\n    return quick_sort([x for x in arr[1:] if x < pivot]) + [pivot] + quick_sort([x for x in arr[1:] if x >= pivot])",
        )
        assert coding_handler.validate_message_content(msg) is True


class TestCodingHandlerArtifactExtraction:
    """Test artifact extraction for coding rooms."""

    def test_extract_problem_statement(self, coding_handler):
        """Problem statement should be in artifacts."""
        artifacts = coding_handler.extract_artifacts([])
        assert artifacts["problem"] == "Implement a REST API endpoint that returns sorted data"

    def test_extract_language_and_framework(self, coding_handler):
        """Language and framework should be extracted."""
        artifacts = coding_handler.extract_artifacts([])
        assert artifacts["language"] == "python"
        assert "approach" in artifacts

    def test_extract_final_code(self, coding_handler):
        """Extract the final code block from transcript."""
        transcript = [
            {"text": "First attempt:\n```python\nreturn data\n```"},
            {"text": "Final solution:\n```python\ndef sort_data(data):\n    return sorted(data)\n```"},
        ]
        artifacts = coding_handler.extract_artifacts(transcript)
        assert "final_solution" in artifacts

    def test_extract_test_requirement(self, coding_handler):
        """Test requirement should be in artifacts."""
        artifacts = coding_handler.extract_artifacts([])
        assert artifacts["tests_required"] is True


class TestCodingHandlerContractProgress:
    """Test contract progress for coding rooms."""

    def test_progress_at_minimum_turns(self, coding_handler):
        """At 3 turns (minimum), should be ~33% complete."""
        progress = coding_handler.evaluate_contract_progress([], 3)
        assert 30 < progress < 35

    def test_progress_at_standard_turns(self, coding_handler):
        """At 6 turns (standard), should be ~66% complete."""
        progress = coding_handler.evaluate_contract_progress([], 6)
        assert 65 < progress < 70

    def test_progress_at_exceptional_turns(self, coding_handler):
        """At 10 turns (exceptional), should be 100% complete."""
        progress = coding_handler.evaluate_contract_progress([], 10)
        assert progress == 100.0

    def test_zero_progress_at_zero_turns(self, coding_handler):
        """Zero turns should be 0% progress."""
        progress = coding_handler.evaluate_contract_progress([], 0)
        assert progress == 0.0
