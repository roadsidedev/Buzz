"""Tests for livestream_bridge.py"""

from unittest.mock import MagicMock, patch

import pytest

from livestream_bridge import LivestreamBridge, RegisteredAgent


@pytest.fixture
def bridge():
    b = LivestreamBridge(backend_url="http://test.local", system_secret="test-secret")
    yield b
    b.close()


@pytest.fixture
def mock_agent():
    return RegisteredAgent(
        id="agent-123",
        api_key="beely_test_key_abc",
        name="TestAnchor",
    )


class TestLivestreamBridge:
    def test_build_rtmp_url(self, bridge):
        from livestream_bridge import Livestream

        stream = Livestream(
            id="stream-1",
            stream_key="abc123",
            stream_server_url="rtmp://live.test.app/app",
            status="live",
            title="Test",
            category="News",
        )
        url = bridge.build_rtmp_url(stream)
        assert url == "rtmp://live.test.app/app/abc123"

    def test_build_rtmp_url_trailing_slash(self, bridge):
        from livestream_bridge import Livestream

        stream = Livestream(
            id="stream-1",
            stream_key="key123",
            stream_server_url="rtmp://live.test.app/app/",
            status="live",
            title="Test",
            category="News",
        )
        url = bridge.build_rtmp_url(stream)
        assert url == "rtmp://live.test.app/app/key123"

    def test_auth_headers_with_secret(self, bridge):
        headers = bridge._auth_headers("test-key")
        assert headers["Authorization"] == "Bearer test-key"
        assert headers["X-Buzz-System-Secret"] == "test-secret"

    def test_auth_headers_without_secret(self):
        b = LivestreamBridge(backend_url="http://test.local")
        headers = b._auth_headers("test-key")
        assert "X-Buzz-System-Secret" not in headers
        b.close()

    def test_assert_ok_passes(self, bridge):
        resp = MagicMock()
        resp.status_code = 200
        bridge._assert_ok(resp, "test")  # should not raise

    def test_assert_ok_raises(self, bridge):
        resp = MagicMock()
        resp.status_code = 500
        resp.json.return_value = {"error": "server error"}
        with pytest.raises(RuntimeError, match="500"):
            bridge._assert_ok(resp, "test")

    def test_register_or_reuse_agent_pre_auth_valid(self, bridge):
        with patch.object(bridge, '_retry_get') as mock_get:
            mock_get.return_value.status_code = 200
            mock_get.return_value.json.return_value = {
                "data": {"id": "agent-1", "name": "PreAuthAnchor"}
            }
            agent = bridge.register_or_reuse_agent(
                name="Anchor", username="video_anchor_01",
                pre_auth_key="beely_preauth_key",
            )
            assert agent.id == "agent-1"
            assert agent.api_key == "beely_preauth_key"
            assert agent.name == "PreAuthAnchor"

    def test_register_or_reuse_agent_pre_auth_invalid_falls_back(self, bridge):
        bridge._load_agent_credentials = MagicMock(return_value={})
        with patch.object(bridge, '_retry_get') as mock_get:
            mock_get.return_value.status_code = 401
            with patch.object(bridge, 'register_agent') as mock_reg:
                mock_reg.return_value = RegisteredAgent(
                    id="agent-new", api_key="beely_new", name="NewAnchor"
                )
                agent = bridge.register_or_reuse_agent(
                    name="Anchor", username="video_anchor_01",
                    pre_auth_key="beely_bad_key",
                )
                assert agent.id == "agent-new"
                mock_reg.assert_called_once()

    def test_register_agent(self, bridge):
        with patch.object(bridge._client, 'post') as mock_post:
            mock_post.return_value.status_code = 201
            mock_post.return_value.json.return_value = {
                "agent": {"id": "agent-new", "api_key": "beely_new_key"}
            }
            agent = bridge.register_agent("Test Anchor", "test_anchor_01")
            assert agent.id == "agent-new"
            assert agent.api_key == "beely_new_key"
            assert agent.name == "Test Anchor"

    def test_create_livestream(self, bridge, mock_agent):
        with patch.object(bridge._client, 'post') as mock_post:
            mock_post.return_value.status_code = 201
            mock_post.return_value.json.return_value = {
                "success": True,
                "data": {
                    "stream": {
                        "id": "stream-1",
                        "hostAgentId": "agent-123",
                        "hostAgentName": "TestAnchor",
                        "title": "Test Stream",
                        "description": "",
                        "category": "News",
                        "streamCapabilities": ["video", "audio", "chat"],
                        "status": "live",
                        "viewerCount": 0,
                        "createdAt": "2026-01-01T00:00:00Z",
                    },
                    "streamServerUrl": "rtmp://live.test.app/app",
                    "streamKey": "abc123",
                },
            }
            stream = bridge.create_livestream(
                agent=mock_agent, title="Test Stream", category="News",
            )
            assert stream.id == "stream-1"
            assert stream.stream_key == "abc123"
            assert stream.status == "live"

    def test_send_heartbeat_success(self, bridge, mock_agent):
        with patch.object(bridge._client, 'post') as mock_post:
            mock_post.return_value.status_code = 200
            assert bridge.send_heartbeat("stream-1", mock_agent) is True

    def test_send_heartbeat_failure(self, bridge, mock_agent):
        with patch.object(bridge._client, 'post') as mock_post:
            mock_post.return_value.status_code = 404
            assert bridge.send_heartbeat("stream-1", mock_agent) is False
