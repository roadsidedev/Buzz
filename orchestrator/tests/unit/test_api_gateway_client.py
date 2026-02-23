"""Unit tests for API Gateway client."""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import httpx

from src.clients.api_gateway_client import APIGatewayClient
from src.models.message import Message, MessageStatus


@pytest.fixture
def api_client() -> APIGatewayClient:
    """Create API Gateway client instance."""
    return APIGatewayClient(base_url="http://localhost:4000")


@pytest.mark.asyncio
async def test_get_message_success(api_client: APIGatewayClient):
    """Test fetching a single message succeeds."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "data": {
            "id": "msg-001",
            "room_id": "room-001",
            "agent_id": "agent-001",
            "text": "Test message",
            "status": "submitted",
        }
    }

    with patch.object(api_client.client, "get", new_callable=AsyncMock, return_value=mock_response):
        message = await api_client.get_message("msg-001")

    assert message is not None
    assert message.id == "msg-001"
    assert message.text == "Test message"
    assert message.agent_id == "agent-001"


@pytest.mark.asyncio
async def test_get_message_not_found(api_client: APIGatewayClient):
    """Test fetching non-existent message returns None."""
    mock_response = MagicMock()
    mock_response.status_code = 404

    with patch.object(api_client.client, "get", new_callable=AsyncMock, return_value=mock_response):
        message = await api_client.get_message("nonexistent")

    assert message is None


@pytest.mark.asyncio
async def test_get_message_http_error(api_client: APIGatewayClient):
    """Test API error propagates."""
    with patch.object(
        api_client.client, "get", new_callable=AsyncMock, side_effect=httpx.HTTPError("Connection failed")
    ):
        with pytest.raises(httpx.HTTPError):
            await api_client.get_message("msg-001")


@pytest.mark.asyncio
async def test_get_messages_batch_success(api_client: APIGatewayClient):
    """Test batch message fetching."""
    messages_data = [
        {
            "id": f"msg-{i:03d}",
            "room_id": "room-001",
            "agent_id": f"agent-{i:03d}",
            "text": f"Message {i}",
            "status": "submitted",
        }
        for i in range(3)
    ]

    async def mock_get_message(msg_id: str):
        for msg_data in messages_data:
            if msg_data["id"] == msg_id:
                return Message(**msg_data)
        return None

    with patch.object(api_client, "get_message", side_effect=mock_get_message):
        messages = await api_client.get_messages_batch(["msg-000", "msg-001", "msg-002"])

    assert len(messages) == 3
    assert messages[0].id == "msg-000"
    assert messages[1].id == "msg-001"
    assert messages[2].id == "msg-002"


@pytest.mark.asyncio
async def test_get_messages_batch_empty(api_client: APIGatewayClient):
    """Test batch with empty list returns empty list."""
    messages = await api_client.get_messages_batch([])
    assert messages == []


@pytest.mark.asyncio
async def test_get_messages_batch_partial_failure(api_client: APIGatewayClient):
    """Test batch continues on partial failures."""

    async def mock_get_message(msg_id: str):
        if msg_id == "msg-001":
            raise httpx.HTTPError("Failed")
        return Message(
            id=msg_id,
            room_id="room-001",
            agent_id="agent-001",
            text=f"Message {msg_id}",
            status="submitted",
        )

    with patch.object(api_client, "get_message", side_effect=mock_get_message):
        messages = await api_client.get_messages_batch(["msg-000", "msg-001", "msg-002"])

    # Should return 2 messages (skipping the failed one)
    assert len(messages) == 2
    assert messages[0].id == "msg-000"
    assert messages[1].id == "msg-002"


@pytest.mark.asyncio
async def test_update_message_status_success(api_client: APIGatewayClient):
    """Test updating message status succeeds."""
    mock_response = MagicMock()
    mock_response.status_code = 200

    with patch.object(api_client.client, "patch", new_callable=AsyncMock, return_value=mock_response):
        success = await api_client.update_message_status("msg-001", MessageStatus.SCORED)

    assert success is True


@pytest.mark.asyncio
async def test_update_message_status_not_found(api_client: APIGatewayClient):
    """Test updating non-existent message returns False."""
    mock_response = MagicMock()
    mock_response.status_code = 404

    with patch.object(api_client.client, "patch", new_callable=AsyncMock, return_value=mock_response):
        success = await api_client.update_message_status("msg-001", MessageStatus.SELECTED)

    assert success is False


@pytest.mark.asyncio
async def test_update_message_status_error(api_client: APIGatewayClient):
    """Test API error is caught and returns False."""
    with patch.object(
        api_client.client, "patch", new_callable=AsyncMock, side_effect=httpx.HTTPError("Connection failed")
    ):
        success = await api_client.update_message_status("msg-001", MessageStatus.PLAYED)

    assert success is False


@pytest.mark.asyncio
async def test_health_check_healthy(api_client: APIGatewayClient):
    """Test health check returns True when gateway is healthy."""
    mock_response = MagicMock()
    mock_response.status_code = 200

    with patch.object(api_client.client, "get", new_callable=AsyncMock, return_value=mock_response):
        healthy = await api_client.health_check()

    assert healthy is True


@pytest.mark.asyncio
async def test_health_check_unhealthy(api_client: APIGatewayClient):
    """Test health check returns False when gateway is down."""
    with patch.object(api_client.client, "get", new_callable=AsyncMock, side_effect=httpx.HTTPError("Timeout")):
        healthy = await api_client.health_check()

    assert healthy is False
