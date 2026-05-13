"""OpenAI-compatible provider adapter (minimal stub).

This adapter demonstrates how to add another provider. It expects the
`openai` python package (or an OpenAI-compatible client) and exposes the
same `messages_create` method signature used by the scoring engine.
"""
from __future__ import annotations

from typing import Any
import logging

logger = logging.getLogger(__name__)


class OpenAIProvider:
    """Adapter for OpenAI API (minimal, illustrative).

    This is intentionally small: projects should adapt request/response
    shapes to match the scoring engine expectations.
    """

    def __init__(self, api_key: str | None = None):
        try:
            import openai  # type: ignore

            openai.api_key = api_key
            self._client = openai
        except Exception as e:  # pragma: no cover - runtime import
            logger.error("Failed to import OpenAI SDK: %s", e)
            raise

    def messages_create(self, *args, **kwargs) -> Any:
        """Proxy that adapts to the OpenAI chat/completions API.

        NOTE: The OpenAI response shape differs; callers should adapt parsing.
        """
        # Example for chat completions - return an object with `.content[0].text`
        resp = self._client.ChatCompletion.create(*args, **kwargs)
        return ProviderResponse(resp.choices[0].message.content)
