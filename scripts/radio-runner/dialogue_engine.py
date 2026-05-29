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
from radio_physics import (
    enforce_turn_anatomy, get_current_block, get_turn_cadence,
    get_current_segment, get_segment_duration, get_segment_turns,
    SegmentID, TimeBlock, BroadcastState,
)
from editorial_pipeline import EditorialContext, TransformedItem
from memory_manager import SessionMemory

logger = logging.getLogger(__name__)

# Model to use for dialogue
DIALOGUE_MODEL: str = os.environ.get("DIALOGUE_MODEL", "")

# Generic dynamic provider env vars (preferred)
LLM_PROVIDER: str = os.environ.get("LLM_PROVIDER", "").lower()
LLM_API_KEY: str = os.environ.get("LLM_API_KEY", "")
LLM_MODEL: str = os.environ.get("LLM_MODEL", "")

# MiMo base URL — configurable for China sub vs global
# China sub: https://api.mimo-v2.com/v1
# Global (token plan): https://token-plan-sgp.xiaomimimo.com/v1
MIMO_BASE_URL: str = os.environ.get(
    "MIMO_BASE_URL", "https://token-plan-sgp.xiaomimimo.com/v1"
)
# If MIMO_BASE_URL doesn't end with /chat/completions, append it
if MIMO_BASE_URL and not MIMO_BASE_URL.rstrip("/").endswith("/chat/completions"):
    MIMO_BASE_URL = MIMO_BASE_URL.rstrip("/") + "/chat/completions"

# Provider base URLs for OpenAI-compatible endpoints
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

# Default models per provider when LLM_MODEL is not set
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
                    headers={
                        "Authorization": f"Bearer {self.key}",
                        "Content-Type": "application/json",
                        "Accept-Encoding": "identity",
                    },
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
            max_content_retries = 3
            for content_attempt in range(max_content_retries):
                resp = self._post_with_retry({
                    "model": model,
                    "messages": [{"role": "system", "content": system}] + messages,
                    "max_tokens": max_tokens,
                    "temperature": 0.7,
                })
                try:
                    data = resp.json()
                except Exception:
                    import json as _json
                    data = _json.loads(resp.content.decode("utf-8"))
                content = data.get("choices", [{}])[0].get("message", {}).get("content")
                if content and content.strip():
                    TextObj = namedtuple("TextObj", ["text"])
                    ContentObj = namedtuple("ContentObj", ["content"])
                    return ContentObj(content=[TextObj(text=content)])
                logger.warning(f"[{self.name}] LLM returned null/empty content (attempt {content_attempt + 1}/{max_content_retries})")
                if content_attempt < max_content_retries - 1:
                    time.sleep(1.0)
            raise ValueError(f"LLM returned empty content after {max_content_retries} retries for {self.name}")

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
    3. MiMo auto-detect: MIMO_API_KEY (primary preference)
    4. Legacy env vars: ANTHROPIC_API_KEY, NVIDIA_API_KEY (backwards compat)
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

    # 3. MiMo auto-detect (preferred primary)
    mimo_key = os.getenv("MIMO_API_KEY")
    if mimo_key:
        logger.info("Using MiMo provider (auto-detected MIMO_API_KEY)")
        return _build_openai_compat_provider(
            "mimo", mimo_key, _PROVIDER_BASE_URLS["mimo"]
        )

    # 4. Legacy env var fallbacks
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
        logger.info(f"Model from DIALOGUE_MODEL env: {DIALOGUE_MODEL}")
        return DIALOGUE_MODEL

    if LLM_MODEL:
        logger.info(f"Model from LLM_MODEL env: {LLM_MODEL}")
        return LLM_MODEL

    # Provider-specific defaults
    if LLM_PROVIDER and LLM_PROVIDER in _PROVIDER_DEFAULT_MODELS:
        model = _PROVIDER_DEFAULT_MODELS[LLM_PROVIDER]
        if model:
            logger.info(f"Model from provider default ({LLM_PROVIDER}): {model}")
            return model

    # Auto-detect: if MIMO_API_KEY is set, no default model — user must set LLM_MODEL
    if os.getenv("MIMO_API_KEY") and not LLM_PROVIDER:
        logger.warning("MIMO_API_KEY set but no LLM_MODEL — set LLM_MODEL env var")
        return ""

    # Legacy fallbacks
    if os.getenv("ANTHROPIC_API_KEY") and not os.getenv("LLM_PROVIDER"):
        logger.warning("ANTHROPIC_API_KEY set but no LLM_MODEL — set LLM_MODEL env var")
        return ""

    if os.getenv("NVIDIA_API_KEY") and not os.getenv("LLM_PROVIDER"):
        logger.warning("NVIDIA_API_KEY set but no LLM_MODEL — set LLM_MODEL env var")
        return ""

    logger.error(
        "No model configured. Set LLM_MODEL env var (e.g. nvidia/nemotron-3-nano-30b-a3b)"
    )
    return ""


# ── DialogueEngine (Agent Orchestrator) ──────────────────────────────────────

class DialogueEngine:
    """
    Orchestrates the Phase 2 Agentic setup.
    Manages Alex (Host) and Mira (CoHost) through stateful memory buffering.
    Now segment-aware with editorial context, radio physics, and energy management.
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
        editorial: Optional[EditorialContext] = None,
        headlines: Optional[list] = None,
        history: Optional[list[DialogueTurn]] = None,
        events: Optional[list[RadioEvent]] = None,
        segment_id: Optional[SegmentID] = None,
        turn_number: int = 1,
        total_turns: int = 2,
        agent_key: str = "host",
        session_memory: Optional[SessionMemory] = None,
    ) -> DialogueTurn:
        """
        Run one cognitive cycle for both agents.
        Uses editorial context, segment awareness, and turn anatomy.
        """
        block = get_current_block()
        block_name = getattr(block, 'value', 'midday')

        # Build news context from editorial pipeline
        news_context = ""
        news_items = []
        if editorial and editorial.news:
            fresh = [n for n in editorial.news if not n.aired]
            if fresh:
                news_context = self._format_editorial_context(fresh[:5])
                news_items = fresh

        # Fall back to raw headlines if no editorial context
        if not news_context and headlines:
            top = headlines[0]
            news_context = (
                f"TITLE: {getattr(top, 'title', str(top))}\n"
                f"SUMMARY: {getattr(top, 'summary', '(none)')}\n"
            )

        if not news_context:
            news_context = "(No fresh news — use commentary, banter, or audience interaction.)"

        # Determine segment type
        seg = segment_id or get_current_segment()[0]

        if events and events[0].event_type == "BREAKING_NEWS":
            topic = "BREAKING NEWS"
            intent = f"BREAKING NEWS: {events[0].payload}. Interrupt the show, deliver the story."
            self.alex.load_skill("skill_breaking_news.md")
            self.mira.load_skill("skill_breaking_news.md")
            self.alex.perceive_event("SYSTEM ALERT: " + intent)
            self.mira.perceive_event("SYSTEM ALERT: " + intent)

        elif events and events[0].event_type == "POST_MUSIC_BREAK":
            topic = "post_music_break"
            intent = f"Return from music break. Welcome listeners back, then discuss: {news_context}"
            self.alex.load_skill("skill_post_music_break.md")
            self.mira.load_skill("skill_post_music_break.md")

        elif seg == SegmentID.DEX_CORNER:
            topic = "dex_corner"
            crypto = ""
            sports = ""
            if editorial and editorial.crypto:
                for coin, data in editorial.crypto.items():
                    if isinstance(data, dict):
                        crypto += f"\n{coin.title()}: ${data.get('price', 0):,.0f} ({data.get('change_24h', 0):+.1f}%)"
            if editorial and editorial.scores:
                for league, games in editorial.scores.items():
                    if isinstance(games, list):
                        for game in games[:2]:
                            if isinstance(game, dict):
                                sports += f"\n{league}: {game.get('home','?')} {game.get('home_score','?')} vs {game.get('away','?')} {game.get('away_score','?')}"
            intent = f"DEX_CORNER segment — run the numbers.{crypto}{sports}\n\nNews: {news_context}"
            self.alex.load_skill("skill_news_banter.md")
            self.mira.load_skill("skill_news_banter.md")

        elif seg == SegmentID.LISTENER_CORNER and editorial:
            tips = editorial.pending_tips
            questions = editorial.pending_questions
            joins = editorial.pending_joins
            intent = f"LISTENER_CORNER segment.\n"
            if tips:
                intent += f"Tips to acknowledge: {tips}\n"
            if questions:
                intent += f"Questions to answer: {questions}\n"
            if joins:
                intent += f"New listeners: {joins}\n"
            intent += f"\nNews: {news_context}"
            self.alex.load_skill("skill_news_banter.md")
            self.mira.load_skill("skill_news_banter.md")

        elif seg in (SegmentID.DEEP_DIVE, SegmentID.COMMENTARY):
            topic = "deep_dive" if seg == SegmentID.DEEP_DIVE else "commentary"
            intent = f"{seg.value} — take a deep dive into this topic.\n{news_context}"
            self.alex.load_skill("skill_news_banter.md")
            self.mira.load_skill("skill_news_banter.md")

        elif seg == SegmentID.SPEED_ROUND:
            topic = "speed_round"
            intent = f"SPEED ROUND — rapid fire! Cover as many topics as possible in short takes.\n{news_context}"
            self.alex.load_skill("skill_news_banter.md")
            self.mira.load_skill("skill_news_banter.md")

        elif seg == SegmentID.COLD_OPEN:
            topic = "cold_open"
            intent = f"COLD OPEN — open the show. Tease top stories.\n{news_context}"
            self.alex.load_skill("skill_news_banter.md")
            self.mira.load_skill("skill_news_banter.md")

        elif seg == SegmentID.CULTURE_BEAT:
            topic = "culture"
            social = ""
            if editorial and editorial.social_pulse:
                social = "\nSocial pulse: " + ", ".join(editorial.social_pulse[:3])
            intent = f"CULTURE BEAT — culture, entertainment, trending topics.{social}\n{news_context}"
            self.alex.load_skill("skill_news_banter.md")
            self.mira.load_skill("skill_news_banter.md")

        elif seg == SegmentID.BANTER:
            callbacks = ""
            if session_memory:
                cbs = session_memory.get_callbacks_for(seg.value)
                if cbs:
                    callbacks = "\nCallbacks to use: " + "; ".join(c.content for c in cbs[:2])
            topic = "banter"
            intent = f"BANTER — casual conversation, callbacks, listener moments.{callbacks}\n{news_context}"
            self.alex.load_skill("skill_news_banter.md")
            self.mira.load_skill("skill_news_banter.md")

        elif headlines:
            top = headlines[0]
            topic = getattr(top, 'title', str(top))[:80]
            intent = f"HEADLINES — discuss this story.\nTITLE: {getattr(top, 'title', str(top))}\nSUMMARY: {getattr(top, 'summary', '(none)')}"
            self.alex.load_skill("skill_news_banter.md")
            self.mira.load_skill("skill_news_banter.md")
        else:
            topic = "slow_news"
            intent = "Slow news hour. Banter about broader trends and bold predictions."
            self.alex.load_skill("skill_slow_news.md")
            self.mira.load_skill("skill_slow_news.md")

        # Add radio physics context to intent
        turn_role = "host (Alex)" if agent_key == "host" else "cohost (Mira)"
        physics_context = (
            f"\n\n=== RADIO PHYSICS ===\n"
            f"Time block: {block_name}\n"
            f"Segment: {seg.value}\n"
            f"Turn {turn_number}/{total_turns} — you are {turn_role}\n"
            f"Turn anatomy: [hook→body→land], 3-7 sentences max\n"
            f"Speak, don't narrate. This is live audio."
        )

        intent_with_physics = intent + physics_context

        # Generate Alex's turn (or single turn if cohost)
        if agent_key == "host":
            logger.debug("Generating Host turn (segment=%s, turn=%d/%d)...", seg.value, turn_number, total_turns)
            host_text = self.alex.think_and_act(intent_with_physics)
            host_text = enforce_turn_anatomy(host_text)

            # Mira perceives Alex
            self.mira.perceive_dialogue(self.alex.name, host_text)
            mira_intent = f"Alex just spoke. Respond as co-host. Segment: {seg.value}. Turn info: {intent_with_physics}"
            cohost_text = self.mira.think_and_act(mira_intent)
            cohost_text = enforce_turn_anatomy(cohost_text)

            # Alex perceives Mira
            self.alex.perceive_dialogue(self.mira.name, cohost_text)
        else:
            # Generate Mira first (cohost-led segment like DEX_CORNER)
            logger.debug("Generating Co-Host turn (segment=%s, turn=%d/%d)...", seg.value, turn_number, total_turns)
            cohost_text = self.mira.think_and_act(intent_with_physics)
            cohost_text = enforce_turn_anatomy(cohost_text)

            # Alex perceives Mira
            self.alex.perceive_dialogue(self.mira.name, cohost_text)
            alex_intent = f"Mira just spoke. Respond as host. Segment: {seg.value}. Turn info: {intent_with_physics}"
            host_text = self.alex.think_and_act(alex_intent)
            host_text = enforce_turn_anatomy(host_text)

            # Mira perceives Alex
            self.mira.perceive_dialogue(self.alex.name, host_text)

        # Record topic unless it's a special event
        if not events:
            self.alex.perceive_topic(topic)
            self.mira.perceive_topic(topic)

        return DialogueTurn(host_text=host_text, cohost_text=cohost_text, topic=topic)

    def _format_editorial_context(self, items: list) -> str:
        """Format editorial items into a concise prompt context."""
        lines = []
        for item in items:
            if hasattr(item, 'radio_copy'):
                lines.append(f"- {item.radio_copy}")
            elif hasattr(item, 'headline'):
                lines.append(f"- {item.headline}")
            elif hasattr(item, 'title'):
                lines.append(f"- {item.title}")
        return "\n".join(lines[:5])
