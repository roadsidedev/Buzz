"""Bankr LLM Gateway provider adapter.

Routes LLM calls through the Bankr gateway (https://llm.bankr.bot), which
exposes an Anthropic-compatible /v1/messages endpoint. Authentication uses
the X-API-Key header with a bk_... key from bankr.bot/api.

Uses httpx directly to avoid Anthropic SDK version constraints.
"""
from __future__ import annotations

from typing import Any, Optional
import logging

import httpx

logger = logging.getLogger(__name__)

BANKR_DEFAULT_BASE_URL = "https://llm.bankr.bot"


class BankrProvider:
    """Provider adapter for the Bankr LLM Gateway.

    Sends requests in Anthropic message format to the Bankr gateway.
    Returns a response object with `.content[0].text` compatible with
    the existing scoring/moderation engine parsing logic.
    """

    def __init__(self, api_key: str, base_url: str = BANKR_DEFAULT_BASE_URL):
        if not api_key:
            raise ValueError("BANKR_API_KEY is required for BankrProvider")
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self._client = httpx.Client(timeout=60.0)

    def messages_create(self, *args, **kwargs) -> Any:
        """Forward an Anthropic-style messages.create call to the Bankr gateway.

        Accepts the same kwargs as anthropic.messages.create:
            model, max_tokens, messages, system, temperature, etc.
        Returns an object with .content[0].text for compatibility.
        """
        payload: dict = {}
        payload.update(kwargs)

        headers = {
            "Content-Type": "application/json",
            "X-API-Key": self.api_key,
            "anthropic-version": "2023-06-01",
        }

        url = f"{self.base_url}/v1/messages"
        logger.debug("Bankr gateway request: model=%s url=%s", payload.get("model"), url)

        resp = self._client.post(url, json=payload, headers=headers)
        resp.raise_for_status()

        data = resp.json()

        # Parse Anthropic-format response: {"content": [{"type": "text", "text": "..."}]}
        text: Optional[str] = None
        if isinstance(data, dict):
            content = data.get("content")
            if isinstance(content, list) and content:
                first = content[0]
                if isinstance(first, dict):
                    text = first.get("text")

        if text is None:
            # Fallback: try OpenAI-compatible shape in case gateway auto-converts
            if isinstance(data, dict) and "choices" in data:
                choices = data["choices"]
                if choices and isinstance(choices[0], dict):
                    msg = choices[0].get("message", {})
                    text = msg.get("content")

        if text is None:
            text = resp.text
            logger.warning("Bankr: unexpected response shape, using raw text body")

        class _Resp:
            def __init__(self, t: str):
                self.content = [type("_Block", (), {"text": t})()]

        return _Resp(str(text))
