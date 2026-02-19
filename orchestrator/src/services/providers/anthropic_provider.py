"""Anthropic provider adapter.

Wraps the `anthropic` SDK to expose a `messages_create` method compatible
with the expectations of the scoring engine.
"""
from __future__ import annotations

from typing import Any
import logging

from ..llm_provider import LLMProvider

logger = logging.getLogger(__name__)


class AnthropicProvider:
    """Adapter for the Anthropic SDK.

    Lazy-imports the `anthropic` library and exposes `messages_create`.
    """

    def __init__(self, api_key: str | None = None):
        try:
            from anthropic import Anthropic  # type: ignore

            self._client = Anthropic(api_key=api_key)
        except Exception as e:  # pragma: no cover - runtime import
            logger.error("Failed to import Anthropic SDK: %s", e)
            raise

    def messages_create(self, *args, **kwargs) -> Any:
        """Proxy to `self._client.messages.create` to keep scoring engine shape.

        Returns the raw response from Anthropic; scoring engine will parse
        `.content[0].text` to extract JSON.
        """
        return self._client.messages.create(*args, **kwargs)
