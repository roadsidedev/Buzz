"""Generic HTTP-based provider adapter.

This adapter forwards chat-style `messages` payloads to a configurable
HTTP endpoint (e.g., OpenRouter, self-hosted proxy, or vendor HTTP API)
using `httpx`. It attempts to return an object with `.content[0].text`
so the existing scoring/parsing logic can remain unchanged.
"""
from __future__ import annotations

from typing import Any, Optional
import logging
import httpx

from ..llm_provider import ProviderResponse

logger = logging.getLogger(__name__)


class GenericHTTPProvider:
    """Simple HTTP forwarder for LLM requests.

    Note: This is intentionally minimal. For production, add retries,
    auth schemes, and adapt request/response shapes per provider.
    """

    def __init__(self, api_key: Optional[str], api_url: str, provider_name: str | None = None):
        self.api_key = api_key
        self.api_url = api_url
        self.provider_name = provider_name or "generic"
        self._client = httpx.Client(timeout=30.0)

    def messages_create(self, *args, **kwargs) -> Any:
        """Forward the request to the configured API URL and return a small wrapper
        with `.content[0].text` containing the response text.

        Expected kwargs: `model`, `max_tokens`, `messages` (chat-style list)
        """
        payload: dict = {}
        # Use kwargs directly to be flexible
        payload.update(kwargs)

        headers = {"Content-Type": "application/json", "Accept-Encoding": "identity"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        logger.debug("Forwarding request to %s: keys=%s", self.api_url, list(payload.keys()))

        resp = self._client.post(self.api_url, json=payload, headers=headers)
        resp.raise_for_status()

        # Attempt to normalize response shapes
        data = resp.json()

        # Heuristics for common shapes
        text = None
        # OpenAI-like response
        if isinstance(data, dict):
            if "choices" in data and isinstance(data["choices"], list):
                first = data["choices"][0]
                # Chat completion
                if "message" in first and "content" in first["message"]:
                    text = first["message"]["content"]
                elif "text" in first:
                    text = first["text"]
            # OpenRouter sometimes returns `.output` or direct text
            if not text and "output" in data:
                text = data["output"]

        # Fallback to raw text body
        if text is None:
            text = resp.text

        return ProviderResponse(str(text))
