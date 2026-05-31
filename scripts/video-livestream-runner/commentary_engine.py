#!/usr/bin/env python3
"""
commentary_engine.py
LLM-driven commentary generation for the video livestream.

Manages a single AI anchor with stateful memory and dynamic skill loading.
Generates 1-3 sentence commentary for each turn, with a visual cue for the
scene engine (neutral/positive/negative/breaking).

Architecture placement: scripts/video-livestream-runner/
Depends on: agent.py (RadioAgent)
Used by: video_runner.py
"""

import logging
import os
import sys
import time
from dataclasses import dataclass
from typing import Any, Optional

from agent import RadioAgent

logger = logging.getLogger(__name__)

LLM_PROVIDER: str = os.environ.get("LLM_PROVIDER", "").lower()
LLM_API_KEY: str = os.environ.get("LLM_API_KEY", "")
LLM_MODEL: str = os.environ.get("LLM_MODEL", "")

MIMO_BASE_URL: str = os.environ.get(
    "MIMO_BASE_URL", "https://token-plan-sgp.xiaomimimo.com/v1"
)
if MIMO_BASE_URL and not MIMO_BASE_URL.rstrip("/").endswith("/chat/completions"):
    MIMO_BASE_URL = MIMO_BASE_URL.rstrip("/") + "/chat/completions"

_PROVIDER_BASE_URLS: dict = {
    "mimo": MIMO_BASE_URL,
    "opengateway": "https://opengateway.gitlawb.com/v1/chat/completions",
    "nvidia": "https://integrate.api.nvidia.com/v1/chat/completions",
    "openai": "https://api.openai.com/v1/chat/completions",
    "openrouter": "https://openrouter.ai/api/v1/chat/completions",
    "groq": "https://api.groq.com/openai/v1/chat/completions",
    "together": "https://api.together.xyz/v1/chat/completions",
    "mistral": "https://api.mistral.ai/v1/chat/completions",
    "deepseek": "https://api.deepseek.com/v1/chat/completions",
    "gemini": "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
}

_PROVIDER_DEFAULT_MODELS: dict = {
    "mimo": "",
    "opengateway": "",
    "anthropic": "",
    "nvidia": "",
    "openai": "",
    "openrouter": "",
    "groq": "",
    "together": "",
    "mistral": "",
    "deepseek": "",
    "gemini": "",
}


@dataclass
class Commentary:
    text: str
    topic: str
    visual_cue: str  # "neutral", "positive", "negative", "breaking"


_MAX_RATE_LIMIT_RETRIES: int = int(os.environ.get("LLM_RATE_LIMIT_MAX_RETRIES", "5"))


def _build_openai_compat_provider(provider_name: str, api_key: str, base_url: str) -> Any:
    import httpx

    class OpenAICompatProvider:
        def __init__(self, name: str, key: str, url: str):
            self.name = name
            self.key = key
            self.url = url
            self.client = httpx.Client(timeout=120.0)

        def messages_create(self, model: str, max_tokens: int, system: str, messages: list):
            last_exc: Optional[Exception] = None
            for attempt in range(_MAX_RATE_LIMIT_RETRIES + 1):
                try:
                    resp = self.client.post(
                        self.url,
                        headers={
                            "Authorization": f"Bearer {self.key}",
                            "Content-Type": "application/json",
                            "Accept-Encoding": "identity",
                        },
                        json={
                            "model": model,
                            "messages": [{"role": "system", "content": system}] + messages,
                            "max_tokens": max_tokens,
                            "temperature": 0.7,
                        },
                    )
                    if resp.status_code == 429:
                        retry_after = int(resp.headers.get("Retry-After", 5))
                        # Exponential backoff: base wait * 2^attempt, capped at 60s
                        wait = min(retry_after * (2 ** attempt), 60)
                        logger.warning(
                            "[%s] Rate limited (attempt %d/%d), backing off %ds",
                            self.name, attempt + 1, _MAX_RATE_LIMIT_RETRIES + 1, wait,
                        )
                        if attempt < _MAX_RATE_LIMIT_RETRIES:
                            time.sleep(wait)
                            continue
                        # Exhausted retries — raise to trigger caller's fallback
                        raise RuntimeError(
                            f"[{self.name}] Rate limited after {_MAX_RATE_LIMIT_RETRIES + 1} attempts"
                        )
                    resp.raise_for_status()
                    data = resp.json()
                    TextObj = type("TextObj", (), {"text": data["choices"][0]["message"]["content"]})
                    ContentObj = type("ContentObj", (), {"content": [TextObj]})
                    return ContentObj()
                except (httpx.TimeoutException, httpx.ConnectError, httpx.ReadError) as exc:
                    last_exc = exc
                    wait = min(2 ** attempt, 30)
                    logger.warning("[%s] Request error (attempt %d/%d): %s", self.name, attempt + 1, _MAX_RATE_LIMIT_RETRIES + 1, exc)
                    if attempt < _MAX_RATE_LIMIT_RETRIES:
                        time.sleep(wait)
                        continue
            raise last_exc or RuntimeError(f"[{self.name}] All retries exhausted")

    return OpenAICompatProvider(provider_name, api_key, base_url)


def _build_anthropic_provider(api_key: str) -> Any:
    import httpx

    class AnthropicProvider:
        def __init__(self, key: str):
            self.key = key
            self.client = httpx.Client(timeout=60.0)

        def messages_create(self, model: str, max_tokens: int, system: str, messages: list):
            resp = self.client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": self.key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                    "Accept-Encoding": "identity",
                },
                json={
                    "model": model,
                    "max_tokens": max_tokens,
                    "system": system,
                    "messages": messages,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            TextObj = type("TextObj", (), {"text": data["content"][0]["text"]})
            ContentObj = type("ContentObj", (), {"content": [TextObj]})
            return ContentObj()

    return AnthropicProvider(api_key)


def _resolve_provider() -> Any:
    if LLM_PROVIDER and LLM_API_KEY:
        if LLM_PROVIDER == "anthropic":
            logger.info("Using Anthropic provider (LLM_PROVIDER=anthropic)")
            return _build_anthropic_provider(LLM_API_KEY)

        base_url = _PROVIDER_BASE_URLS.get(LLM_PROVIDER)
        if not base_url:
            base_url = os.getenv("LLM_BASE_URL", "")
            if not base_url:
                logger.error("Unknown provider '%s' and no LLM_BASE_URL", LLM_PROVIDER)
                return None
        logger.info("Using %s provider via LLM_PROVIDER env var", LLM_PROVIDER)
        return _build_openai_compat_provider(LLM_PROVIDER, LLM_API_KEY, base_url)

    mimo_key = os.getenv("MIMO_API_KEY")
    if mimo_key:
        logger.info("Using MiMo provider (auto-detected MIMO_API_KEY)")
        return _build_openai_compat_provider("mimo", mimo_key, _PROVIDER_BASE_URLS["mimo"])

    anthropic_key = os.getenv("ANTHROPIC_API_KEY")
    if anthropic_key:
        logger.info("Using Anthropic provider (legacy ANTHROPIC_API_KEY)")
        return _build_anthropic_provider(anthropic_key)

    logger.error("No LLM provider configured. Set LLM_PROVIDER + LLM_API_KEY")
    return None


def _resolve_model() -> str:
    if LLM_MODEL:
        return LLM_MODEL
    if LLM_PROVIDER and LLM_PROVIDER in _PROVIDER_DEFAULT_MODELS:
        return _PROVIDER_DEFAULT_MODELS[LLM_PROVIDER]
    if os.getenv("MIMO_API_KEY") and not LLM_PROVIDER:
        return ""
    if os.getenv("ANTHROPIC_API_KEY") and not os.getenv("LLM_PROVIDER"):
        return ""
    logger.error(
        "No model configured. Set LLM_MODEL env var (e.g. nvidia/nemotron-3-nano-30b-a3b)"
    )
    return ""


SPECIAL_REPORT_PROMPT = (
    "You are interpreting the text to extract a single-word visual mood for the video overlay. "
    "Reply with exactly one word: neutral, breaking, positive, or negative. "
    "Do not explain. Do not add punctuation."
)


def _classify_cue(provider: Any, model: str, commentary_text: str) -> str:
    """Ask the LLM to classify a commentary tone into a visual cue."""
    try:
        resp = provider.messages_create(
            model=model,
            max_tokens=10,
            system=SPECIAL_REPORT_PROMPT,
            messages=[{"role": "user", "content": f"Text: {commentary_text}\nMood:"}],
        )
        cue = resp.content[0].text.strip().lower()
        if cue in ("neutral", "positive", "negative", "breaking"):
            return cue
    except Exception:
        pass
    return "neutral"


VERSION_OVERRIDE = int(os.environ.get("DIALOGUE_VERSION", "1"))


class CommentaryEngine:
    """
    Generates AI anchor commentary for the video livestream.

    Manages a single RadioAgent (the anchor) with identity and skills.
    Each turn produces a Commentary with text + topic + visual cue.
    """

    def __init__(self) -> None:
        self._provider = _resolve_provider()
        self._model = _resolve_model()

        if VERSION_OVERRIDE >= 2:
            self._anchor = RadioAgent(
                "Anchor",
                "core_identity_host.md",
                self._provider,
                self._model,
            )
            logger.info("CommentaryEngine v2 ready — model: %s", self._model)
        else:
            self._anchor = None
            logger.info("CommentaryEngine v1 ready — model: %s", self._model)

    def generate(
        self,
        topic: str,
        context: str,
        incoming_event: Optional[str] = None,
    ) -> Commentary:
        """
        Generate one turn of anchor commentary.

        Args:
            topic: Current topic/headline title
            context: Detailed context (summary, data, etc.)
            incoming_event: Optional breaking event text

        Returns:
            Commentary with text, topic, and visual_cue
        """
        if VERSION_OVERRIDE >= 2 and self._anchor:
            return self._generate_v2(topic, context, incoming_event)

        return self._generate_v1(topic, context, incoming_event)

    def _generate_v1(
        self,
        topic: str,
        context: str,
        incoming_event: Optional[str] = None,
    ) -> Commentary:
        """v1: Direct prompt — no agent memory."""
        if not self._provider:
            return Commentary(
                text=f"Welcome to Buzz News. Today's topic: {topic}",
                topic=topic,
                visual_cue="neutral",
            )

        if incoming_event:
            prompt = (
                f"BREAKING NEWS: {incoming_event}\n\n"
                f"Provide a 1-2 sentence urgent news anchor announcement. "
                f"Direct, factual, authoritative. Under 30 words."
            )
        else:
            prompt = (
                f"Anchor a live news broadcast. Topic: {topic}\n"
                f"Context: {context}\n\n"
                f"Write 1-3 sentences a news anchor would say live on air. "
                f"Conversational, informed, engaging. Under 40 words."
            )

        try:
            resp = self._provider.messages_create(
                model=self._model,
                max_tokens=120,
                system="You are a sharp, authoritative live news anchor. Speak in concise, punchy sentences.",
                messages=[{"role": "user", "content": prompt}],
            )
            text = resp.content[0].text.strip()
        except Exception as exc:
            logger.error("LLM call failed: %s", exc)
            text = f"Welcome back to Buzz News. We're following {topic}."

        cue = _classify_cue(self._provider, self._model, text)
        return Commentary(text=text, topic=topic, visual_cue=cue)

    def _generate_v2(
        self,
        topic: str,
        context: str,
        incoming_event: Optional[str] = None,
    ) -> Commentary:
        """v2: Uses RadioAgent with identity, memory, and dynamic skills."""
        if incoming_event:
            self._anchor.load_skill("skill_breaking_news.md")
            self._anchor.perceive_event(f"BREAKING NEWS: {incoming_event}")
            intent = f"BREAKING: {incoming_event}. Deliver a sharp, urgent alert."
        else:
            self._anchor.load_skill("skill_news_update.md")
            intent = f"Report on: {topic}. Context: {context}"

        try:
            text = self._anchor.think_and_act(intent)
        except Exception as exc:
            logger.error("v2 LLM call failed: %s", exc)
            text = f"Welcome back to Buzz News. We're following {topic}."
        cue = _classify_cue(self._provider, self._model, text)

        if not incoming_event:
            self._anchor.perceive_topic(topic)

        return Commentary(text=text, topic=topic, visual_cue=cue)

    def flush_memory(self) -> None:
        """Persist agent memory to disk. Call on shutdown."""
        if self._anchor:
            self._anchor.flush_memory()
