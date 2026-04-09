#!/usr/bin/env python3
"""
dialogue_engine.py
Phase 2 Agentic Dialogue Engine using OpenClaw RadioAgents.

Architecture placement: scripts/radio-runner/
Depends on: orchestrator.src.services.llm_provider, agent.py
Used by: radio_runner.py
"""

import logging
import os
import sys
import time
from collections import namedtuple
from dataclasses import dataclass
from typing import Any, Optional

import httpx

from agent import RadioAgent
from event_listener import RadioEvent

logger = logging.getLogger(__name__)

# Model to use for dialogue
DIALOGUE_MODEL: str = os.environ.get("DIALOGUE_MODEL", "")

# Generic dynamic provider env vars (preferred)
LLM_PROVIDER: str = os.environ.get("LLM_PROVIDER", "").lower()
LLM_API_KEY: str = os.environ.get("LLM_API_KEY", "")
LLM_MODEL: str = os.environ.get("LLM_MODEL", "")

# Provider base URLs for OpenAI-compatible endpoints
_PROVIDER_BASE_URLS: dict = {
    "nvidia": "https://integrate.api.nvidia.com/v1/chat/completions",
    "openai": "https://api.openai.com/v1/chat/completions",
    "openrouter": "https://openrouter.ai/api/v1/chat/completions",
    "groq": "https://api.groq.com/openai/v1/chat/completions",
    "together": "https://api.together.xyz/v1/chat/completions",
    "mistral": "https://api.mistral.ai/v1/chat/completions",
    "deepseek": "https://api.deepseek.com/v1/chat/completions",
    "gemini": "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
}

# Default models per provider when LLM_MODEL is not set
_PROVIDER_DEFAULT_MODELS: dict = {
    "anthropic": "claude-haiku-4-5-20251001",
    "nvidia": "meta/llama-3.3-70b-instruct",
    "openai": "gpt-4o-mini",
    "openrouter": "openai/gpt-4o-mini",
    "groq": "llama-3.3-70b-versatile",
    "together": "meta-llama/Llama-3-70b-chat-hf",
    "mistral": "mistral-small-latest",
    "deepseek": "deepseek-chat",
    "gemini": "gemini-2.0-flash",
}


@dataclass
class DialogueTurn:
    """A pair of HOST + CO-HOST messages for a single turn."""
    host_text: str
    cohost_text: str
    topic: str


# ── LLM Provider Resolution ─────────────────────────────────────────────────

def _build_openai_compat_provider(provider_name: str, api_key: str, base_url: str) -> Any:
    """Build an OpenAI-compatible provider client (works for NVIDIA, OpenAI, OpenRouter, etc.)."""
    class OpenAICompatProvider:
        def __init__(self, name: str, key: str, url: str):
            self.name = name
            self.key = key
            self.url = url
            self.client = httpx.Client(timeout=120.0)

        def _post_with_retry(self, payload: dict, max_retries: int = 3) -> httpx.Response:
            last_exc: Optional[Exception] = None
            for attempt in range(max_retries):
                resp = self.client.post(
                    self.url,
                    headers={"Authorization": f"Bearer {self.key}", "Content-Type": "application/json"},
                    json=payload,
                )
                if resp.status_code == 429:
                    wait = min(2 ** (attempt + 1), 30)
                    try:
                        wait = int(resp.headers.get("Retry-After", wait))
                    except ValueError:
                        pass
                    logger.warning(
                        f"[{self.name}] Rate limited (429), retrying in {wait}s "
                        f"(attempt {attempt + 1}/{max_retries})"
                    )
                    time.sleep(wait)
                    last_exc = httpx.HTTPStatusError(
                        "429 Too Many Requests", request=resp.request, response=resp
                    )
                    continue
                resp.raise_for_status()
                return resp
            raise last_exc or RuntimeError("All retries exhausted")

        def messages_create(self, model: str, max_tokens: int, system: str, messages: list):
            logger.debug(f"[{self.name}] chat/completions call — model={model}")
            resp = self._post_with_retry({
                "model": model,
                "messages": [{"role": "system", "content": system}] + messages,
                "max_tokens": max_tokens,
                "temperature": 0.7,
            })
            data = resp.json()
            TextObj = namedtuple("TextObj", ["text"])
            ContentObj = namedtuple("ContentObj", ["content"])
            return ContentObj(content=[TextObj(text=data["choices"][0]["message"]["content"])])

    return OpenAICompatProvider(provider_name, api_key, base_url)


def _build_anthropic_provider(api_key: str) -> Any:
    """Build an Anthropic-native provider client."""
    class AnthropicProvider:
        def __init__(self, key: str):
            self.key = key
            self.client = httpx.Client(timeout=60.0)

        def messages_create(self, model: str, max_tokens: int, system: str, messages: list):
            logger.debug(f"[anthropic] messages call — model={model}")
            resp = self.client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": self.key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
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

            class MockText:
                def __init__(self, text): self.text = text
            class MockResponse:
                def __init__(self, content): self.content = [MockText(content)]

            return MockResponse(data["content"][0]["text"])

    return AnthropicProvider(api_key)


def _resolve_provider() -> Any:
    """
    Resolve the LLM provider.

    Priority order:
    1. Orchestrator import (when running inside the monorepo)
    2. Generic env vars: LLM_PROVIDER + LLM_API_KEY
    3. Legacy env vars: ANTHROPIC_API_KEY, NVIDIA_API_KEY (backwards compat)
    """
    # 1. Try orchestrator import
    script_dir = os.path.dirname(os.path.abspath(__file__))
    parent_dir = os.path.abspath(os.path.join(script_dir, ".."))
    grandparent_dir = os.path.abspath(os.path.join(script_dir, "..", ".."))

    for root in [script_dir, parent_dir, grandparent_dir]:
        if root not in sys.path:
            sys.path.insert(0, root)
        orch_dir = os.path.join(root, "orchestrator")
        if os.path.exists(orch_dir) and orch_dir not in sys.path:
            sys.path.insert(0, orch_dir)

    for import_path in (
        "orchestrator.src.services.llm_provider",
        "src.services.llm_provider",
    ):
        try:
            module = __import__(import_path, fromlist=["get_provider"])
            provider = module.get_provider()
            logger.info(f"LLM provider resolved via orchestrator import ({import_path})")
            return provider
        except (ImportError, ModuleNotFoundError, Exception):
            pass

    # 2. Generic env vars — LLM_PROVIDER + LLM_API_KEY
    if LLM_PROVIDER and LLM_API_KEY:
        if LLM_PROVIDER == "anthropic":
            logger.info("Using Anthropic provider (LLM_PROVIDER=anthropic)")
            return _build_anthropic_provider(LLM_API_KEY)

        base_url = _PROVIDER_BASE_URLS.get(LLM_PROVIDER)
        if not base_url:
            # Unknown provider — attempt OpenAI-compatible with a custom base URL
            # Allow LLM_BASE_URL env var as escape hatch
            base_url = os.getenv("LLM_BASE_URL", "")
            if not base_url:
                logger.error(
                    f"Unknown LLM_PROVIDER '{LLM_PROVIDER}' and no LLM_BASE_URL set. "
                    "Cannot build provider."
                )
                return None

        logger.info(f"Using {LLM_PROVIDER} provider via LLM_PROVIDER env var")
        return _build_openai_compat_provider(LLM_PROVIDER, LLM_API_KEY, base_url)

    # 3. Legacy env var fallbacks
    anthropic_key = os.getenv("ANTHROPIC_API_KEY")
    nvidia_key = os.getenv("NVIDIA_API_KEY")

    if anthropic_key:
        logger.info("Using Anthropic provider (legacy ANTHROPIC_API_KEY)")
        return _build_anthropic_provider(anthropic_key)

    if nvidia_key:
        logger.info("Using NVIDIA NIM provider (legacy NVIDIA_API_KEY)")
        return _build_openai_compat_provider(
            "nvidia", nvidia_key, _PROVIDER_BASE_URLS["nvidia"]
        )

    logger.error("No LLM provider configured. Set LLM_PROVIDER + LLM_API_KEY env vars.")
    return None


def _resolve_model(provider: Any) -> str:
    """
    Pick the model name for dialogue generation.

    Priority order:
    1. DIALOGUE_MODEL env var (explicit override, legacy)
    2. LLM_MODEL env var (generic)
    3. Provider-specific default
    """
    if DIALOGUE_MODEL:
        return DIALOGUE_MODEL

    if LLM_MODEL:
        return LLM_MODEL

    # Provider-specific defaults
    if LLM_PROVIDER and LLM_PROVIDER in _PROVIDER_DEFAULT_MODELS:
        return _PROVIDER_DEFAULT_MODELS[LLM_PROVIDER]

    # Legacy fallbacks
    if os.getenv("ANTHROPIC_API_KEY") and not os.getenv("LLM_PROVIDER"):
        return _PROVIDER_DEFAULT_MODELS["anthropic"]

    if os.getenv("NVIDIA_API_KEY") and not os.getenv("LLM_PROVIDER"):
        return _PROVIDER_DEFAULT_MODELS["nvidia"]

    # Last resort
    return _PROVIDER_DEFAULT_MODELS["anthropic"]


# ── DialogueEngine (Agent Orchestrator) ──────────────────────────────────────

class DialogueEngine:
    """
    Orchestrates the Phase 2 Agentic setup.
    Manages Alex (Host) and Mira (CoHost) through stateful memory buffering.
    """

    def __init__(self, api_key: str = "", model: str = "", provider: Any = None) -> None:
        self._provider = provider or _resolve_provider()
        self._model = model or _resolve_model(self._provider)

        # Initialize the stateful agents
        self.alex = RadioAgent("Alex", "core_identity_alex.md", self._provider, self._model)
        self.mira = RadioAgent("Mira", "core_identity_mira.md", self._provider, self._model)

        if self._provider:
            logger.info("Agentic DialogueEngine ready — model: %s", self._model)

    def generate_turn(
        self,
        headlines: list,
        history: Optional[list[DialogueTurn]] = None,  # Kept for bw compat, but mostly ignored as agents have memory
        events: Optional[list[RadioEvent]] = None,
    ) -> DialogueTurn:
        """
        Run one cognitive cycle for both agents.
        If events exist (e.g. BREAKING_NEWS), override normal routine.
        """
        # Determine the target skill and topic
        if events and events[0].event_type == "BREAKING_NEWS":
            topic = "BREAKING NEWS"
            payload_str = str(events[0].payload)
            intent = f"Interrupt the show. BREAKING NEWS Alert: {payload_str}"

            # Hot-swap skills
            self.alex.load_skill("skill_breaking_news.md")
            self.mira.load_skill("skill_breaking_news.md")

            # Inject event into both memories
            self.alex.perceive_event("SYSTEM ALERT: " + intent)
            self.mira.perceive_event("SYSTEM ALERT: " + intent)

        elif events and events[0].event_type == "POST_MUSIC_BREAK":
            # Build the next-topic context so re-entry can tease forward naturally
            if headlines:
                top = headlines[0]
                topic = top.title[:80]
                next_topic_intent = (
                    f"React to this headline:\nTITLE: {top.title}\n"
                    f"SOURCE: {top.source}\nSUMMARY: {top.summary or '(none)'}"
                )
            else:
                topic = "general_trends"
                next_topic_intent = "Banter about broader tech/society trends."

            intent = (
                f"You're returning from a music break. Welcome listeners back naturally, "
                f"then transition into: {next_topic_intent}"
            )
            self.alex.load_skill("skill_post_music_break.md")
            self.mira.load_skill("skill_post_music_break.md")

        elif headlines:
            top = headlines[0]
            topic = top.title[:80]
            # Formulate the news context
            intent = (
                f"React to this headline:\nTITLE: {top.title}\n"
                f"SOURCE: {top.source}\nSUMMARY: {top.summary or '(none)'}"
            )
            # Load normal banter skill
            self.alex.load_skill("skill_news_banter.md")
            self.mira.load_skill("skill_news_banter.md")
        else:
            topic = "slow_news"
            intent = "It's a slow news hour. Banter about broader tech/society trends and bold predictions."
            self.alex.load_skill("skill_slow_news.md")
            self.mira.load_skill("skill_slow_news.md")

        # 1. Alex THINKS and ACTS
        logger.debug("Generating Host turn...")
        host_text = self.alex.think_and_act(intent)

        # 2. Mira PERCEIVES Alex, THINKS, and ACTS
        logger.debug("Generating Co-Host turn...")
        self.mira.perceive_dialogue(self.alex.name, host_text)
        
        # Mira's intent is to respond to Alex while considering the main topic
        mira_intent = f"Alex just made a point about the topic. Co-host, respond using your defined skill. Original Topic context: {intent}"
        cohost_text = self.mira.think_and_act(mira_intent)

        # 3. Alex PERCEIVES Mira (closing the memory loop)
        self.alex.perceive_dialogue(self.mira.name, cohost_text)

        # 4. Record the topic in long-term memory to avoid repetition later
        if not events:
            self.alex.perceive_topic(topic)
            self.mira.perceive_topic(topic)

        return DialogueTurn(
            host_text=host_text,
            cohost_text=cohost_text,
            topic=topic
        )
