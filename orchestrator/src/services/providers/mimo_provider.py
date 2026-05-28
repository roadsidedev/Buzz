"""Xiaomi MiMo API provider adapter.

Supports Xiaomi's MiMo V2.5 model family via their OpenAI-compatible API:
- xiaomi/mimo-v2.5       (standard, 1M context, multimodal)
- xiaomi/mimo-v2.5-pro   (flagship, 1M context, agentic)

MiMo API is OpenAI-compatible, so this adapter uses the same patterns
as the NVIDIA provider.

Env vars:
  MIMO_API_KEY   - MiMo API key (required)
  MIMO_BASE_URL  - Custom base URL (optional, defaults to global endpoint)
"""
from __future__ import annotations

from typing import Any, Optional
import logging
import os

from ..llm_provider import ProviderResponse

logger = logging.getLogger(__name__)

# MiMo API base URLs
MIMO_API_BASE_GLOBAL = "https://token-plan-sgp.xiaomimimo.com/v1"
MIMO_API_BASE_CHINA = "https://api.mimo-v2.com/v1"

# Available models on MiMo
MIMO_MODELS = {
    # Standard model (good for general dialogue)
    "mimo-v2.5": "xiaomi/mimo-v2.5",
    "xiaomi/mimo-v2.5": "xiaomi/mimo-v2.5",

    # Pro model (flagship, better for complex tasks)
    "mimo-v2.5-pro": "xiaomi/mimo-v2.5-pro",
    "xiaomi/mimo-v2.5-pro": "xiaomi/mimo-v2.5-pro",

    # Aliases
    "mimo": "xiaomi/mimo-v2.5",
    "mimo-pro": "xiaomi/mimo-v2.5-pro",

    # Default
    "default": "xiaomi/mimo-v2.5",
}


class MimoProvider:
    """Adapter for Xiaomi MiMo API (OpenAI-compatible).

    Usage:
        provider = MimoProvider(api_key="your-mimo-key")
        response = provider.messages_create(
            model="xiaomi/mimo-v2.5",
            messages=[{"role": "user", "content": "Hello!"}],
            max_tokens=1024,
        )
        text = response.content[0].text
    """

    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
    ):
        self.api_key = api_key or os.getenv("MIMO_API_KEY")
        self.base_url = base_url or os.getenv("MIMO_BASE_URL") or MIMO_API_BASE_GLOBAL

        if not self.api_key:
            raise ValueError(
                "MiMo API key required. Set MIMO_API_KEY environment variable."
            )

        # Use OpenAI SDK with MiMo's base URL (OpenAI-compatible)
        try:
            from openai import OpenAI  # type: ignore

            self._client = OpenAI(
                api_key=self.api_key,
                base_url=self.base_url,
            )
            logger.info(
                "MiMo provider initialized",
                extra={"base_url": self.base_url}
            )
        except ImportError:
            logger.warning(
                "OpenAI SDK not installed. Install with: pip install openai"
            )
            raise

    def messages_create(
        self,
        model: str | None = None,
        messages: list | None = None,
        max_tokens: int = 1024,
        temperature: float = 0.7,
        **kwargs,
    ) -> Any:
        """Create a chat completion with MiMo API.

        Args:
            model: Model name (e.g., "xiaomi/mimo-v2.5" or "mimo")
            messages: List of chat messages
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature
            **kwargs: Additional parameters passed to the API

        Returns:
            Response object with `.content[0].text` containing the response
        """
        # Resolve model name from shorthand
        if model is None:
            resolved_model = MIMO_MODELS["default"]
        else:
            resolved_model = MIMO_MODELS.get(model, model)
        if resolved_model != model:
            logger.debug(f"Resolved model: {model} -> {resolved_model}")

        if messages is None:
            messages = kwargs.get("messages", [])

        try:
            response = self._client.chat.completions.create(
                model=resolved_model,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
                **{k: v for k, v in kwargs.items() if k not in ["messages", "model"]},
            )

            text = response.choices[0].message.content or ""

            return ProviderResponse(text, id=response.id, model=response.model, usage=response.usage)

        except Exception as e:
            logger.error(f"MiMo API error: {e}")
            raise

    def __repr__(self) -> str:
        return f"MimoProvider(base_url={self.base_url!r})"


def get_mimo_models() -> dict[str, str]:
    """Return available MiMo models."""
    return MIMO_MODELS.copy()
