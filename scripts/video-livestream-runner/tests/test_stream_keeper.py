"""Tests for stream_keeper.py"""

from unittest.mock import MagicMock, patch

import pytest

from stream_keeper import StreamKeeper, RespawnResult


@pytest.fixture
def mock_bridge():
    bridge = MagicMock()
    bridge.get_livestream_status.return_value = "live"
    bridge.send_heartbeat.return_value = True
    return bridge


class TestStreamKeeper:
    def test_initial_state(self, mock_bridge):
        keeper = StreamKeeper(bridge=mock_bridge)
        assert keeper.stream_id == ""
        assert keeper.rtmp_url == ""
        assert keeper.respawn_count == 0
        assert keeper.failed is False

    def test_start_and_stop(self, mock_bridge):
        keeper = StreamKeeper(bridge=mock_bridge)
        keeper.start(
            stream_id="stream-1",
            rtmp_url="rtmp://test/app/key",
            agent=MagicMock(),
        )
        assert keeper.stream_id == "stream-1"
        assert keeper.rtmp_url == "rtmp://test/app/key"
        keeper.stop()
        assert keeper.failed is False

    def test_update_stream(self, mock_bridge):
        keeper = StreamKeeper(bridge=mock_bridge)
        keeper.update_stream("new-id", "rtmp://new/app/key")
        assert keeper.stream_id == "new-id"
        assert keeper.rtmp_url == "rtmp://new/app/key"

    def test_respawn_success(self, mock_bridge):
        from livestream_bridge import Livestream

        mock_bridge.create_livestream.return_value = Livestream(
            id="new-stream",
            stream_key="new-key",
            stream_server_url="rtmp://test/app",
            status="live",
            title="Test",
            category="News",
        )
        mock_bridge.build_rtmp_url.return_value = "rtmp://test/app/new-key"

        keeper = StreamKeeper(bridge=mock_bridge)
        keeper._agent = MagicMock()

        result = keeper._respawn("old-stream")
        assert result.success is True
        assert result.new_stream_id == "new-stream"
        assert result.new_rtmp_url == "rtmp://test/app/new-key"
        assert result.attempt == 1

    def test_respawn_failure(self, mock_bridge):
        mock_bridge.create_livestream.side_effect = Exception("API error")

        keeper = StreamKeeper(
            bridge=mock_bridge,
            max_attempts=2,
        )
        keeper._agent = MagicMock()

        result = keeper._respawn("old-stream")
        assert result.success is False
        assert result.new_stream_id == ""
        assert keeper.failed is True
        assert "2 attempts" in result.error or "All" in result.error

    def test_respawn_calls_callback(self, mock_bridge):
        from livestream_bridge import Livestream

        callback = MagicMock()

        mock_bridge.create_livestream.return_value = Livestream(
            id="new-stream",
            stream_key="new-key",
            stream_server_url="rtmp://test/app",
            status="live",
            title="Test",
            category="News",
        )
        mock_bridge.build_rtmp_url.return_value = "rtmp://test/app/new-key"

        keeper = StreamKeeper(bridge=mock_bridge, on_stream_changed=callback)
        keeper._agent = MagicMock()

        keeper._respawn("old-stream")
        callback.assert_called_once()

    def test_respawn_count_increments(self, mock_bridge):
        from livestream_bridge import Livestream

        mock_bridge.create_livestream.return_value = Livestream(
            id="new-stream",
            stream_key="new-key",
            stream_server_url="rtmp://test/app",
            status="live",
            title="Test",
            category="News",
        )
        mock_bridge.build_rtmp_url.return_value = "rtmp://test/app/new-key"

        keeper = StreamKeeper(bridge=mock_bridge)
        keeper._agent = MagicMock()
        assert keeper.respawn_count == 0

        keeper._respawn("old-stream")
        assert keeper.respawn_count == 1
