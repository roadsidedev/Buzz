"""Unit tests for turn management."""

import pytest
from datetime import datetime

from orchestrator.src.services.turn_management import TurnManager
from orchestrator.src.models.message import ScoringResult
from orchestrator.src.models.room import Room, RoomState, RoomType, RoomStatus


@pytest.fixture
def turn_manager() -> TurnManager:
    """Create a turn manager instance."""
    return TurnManager()


@pytest.fixture
def sample_room_state() -> RoomState:
    """Create a sample room state."""
    room = Room(
        id="room-001",
        host_agent_id="agent-001",
        room_type=RoomType.DEBATE,
        status=RoomStatus.LIVE,
        objective="Test objective",
        spawn_fee_cents=100,
    )
    return RoomState(room=room)


def test_select_next_speaker_picks_highest_score(sample_room_state: RoomState, turn_manager: TurnManager):
    """Test that highest-scoring message is selected."""
    scores = [
        ScoringResult(
            message_id="msg-001",
            agent_id="agent-001",
            overall_score=85.0,
            relevance_score=85,
            novelty_score=80,
            coherence_score=85,
            actionability_score=80,
            engagement_score=90,
            reasoning="Great message",
        ),
        ScoringResult(
            message_id="msg-002",
            agent_id="agent-002",
            overall_score=70.0,
            relevance_score=70,
            novelty_score=70,
            coherence_score=70,
            actionability_score=70,
            engagement_score=70,
            reasoning="Okay message",
        ),
    ]

    turn = turn_manager.select_next_speaker(sample_room_state, scores)

    assert turn.selected_message_id == "msg-001"
    assert turn.selected_agent_id == "agent-001"
    assert turn.score == 85.0


def test_select_next_speaker_filters_low_scores(sample_room_state: RoomState, turn_manager: TurnManager):
    """Test that messages below threshold are rejected."""
    scores = [
        ScoringResult(
            message_id="msg-001",
            agent_id="agent-001",
            overall_score=40.0,  # Below MIN_SCORE_THRESHOLD (50)
            relevance_score=40,
            novelty_score=40,
            coherence_score=40,
            actionability_score=40,
            engagement_score=40,
            reasoning="Poor message",
        ),
    ]

    with pytest.raises(ValueError):
        turn_manager.select_next_speaker(sample_room_state, scores)


def test_select_next_speaker_skips_moderated_messages(sample_room_state: RoomState, turn_manager: TurnManager):
    """Test that moderated messages are rejected."""
    scores = [
        ScoringResult(
            message_id="msg-001",
            agent_id="agent-001",
            overall_score=0.0,  # Will be rejected
            relevance_score=0,
            novelty_score=0,
            coherence_score=0,
            actionability_score=0,
            engagement_score=0,
            reasoning="Flagged content",
            is_moderated=True,
            moderation_reason="hate_speech",
        ),
        ScoringResult(
            message_id="msg-002",
            agent_id="agent-002",
            overall_score=80.0,
            relevance_score=80,
            novelty_score=80,
            coherence_score=80,
            actionability_score=80,
            engagement_score=80,
            reasoning="Clean message",
        ),
    ]

    turn = turn_manager.select_next_speaker(sample_room_state, scores)

    assert turn.selected_message_id == "msg-002"
    assert not turn.selected_agent_id == "agent-001"


def test_count_participation_tracks_message_frequency(sample_room_state: RoomState, turn_manager: TurnManager):
    """Test that speaker participation is counted."""
    sample_room_state.transcript = [
        {"agent_id": "agent-001", "text": "First message"},
        {"agent_id": "agent-002", "text": "Response"},
        {"agent_id": "agent-001", "text": "Second message"},
    ]

    counts = turn_manager._count_participation(sample_room_state)

    assert counts.get("agent-001") == 2
    assert counts.get("agent-002") == 1
