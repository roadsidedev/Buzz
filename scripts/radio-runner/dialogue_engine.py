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

    # Fallback: add project root to path (set PYTHONPATH in the environment instead
    # of relying on this — it won't hold in Docker or deployed environments)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(script_dir, "..", ".."))
    if project_root not in sys.path:
        logger.debug("sys.path fallback: adding %s (prefer setting PYTHONPATH)", project_root)
        sys.path.insert(0, project_root)

    try:
        from orchestrator.src.services.llm_provider import get_provider
        return get_provider()
    except (ImportError, ModuleNotFoundError):
        pass

    try:
        from src.services.llm_provider import get_provider
        return get_provider()
    except (ImportError, ModuleNotFoundError):
        pass

    logger.warning(
        "Could not resolve orchestrator LLM provider. "
        "Set PYTHONPATH to include the project root, or pass provider= to DialogueEngine."
    )
    return None


def _resolve_model(provider: Any) -> str:
    """Pick the model name for dialogue generation."""
    if DIALOGUE_MODEL:
        return DIALOGUE_MODEL
    try:
        from orchestrator.src.config.settings import settings as orch_settings
        # Use SCORING_MODEL (capable) not MODERATION_MODEL (cheap content filter)
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
            intent = "It's a slow news hour. Banter about broader tech/society trends."
            self.alex.load_skill("skill_news_banter.md")
            self.mira.load_skill("skill_news_banter.md")

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
