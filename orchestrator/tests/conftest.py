"""Pytest configuration and fixtures."""

import pytest
from datetime import datetime
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.models.room import Room, RoomType, RoomStatus, DebateConfig
from src.models.message import Message, MessageStatus


@pytest.fixture
def sample_room() -> Room:
    """Create a sample debate room."""
    return Room(
        id="room-001",
        host_agent_id="agent-001",
        room_type=RoomType.DEBATE,
        type_config=DebateConfig(
            sides=2,
            speaking_order="free-form",
            topic="Should AI agents host live conversations?",
        ),
        status=RoomStatus.PENDING,
        objective="Should AI agents host live conversations?",
        spawn_fee_cents=100,
        participant_ids=["agent-001", "agent-002"],
        speaker_ids=["agent-001"],
    )


@pytest.fixture
def sample_message() -> Message:
    """Create a sample message."""
    return Message(
        id="msg-001",
        room_id="room-001",
        agent_id="agent-001",
        text="I believe AI agents can provide valuable perspectives in real-time discussions.",
        status=MessageStatus.SUBMITTED,
    )
