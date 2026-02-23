"""Unit tests for output contract validation."""

import pytest

from src.services.output_contracts import ContractValidator
from src.models.room import Room, RoomState, RoomType, RoomStatus, CompletionLevel, DebateConfig


@pytest.fixture
def contract_validator() -> ContractValidator:
    """Create a contract validator instance."""
    return ContractValidator()


def _create_debate_room(room_id="room-001", turn_count=4) -> Room:
    """Helper to create a debate room with all required fields."""
    return Room(
        id=room_id,
        host_agent_id="agent-001",
        room_type=RoomType.DEBATE,
        type_config=DebateConfig(
            sides=2,
            speaking_order="free-form",
            topic="Test debate topic",
        ),
        status=RoomStatus.LIVE,
        objective="Test",
        spawn_fee_cents=100,
        turn_count=turn_count,
    )


def test_get_contract_returns_debate_contract(contract_validator: ContractValidator):
    """Test that debate contract is returned."""
    contract = contract_validator.get_contract(RoomType.DEBATE)

    assert contract.room_type == RoomType.DEBATE
    assert contract.minimum_turns == 4
    assert contract.standard_turns == 8
    assert len(contract.success_criteria) > 0


def test_evaluate_completion_minimum_level(contract_validator: ContractValidator):
    """Test completion evaluation at minimum level."""
    room = _create_debate_room(turn_count=4)  # Minimum for debate
    room_state = RoomState(room=room)

    level, satisfaction, unfulfilled = contract_validator.evaluate_completion(room_state, "")

    assert level == CompletionLevel.MINIMUM
    assert 50 <= satisfaction < 85


def test_evaluate_completion_standard_level(contract_validator: ContractValidator):
    """Test completion evaluation at standard level."""
    room = _create_debate_room(turn_count=8)  # Standard for debate
    room_state = RoomState(room=room)

    level, satisfaction, unfulfilled = contract_validator.evaluate_completion(room_state, "")

    assert level == CompletionLevel.STANDARD
    assert satisfaction == 85.0


def test_evaluate_completion_exceptional_level(contract_validator: ContractValidator):
    """Test completion evaluation at exceptional level."""
    room = _create_debate_room(turn_count=12)  # Exceptional for debate
    room_state = RoomState(room=room)

    level, satisfaction, unfulfilled = contract_validator.evaluate_completion(room_state, "")

    assert level == CompletionLevel.EXCEPTIONAL
    assert satisfaction == 100.0


def test_should_close_room_at_standard_threshold(contract_validator: ContractValidator):
    """Test that room closes when standard threshold is met."""
    room = _create_debate_room(turn_count=8)  # Standard threshold
    room_state = RoomState(room=room)

    should_close = contract_validator.should_close_room(room_state)

    assert should_close is True


def test_should_not_close_room_below_threshold(contract_validator: ContractValidator):
    """Test that room doesn't close below threshold."""
    room = _create_debate_room(turn_count=5)  # Below standard
    room_state = RoomState(room=room)

    should_close = contract_validator.should_close_room(room_state)

    assert should_close is False


def test_generate_artifacts_includes_transcript(contract_validator: ContractValidator):
    """Test that artifacts include transcript."""
    room = _create_debate_room()
    room_state = RoomState(room=room)
    room_state.transcript = [{"agent_id": "agent-001", "text": "Test message"}]

    artifacts = contract_validator.generate_artifacts(room_state)

    assert "transcript" in artifacts
    assert artifacts["room_id"] == "room-001"
    assert artifacts["room_type"] == "debate"
