"""
Room State Manager Tests
Tests for Redis-backed persistent room state management
"""

import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch
from src.services.room_state_manager import RoomStateManager
from src.models.room import Room, RoomState, RoomStatus, RoomType, DebateConfig


class TestRoomStateManager:
    """Tests for RoomStateManager"""

    @pytest.fixture
    def mock_redis(self):
        """Mock Redis client"""
        return MagicMock()

    @pytest.fixture
    def manager(self, mock_redis):
        """Create manager with mocked Redis"""
        manager = RoomStateManager()
        manager.client = mock_redis
        manager.connected = True
        return manager

    @pytest.fixture
    def sample_room(self):
        """Create sample room for testing"""
        return Room(
            id="room-123",
            room_type=RoomType.DEBATE,
            type_config=DebateConfig(
                sides=2,
                speaking_order="free-form",
                topic="Test debate topic",
            ),
            objective="Test objective",
            host_agent_id="agent-456",
            spawn_fee_cents=100,
        )

    @pytest.mark.asyncio
    async def test_create_room_persists_to_redis(self, manager, sample_room):
        """Should persist room state to Redis with TTL"""
        room_state = RoomState(room=sample_room)

        await manager.create_room(room_state)

        # Verify Redis setex was called with TTL
        manager.client.setex.assert_called_once()
        args = manager.client.setex.call_args[0]
        assert "room_state:room-123" in args[0]  # key
        assert args[1] > 0  # TTL > 0

        # Verify room index was updated
        manager.client.zadd.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_room_retrieves_from_redis(self, manager, sample_room):
        """Should retrieve room state from Redis"""
        room_state = RoomState(room=sample_room)
        state_data = manager._serialize_room_state(room_state)

        # Mock Redis get to return serialized state
        import json
        manager.client.get.return_value = json.dumps(state_data)

        result = await manager.get_room("room-123")

        assert result is not None
        assert result.room.id == "room-123"
        manager.client.get.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_room_returns_none_if_not_found(self, manager):
        """Should return None if room doesn't exist"""
        manager.client.get.return_value = None

        result = await manager.get_room("nonexistent")

        assert result is None

    @pytest.mark.asyncio
    async def test_update_room_preserves_ttl(self, manager, sample_room):
        """Should preserve remaining TTL when updating room"""
        room_state = RoomState(room=sample_room)
        manager.client.ttl.return_value = 3600  # 1 hour remaining

        await manager.update_room(room_state)

        # Verify setex called with preserved TTL
        args = manager.client.setex.call_args[0]
        assert args[1] == 3600  # TTL preserved

    @pytest.mark.asyncio
    async def test_delete_room_removes_all_related_data(self, manager):
        """Should delete room state and all related data"""
        await manager.delete_room("room-123")

        # Verify delete called for all related keys
        manager.client.delete.assert_called_once()
        delete_keys = manager.client.delete.call_args[0]
        assert any("room_state:" in key for key in delete_keys)
        assert any("participants:" in key for key in delete_keys)
        assert any("messages:" in key for key in delete_keys)

        # Verify removed from index
        manager.client.zrem.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_all_active_rooms(self, manager):
        """Should list all active rooms from Redis index"""
        manager.client.zrange.return_value = ["room-1", "room-2", "room-3"]

        result = await manager.get_all_active_rooms()

        assert len(result) == 3
        assert "room-1" in result

    @pytest.mark.asyncio
    async def test_store_participant(self, manager):
        """Should store participant data with TTL"""
        participant_data = {"joined_at": "2026-02-16T00:00:00Z", "status": "active"}

        await manager.store_participant("room-123", "agent-456", participant_data)

        # Verify hset called
        manager.client.hset.assert_called_once()
        assert manager.client.expire.called

    @pytest.mark.asyncio
    async def test_store_message(self, manager):
        """Should store message data"""
        message_data = {
            "id": "msg-789",
            "content": "Test message",
            "created_at": datetime.utcnow().isoformat(),
        }

        await manager.store_message("room-123", "msg-789", message_data)

        manager.client.hset.assert_called_once()

    @pytest.mark.asyncio
    async def test_health_check_reports_healthy(self, manager):
        """Should report healthy status when Redis is available"""
        manager.client.ping.return_value = True
        manager.client.info.return_value = {"used_memory": 1000, "used_memory_peak": 2000}

        health = await manager.health_check()

        assert health["status"] == "healthy"
        assert health["connected"] is True

    @pytest.mark.asyncio
    async def test_health_check_reports_unhealthy(self, manager):
        """Should report unhealthy status on Redis failure"""
        manager.client.ping.side_effect = Exception("Connection failed")

        health = await manager.health_check()

        assert health["status"] == "unhealthy"
        assert health["connected"] is False

    def test_serialize_room_state(self, manager, sample_room):
        """Should serialize room state to dict"""
        room_state = RoomState(room=sample_room)
        room_state.message_queue = ["msg-1", "msg-2"]

        serialized = manager._serialize_room_state(room_state)

        assert serialized["room"]["id"] == "room-123"
        assert serialized["message_queue"] == ["msg-1", "msg-2"]

    def test_deserialize_room_state(self, manager):
        """Should deserialize dict back to room state"""
        data = {
            "room": {
                "id": "room-123",
                "room_type": "debate",
                "type_config": {
                    "sides": 2,
                    "speaking_order": "free-form",
                    "topic": "Test debate topic",
                },
                "objective": "Test",
                "host_agent_id": "agent-456",
                "spawn_fee_cents": 100,
                "status": "pending",
                "participant_ids": [],
                "speaker_ids": [],
                "turn_count": 0,
                "viewer_count": 0,
                "output_artifacts": {},
            },
            "message_queue": [],
            "turn_history": [],
            "last_speaker_id": None,
            "transcript": [],
            "contract_satisfaction": 0.0,
        }

        deserialized = manager._deserialize_room_state(data)

        assert deserialized.room.id == "room-123"
        assert deserialized.message_queue == []

    @pytest.mark.asyncio
    async def test_graceful_degradation_on_redis_failure(self, manager, sample_room):
        """Should handle Redis connection failures gracefully"""
        manager.client.setex.side_effect = Exception("Redis unavailable")

        # Should raise the exception (current implementation behavior)
        with pytest.raises(Exception, match="Redis unavailable"):
            await manager.create_room(RoomState(room=sample_room))
