"""Integration tests for full orchestration flow."""

import pytest
from datetime import datetime

from src.services.orchestration_service import OrchestrationService
from src.models.room import Room, RoomType, RoomStatus
from src.models.message import Message, MessageStatus


@pytest.fixture
def orchestration_service() -> OrchestrationService:
    """Create an orchestration service instance."""
    return OrchestrationService()


@pytest.mark.asyncio
async def test_create_room_initializes_state(orchestration_service: OrchestrationService):
    """Test that room creation initializes state."""
    room = Room(
        id="room-001",
        host_agent_id="agent-001",
        room_type=RoomType.DEBATE,
        status=RoomStatus.PENDING,
        objective="Should AI host conversations?",
        spawn_fee_cents=100,
    )

    room_state = await orchestration_service.create_room(room)

    assert room_state.room.id == "room-001"
    assert room_state.room.status == RoomStatus.PENDING
    assert len(room_state.message_queue) == 0
    assert len(room_state.transcript) == 0


@pytest.mark.asyncio
async def test_start_room_transitions_to_live(orchestration_service: OrchestrationService):
    """Test that starting a room changes status to LIVE."""
    room = Room(
        id="room-001",
        host_agent_id="agent-001",
        room_type=RoomType.DEBATE,
        status=RoomStatus.PENDING,
        objective="Test",
        spawn_fee_cents=100,
    )

    await orchestration_service.create_room(room)
    room_state = await orchestration_service.start_room("room-001")

    assert room_state.room.status == RoomStatus.LIVE
    assert room_state.room.started_at is not None


@pytest.mark.asyncio
async def test_submit_message_adds_to_queue(orchestration_service: OrchestrationService):
    """Test that submitted messages are queued."""
    room = Room(
        id="room-001",
        host_agent_id="agent-001",
        room_type=RoomType.DEBATE,
        status=RoomStatus.PENDING,
        objective="Test",
        spawn_fee_cents=100,
    )

    await orchestration_service.create_room(room)

    message = Message(
        id="msg-001",
        room_id="room-001",
        agent_id="agent-002",
        text="I have a perspective to share.",
        status=MessageStatus.SUBMITTED,
    )

    await orchestration_service.submit_message(message, "room-001")

    room_state = await orchestration_service.get_room_state("room-001")
    assert "msg-001" in room_state.message_queue


@pytest.mark.asyncio
async def test_close_room_finalizes_state(orchestration_service: OrchestrationService):
    """Test that closing room finalizes state."""
    room = Room(
        id="room-001",
        host_agent_id="agent-001",
        room_type=RoomType.DEBATE,
        status=RoomStatus.LIVE,
        objective="Test",
        spawn_fee_cents=100,
    )

    await orchestration_service.create_room(room)
    room_state = await orchestration_service.close_room("room-001", reason="test")

    assert room_state.room.status == RoomStatus.COMPLETED
    assert room_state.room.completed_at is not None
    assert "transcript" in room_state.room.output_artifacts


@pytest.mark.asyncio
async def test_get_room_state_raises_on_missing_room(orchestration_service: OrchestrationService):
    """Test that getting nonexistent room raises error."""
    with pytest.raises(ValueError):
        await orchestration_service.get_room_state("nonexistent-room")


@pytest.mark.asyncio
async def test_submit_message_raises_on_missing_room(orchestration_service: OrchestrationService):
    """Test that submitting to nonexistent room raises error."""
    message = Message(
        id="msg-001",
        room_id="nonexistent",
        agent_id="agent-001",
        text="Test",
        status=MessageStatus.SUBMITTED,
    )

    with pytest.raises(ValueError):
        await orchestration_service.submit_message(message, "nonexistent")
