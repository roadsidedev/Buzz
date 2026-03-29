"""HTTP client for Phase 1 API Gateway integration."""

import logging
from typing import Optional

import httpx

from ..config.settings import settings
from ..models.message import Message, MessageStatus

logger = logging.getLogger(__name__)


class APIGatewayClient:
    """
    Client for communicating with Phase 1 API Gateway.

    Handles message fetching and other data access via HTTP API.
    """

    def __init__(self, base_url: str = "http://localhost:4000"):
        """
        Initialize API Gateway client.

        Args:
            base_url: Base URL of Phase 1 API Gateway
        """
        self.base_url = base_url
        self.client = httpx.AsyncClient(base_url=base_url, timeout=10.0)

    async def close(self) -> None:
        """Close HTTP client connection."""
        await self.client.aclose()

    async def get_message(self, message_id: str) -> Optional[Message]:
        """
        Fetch a single message from API Gateway.

        Args:
            message_id: Message UUID

        Returns:
            Message object or None if not found

        Raises:
            httpx.HTTPError: If API call fails
        """
        try:
            response = await self.client.get(
                f"/api/v1/messages/{message_id}",
                headers={"Accept": "application/json"},
            )

            if response.status_code == 404:
                logger.warning("Message not found", extra={"message_id": message_id})
                return None

            response.raise_for_status()

            data = response.json()

            # Extract message from response envelope
            if "data" in data:
                msg_data = data["data"]
            else:
                msg_data = data

            return Message(**msg_data)

        except httpx.HTTPError as e:
            logger.error(
                "Failed to fetch message from API Gateway",
                extra={"message_id": message_id, "error": str(e)},
            )
            raise

    async def get_messages_batch(self, message_ids: list[str]) -> list[Message]:
        """
        Fetch multiple messages from API Gateway in a single HTTP request (H10).

        Uses GET /api/v1/messages/batch?ids=<csv> which resolves all IDs in one
        DB query instead of N individual round-trips.  Falls back to sequential
        per-ID fetches only when the batch endpoint returns a non-2xx status so
        that the orchestrator continues to work against older backend versions.

        Args:
            message_ids: List of message UUIDs (max 500 per call)

        Returns:
            List of Message objects in the same order as message_ids;
            IDs that were not found are silently omitted.
        """
        if not message_ids:
            return []

        # Attempt the single-round-trip batch endpoint first.
        try:
            ids_param = ",".join(message_ids)
            response = await self.client.get(
                "/api/v1/messages/batch",
                params={"ids": ids_param},
                headers={"Accept": "application/json"},
            )

            if response.status_code == 200:
                payload = response.json()
                items = payload.get("data", [])
                messages: list[Message] = []
                for item in items:
                    try:
                        messages.append(Message(**item))
                    except Exception as parse_err:
                        logger.warning(
                            "Skipping unparseable message in batch response",
                            extra={"error": str(parse_err)},
                        )
                logger.info(
                    "Batch message fetch succeeded",
                    extra={
                        "requested": len(message_ids),
                        "returned": len(messages),
                    },
                )
                return messages

            # Batch endpoint returned an error status — fall through to
            # sequential fallback so we degrade gracefully.
            logger.warning(
                "Batch endpoint returned non-200; falling back to sequential fetch",
                extra={"status_code": response.status_code},
            )

        except httpx.HTTPError as e:
            logger.warning(
                "Batch endpoint unreachable; falling back to sequential fetch",
                extra={"error": str(e)},
            )

        # Sequential fallback — preserves compatibility with older backend builds.
        messages = []
        for msg_id in message_ids:
            try:
                message = await self.get_message(msg_id)
                if message:
                    messages.append(message)
            except httpx.HTTPError as e:
                logger.warning(
                    "Skipping failed message fetch",
                    extra={"message_id": msg_id, "error": str(e)},
                )

        return messages

    async def update_message_status(
        self, message_id: str, status: MessageStatus
    ) -> bool:
        """
        Update message status in API Gateway.

        Args:
            message_id: Message UUID
            status: New status (SCORED, SELECTED, PLAYED, REJECTED, FLAGGED)

        Returns:
            True if successful, False otherwise
        """
        try:
            response = await self.client.patch(
                f"/api/v1/messages/{message_id}",
                json={"status": status.value},
                headers={"Content-Type": "application/json"},
            )

            if response.status_code == 404:
                logger.warning("Message not found for status update", extra={"message_id": message_id})
                return False

            response.raise_for_status()

            logger.info(
                "Message status updated",
                extra={"message_id": message_id, "status": status.value},
            )

            return True

        except httpx.HTTPError as e:
            logger.error(
                "Failed to update message status",
                extra={"message_id": message_id, "error": str(e)},
            )
            return False

    async def health_check(self) -> bool:
        """
        Check if API Gateway is healthy.

        Returns:
            True if healthy, False otherwise
        """
        try:
            response = await self.client.get("/health", timeout=5.0)
            return response.status_code == 200
        except httpx.HTTPError:
            return False


# Singleton instance
_api_gateway_client: Optional[APIGatewayClient] = None


def get_api_gateway_client(base_url: str = "http://localhost:4000") -> APIGatewayClient:
    """Get or create API Gateway client singleton."""
    global _api_gateway_client
    if _api_gateway_client is None:
        _api_gateway_client = APIGatewayClient(base_url)
    return _api_gateway_client


async def close_api_gateway_client() -> None:
    """Close API Gateway client connection."""
    global _api_gateway_client
    if _api_gateway_client:
        await _api_gateway_client.close()
        _api_gateway_client = None
