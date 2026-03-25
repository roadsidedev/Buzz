#!/usr/bin/env python3
"""
test_room_keeper.py
Unit tests for the RoomKeeper module.
"""

import threading
import time
from unittest.mock import MagicMock, patch

import pytest

from room_keeper import RoomKeeper, RespawnResult


class MockAgent:
    """Stand-in for RegisteredAgent."""

    def __init__(self, id: str = "agent-1", api_key: str = "key-1", name: str = "Test") -> None:
        self.id = id
        self.api_key = api_key
        self.name = name


class TestRoomKeeper:
    """Tests for the RoomKeeper watchdog."""

    def test_room_id_property(self) -> None:
        bridge = MagicMock()
        keeper = RoomKeeper(bridge=bridge)
        keeper.update_room_id("test-room-123")
        assert keeper.room_id == "test-room-123"

    def test_update_room_id(self) -> None:
        bridge = MagicMock()
        keeper = RoomKeeper(bridge=bridge)
        keeper.update_room_id("room-a")
        assert keeper.room_id == "room-a"
        keeper.update_room_id("room-b")
        assert keeper.room_id == "room-b"

    def test_respawn_creates_new_room(self) -> None:
        bridge = MagicMock()
        bridge.create_room.return_value = "new-room-id"
        bridge.join_room.return_value = None

        host = MockAgent(id="host-1")
        cohost = MockAgent(id="cohost-1")
        callback = MagicMock()

        keeper = RoomKeeper(bridge=bridge, on_room_changed=callback)
        keeper._host_agent = host
        keeper._cohost_agent = cohost
        keeper._room_type = "debate"
        keeper._objective = "Test"

        result = keeper._respawn("old-room-id")

        assert result.success
        assert result.new_room_id == "new-room-id"
        assert result.old_room_id == "old-room-id"
        bridge.create_room.assert_called_once()
        bridge.join_room.assert_called_once()
        callback.assert_called_once_with("old-room-id", "new-room-id")

    def test_respawn_retries_on_failure(self) -> None:
        bridge = MagicMock()
        bridge.create_room.side_effect = [
            RuntimeError("fail 1"),
            RuntimeError("fail 2"),
            "new-room-id",
        ]
        bridge.join_room.return_value = None

        host = MockAgent()
        cohost = MockAgent()

        keeper = RoomKeeper(bridge=bridge, max_attempts=5)
        keeper._host_agent = host
        keeper._cohost_agent = cohost

        result = keeper._respawn("old")

        assert result.success
        assert result.attempt == 3
        assert bridge.create_room.call_count == 3

    def test_respawn_exhausts_attempts(self) -> None:
        bridge = MagicMock()
        bridge.create_room.side_effect = RuntimeError("always fail")

        host = MockAgent()
        cohost = MockAgent()

        keeper = RoomKeeper(bridge=bridge, max_attempts=2)
        keeper._host_agent = host
        keeper._cohost_agent = cohost

        result = keeper._respawn("old")

        assert not result.success
        assert result.attempt == 2
        assert "exhausted" in result.error

    def test_watch_loop_detects_dead_room(self) -> None:
        """Integration: start keeper, mock a dead room, verify respawn."""
        bridge = MagicMock()
        bridge.get_room_status.return_value = "completed"  # dead
        bridge.create_room.return_value = "respawned-room"
        bridge.join_room.return_value = None

        host = MockAgent()
        cohost = MockAgent()
        callback = MagicMock()

        keeper = RoomKeeper(
            bridge=bridge,
            on_room_changed=callback,
            check_interval=1,  # 1 second for fast test
        )
        keeper.start("doomed-room", host, cohost)

        # Wait for watchdog to detect + respawn
        time.sleep(3)
        keeper.stop()

        assert keeper.respawn_count >= 1
        assert keeper.room_id == "respawned-room"

    def test_watch_loop_healthy_room_no_respawn(self) -> None:
        """If room is live, no respawn should occur."""
        bridge = MagicMock()
        bridge.get_room_status.return_value = "live"

        keeper = RoomKeeper(bridge=bridge, check_interval=1)
        keeper.start("healthy-room", MockAgent(), MockAgent())

        time.sleep(2.5)
        keeper.stop()

        assert keeper.respawn_count == 0
        assert keeper.room_id == "healthy-room"
