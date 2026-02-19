"""Provider-agnostic LLM adapter registry and base class.

Define a small interface `LLMProvider` that adapters must implement and
provide a `get_provider` factory to pick an adapter based on environment.
"""
from __future__ import annotations

from typing import Any, Protocol
import logging
import importlib
import os

from ..config.settings import settings

logger = logging.getLogger(__name__)


class LLMProvider(Protocol):
    """Minimal provider protocol used by the scoring engine."""

    def messages_create(self, *args, **kwargs) -> Any:
        """Create messages/completions with a provider-specific client.

        Adapters should return an object with a `content` attribute that is
        indexable and whose items have a `.text` attribute (compatible with
        the existing ScoringEngine parsing logic).
        """


def _detect_provider_from_env() -> tuple[str | None, str | None]:
    """Detect provider name and API key from environment variables.

    Checks a list of provider-specific env vars (e.g. GEMINI_API_KEY,
    OPENAI_API_KEY, ANTHROPIC_API_KEY, OPENROUTER_API_KEY, NVIDIA_API_KEY,
    KIMI_API_KEY) and returns the first match. If none found, returns
    `(None, None)`.
    """
    candidates = [
        ("gemini", "GEMINI_API_KEY"),
        ("openai", "OPENAI_API_KEY"),
        ("anthropic", "ANTHROPIC_API_KEY"),
        ("openrouter", "OPENROUTER_API_KEY"),
        ("nvidia", "NVIDIA_API_KEY"),
        ("kimi", "KIMI_API_KEY"),
    ]

    for name, envvar in candidates:
        val = os.getenv(envvar)
        if val:
            return name, val

    # Fallback to generic LLM_API_KEY
    if os.getenv("LLM_API_KEY"):
        return os.getenv("LLM_PROVIDER") or None, os.getenv("LLM_API_KEY")

    return None, None


def get_provider(name: str | None = None, api_key: str | None = None) -> LLMProvider:
    """Resolve and return an LLM provider adapter instance.

    Behavior:
    - If `name`/`api_key` provided, use them.
    - Otherwise attempt to auto-detect from well-known env vars.
    - Try to dynamically import `orchestrator.src.services.providers.<provider>_provider`
      and instantiate `<ProviderTitle>Provider` (e.g. `AnthropicProvider`).
    - If adapter module not present, but `LLM_API_URL` is set, return a
      generic HTTP provider that forwards requests to the configured URL.
    - If provider explicitly set to `none`, return a null provider that
      raises on use.
    """
    provider = (name or settings.LLM_PROVIDER or "").lower() or None
    key = api_key or settings.LLM_API_KEY or None

    # Auto-detect if neither provided
    if not provider or not key:
        detected_name, detected_key = _detect_provider_from_env()
        provider = provider or detected_name
        key = key or detected_key

    if provider in ("none", "disabled"):
        class _NullProvider:
            def messages_create(self, *a, **kw):
                raise RuntimeError("LLM provider disabled (LLM_PROVIDER=none)")

        return _NullProvider()

    if not provider:
        # No provider configured; allow caller to decide on fallback behavior
        raise ImportError("No LLM provider configured via env or settings")

    # Try to import a provider-specific adapter dynamically
    module_name = f"orchestrator.src.services.providers.{provider}_provider"
    try:
        mod = importlib.import_module(module_name)
        # Attempt common class names
        class_names = [
            f"{provider.title()}Provider",
            "Provider",
            f"{provider.capitalize()}Provider",
        ]
        for cls_name in class_names:
            provider_cls = getattr(mod, cls_name, None)
            if provider_cls:
                return provider_cls(api_key=key)
        # If module exists but class not found, try a factory function
        if hasattr(mod, "get_provider"):
            return mod.get_provider(api_key=key)
    except ModuleNotFoundError:
        logger.debug("No adapter module for provider '%s' (%s)", provider, module_name)
    except Exception as e:
        logger.error("Error loading provider adapter for %s: %s", provider, e)
        raise

    # Fallback: if an API URL is configured, use a generic HTTP adapter
    api_url = settings.LLM_API_URL or os.getenv("LLM_API_URL")
    if api_url:
        try:
            from .providers.generic_provider import GenericHTTPProvider

            return GenericHTTPProvider(api_key=key, api_url=api_url, provider_name=provider)
        except Exception as e:
            logger.error("Failed to initialize GenericHTTPProvider: %s", e)
            raise

    raise ImportError(
        f"No adapter found for provider '{provider}'. Add a provider adapter module 'providers/{provider}_provider.py' or set LLM_API_URL for a generic HTTP provider."
    )
