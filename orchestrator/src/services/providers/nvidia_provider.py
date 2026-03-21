"""NVIDIA NIM API provider adapter.

Supports NVIDIA's hosted LLM models including:
- Kimi K2.5
- Minimax m2.5
- GLM 5
- Qwen 3.5 397B
- DeepSeek R1
- Llama models

NVIDIA NIM API is OpenAI-compatible, so this adapter uses the same patterns.
"""
from __future__ import annotations

from typing import Any, Optional
import logging
import os

logger = logging.getLogger(__name__)

# NVIDIA NIM API base URL
NVIDIA_API_BASE = "https://integrate.api.nvidia.com/v1"

# Available models on NVIDIA NIM
NVIDIA_MODELS = {
    # Kimi models
    "kimi-k2.5": "moonshotai/kimi-k2.5",
    "kimi-k2-5": "moonshotai/kimi-k2.5",  # alias

    # Minimax models
    "minimax-m2.1": "minimaxai/minimax-m2.1",
    "minimax-m2-1": "minimaxai/minimax-m2.1",  # alias

    # GLM models
    "glm5": "z-ai/glm5",
    "glm-5": "z-ai/glm5",  # alias

    # Qwen models
    "qwen3.5-397b": "qwen/qwen3.5-397b-a17b",
    "qwen-3.5-397b": "qwen/qwen3.5-397b-a17b",  # alias

    # Llama models (meta)
    "llama-3.3-70b": "meta/llama-3.3-70b-instruct",
    "llama-3.2-3b": "meta/llama-3.2-3b-instruct",

    # Default scoring model
    "default": "qwen/qwen3.5-397b-a17b",
}


class NvidiaProvider:
    """Adapter for NVIDIA NIM API (OpenAI-compatible).
    
    Usage:
        provider = NvidiaProvider(api_key="nvapi-xxx")
        response = provider.messages_create(
            model="meta/llama-3.3-70b-instruct",
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
        self.api_key = api_key or os.getenv("NVIDIA_API_KEY")
        self.base_url = base_url or os.getenv("NVIDIA_API_URL") or NVIDIA_API_BASE
        
        if not self.api_key:
            raise ValueError(
                "NVIDIA API key required. Set NVIDIA_API_KEY environment variable."
            )
        
        # Use OpenAI SDK with NVIDIA's base URL (OpenAI-compatible)
        try:
            from openai import OpenAI  # type: ignore
            
            self._client = OpenAI(
                api_key=self.api_key,
                base_url=self.base_url,
            )
            logger.info(
                "NVIDIA provider initialized",
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
        """Create a chat completion with NVIDIA NIM API.
        
        Args:
            model: Model name (e.g., "meta/llama-3.3-70b-instruct" or "qwen-3.5-397b")
            messages: List of chat messages
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature
            **kwargs: Additional parameters passed to the API
            
        Returns:
            Response object with `.content[0].text` containing the response
        """
        # Resolve model name from shorthand
        if model is None:
            resolved_model = NVIDIA_MODELS["default"]
        else:
            resolved_model = NVIDIA_MODELS.get(model, model)
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
            
            # Wrap response to match expected interface
            class _Content:
                def __init__(self, text: str):
                    self.text = text
            
            class _Resp:
                def __init__(self, text: str):
                    self.content = [_Content(text)]
                    self.id = response.id
                    self.model = response.model
                    self.usage = response.usage
            
            text = response.choices[0].message.content or ""
            
            return _Resp(text)
            
        except Exception as e:
            logger.error(f"NVIDIA API error: {e}")
            raise

    def __repr__(self) -> str:
        return f"NvidiaProvider(base_url={self.base_url!r})"


def get_nvidia_models() -> dict[str, str]:
    """Return available NVIDIA NIM models."""
    return NVIDIA_MODELS.copy()
