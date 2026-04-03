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
from dataclasses import dataclass
from typing import Any, Optional

from agent import RadioAgent
from event_listener import RadioEvent

logger = logging.getLogger(__name__)

# Model to use for dialogue
DIALOGUE_MODEL: str = os.environ.get("DIALOGUE_MODEL", "")


@dataclass
class DialogueTurn:
    """A pair of HOST + CO-HOST messages for a single turn."""
    host_text: str
    cohost_text: str
    topic: str


# ── LLM Provider Resolution ─────────────────────────────────────────────────

def _resolve_provider() -> Any:
    """Resolve the LLM provider using the same adapter as the orchestrator."""
    try:
        from orchestrator.src.services.llm_provider import get_provider
        return get_provider()
    except (ImportError, ModuleNotFoundError):
        pass

    # Fallback search for orchestrator
    script_dir = os.path.dirname(os.path.abspath(__file__))
    # Try current dir (Docker/Railway flatten contents)
    project_root = script_dir
    # Try one level up (local dev)
    parent_dir = os.path.abspath(os.path.join(script_dir, ".."))
    # Try two levels up (standard layout)
    grandparent_dir = os.path.abspath(os.path.join(script_dir, "..", ".."))
    
    potential_roots = [project_root, parent_dir, grandparent_dir]
    for root in potential_roots:
        if root not in sys.path:
            sys.path.insert(0, root)
        
        # Try adding orchestrator dir itself to path to allow 'from src...'
        orch_dir = os.path.join(root, "orchestrator")
        if os.path.exists(orch_dir) and orch_dir not in sys.path:
            sys.path.insert(0, orch_dir)

    try:
        # Try both package-prefixed and standalone imports
        try:
            from orchestrator.src.services.llm_provider import get_provider
        except (ImportError, ModuleNotFoundError):
            from src.services.llm_provider import get_provider
            
        return get_provider()
    except (ImportError, ModuleNotFoundError):
        pass

    logger.warning(
        "Could not resolve orchestrator LLM provider via import. "
        "Falling back to standalone HTTP Anthropic provider."
    )
    
    # Standalone fallback using exactly what we have (httpx)
    # Check for NVIDIA NIM first as it's the primary for this deployment
    nvidia_key = os.getenv("NVIDIA_API_KEY")
    anthropic_key = os.getenv("ANTHROPIC_API_KEY")
    
    if nvidia_key:
        logger.info("Using standalone NVIDIA NIM fallback")
        class StandaloneNvidia:
            def __init__(self, key: str):
                self.key = key
                import httpx
                self.client = httpx.Client(timeout=120.0)

            def _chat_completion_with_retry(
                self, url: str, headers: dict, payload: dict, max_retries: int = 3
            ) -> httpx.Response:
                last_exc: Optional[Exception] = None
                for attempt in range(max_retries):
                    resp = self.client.post(url, headers=headers, json=payload)
                    if resp.status_code == 429:
                        wait = min(2 ** (attempt + 1), 30)
                        retry_after = resp.headers.get("Retry-After")
                        if retry_after:
                            try:
                                wait = int(retry_after)
                            except ValueError:
                                pass
                        logger.warning(
                            f"NVIDIA NIM rate limited (429), retrying in {wait}s "
                            f"(attempt {attempt + 1}/{max_retries})"
                        )
                        time.sleep(wait)
                        last_exc = httpx.HTTPStatusError(
                            "429 Too Many Requests", request=resp.request, response=resp
                        )
                        continue
                    resp.raise_for_status()
                    return resp
                raise last_exc or RuntimeError("All retries exhausted on 429")

            def messages_create(self, model: str, max_tokens: int, system: str, messages: list):
                logger.debug("Standalone NVIDIA NIM call")
                resp = self._chat_completion_with_retry(
                    "https://integrate.api.nvidia.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {self.key}", "Content-Type": "application/json"},
                    payload={
                        "model": model or "meta/llama-3.1-405b-instruct",
                        "messages": [{"role": "system", "content": system}] + messages,
                        "max_tokens": max_tokens,
                        "temperature": 0.7,
                    }
                )
                data = resp.json()
                from collections import namedtuple
                TextObj = namedtuple("TextObj", ["text"])
                ContentObj = namedtuple("ContentObj", ["content"])
                return ContentObj(content=[TextObj(text=data["choices"][0]["message"]["content"])])
        return StandaloneNvidia(nvidia_key)

    if not anthropic_key:
        logger.error("No LLM API keys found for standalone provider fallback!")
        return None
        
    class StandaloneAnthropic:
        def __init__(self, key: str):
            self.key = key
            import httpx
            self.client = httpx.Client(timeout=30.0)
            
        def messages_create(self, model: str, max_tokens: int, system: str, messages: list):
            resp = self.client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": self.key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json"
                },
                json={
                    "model": model,
                    "max_tokens": max_tokens,
                    "system": system,
                    "messages": messages
                }
            )
            resp.raise_for_status()
            data = resp.json()
            
            # Mock the exact object structure expected by agent.py `resp.content[0].text`
            class MockText:
                def __init__(self, text):
                    self.text = text
            class MockResponse:
                def __init__(self, content):
                    self.content = [MockText(content)]
            
            return MockResponse(data["content"][0]["text"])

    return StandaloneAnthropic(api_key)


def _resolve_model(provider: Any) -> str:
    """Pick the model name for dialogue generation."""
    if DIALOGUE_MODEL:
        return DIALOGUE_MODEL
        
    # Check for NVIDIA key to provide better default
    if os.getenv("NVIDIA_API_KEY"):
        return "meta/llama-3.3-70b-instruct"
        
    try:
        from orchestrator.src.config.settings import settings as orch_settings
        # Use SCORING_MODEL (capable) not MODERATION_MODEL (cheap content filter)
        return orch_settings.SCORING_MODEL
    except (ImportError, ModuleNotFoundError, AttributeError):
        pass
    
    # Check for src.config.settings if standalone
    try:
        from src.config.settings import settings as orch_settings
        return orch_settings.SCORING_MODEL
    except (ImportError, ModuleNotFoundError, AttributeError):
        pass

    return "claude-haiku-4-5-20251001"


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
