#!/usr/bin/env python3
"""
agent.py
Phase 2 Agentic Framework for Radio Hosts.

This module provides the `RadioAgent` class, which transforms the raw, stateless
dialogue engine into a stateful, RAG-capable cognitive loop modeled on OpenClaw.

Agents possess:
1. Core Identity (immutable traits)
2. Active Skills (dynamically loaded instructions like 'news_banter' or 'interview')
3. Short-term Memory (transcript sliding window)
4. Long-term Memory (topic stances)

Architecture placement: scripts/radio-runner/
Used by: dialogue_engine.py (v2) / radio_runner.py
"""

import json
import logging
import os
from collections import deque
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

RADIO_MEMORY_DIR: str = os.environ.get("RADIO_MEMORY_DIR", "")

logger = logging.getLogger(__name__)


@dataclass
class AgentMemoryItem:
    role: str       # 'user', 'assistant', 'system' (for events)
    content: str
    metadata: dict = field(default_factory=dict)


class RadioAgent:
    """
    Stateful Agent matching the OpenClaw generic loop.
    Replaces static prompt generation with memory-aware generation.
    """

    def __init__(
        self,
        name: str,
        identity_file: str,
        provider: Any,
        model: str,
        max_memory_turns: int = 10,
    ) -> None:
        """
        Initialize a stateful radio agent.

        Args:
            name: The agent's name (e.g., 'Alex', 'Mira')
            identity_file: Path to the core identity markdown file
            provider: The LLM provider (from get_provider())
            model: The string model name to use
            max_memory_turns: How many recent dialogue turns to retain
        """
        self.name = name
        self.provider = provider
        self.model = model
        self.max_memory_turns = max_memory_turns

        # Memory buffers
        self.short_term_memory: deque[AgentMemoryItem] = deque(maxlen=max_memory_turns)

        # Long-term memory (covered topics)
        memory_dir = Path(RADIO_MEMORY_DIR) if RADIO_MEMORY_DIR else Path(__file__).parent
        self.memory_file = memory_dir / f"memory_{name.lower()}.json"
        self.covered_topics: deque[str] = deque(
            self._load_long_term_memory(), maxlen=20
        )

        # Load Core Identity
        self.skills_dir = Path(__file__).parent / "skills"
        self.core_identity = self._load_skill_file(identity_file)

        # The currently active situation instruction
        self.active_skill_prompt: str = ""
        
        logger.info("Initialized Agent '%s' (Model: %s)", self.name, self.model)

    def load_skill(self, skill_filename: str) -> None:
        """Swap the active skill (e.g., from 'news_banter' to 'breaking_news')."""
        self.active_skill_prompt = self._load_skill_file(skill_filename)
        logger.debug("Agent '%s' loaded skill: %s", self.name, skill_filename)

    def perceive_topic(self, topic: str) -> None:
        """Record that a topic has been covered to long-term memory."""
        if topic and topic not in self.covered_topics:
            self.covered_topics.append(topic)  # deque auto-evicts oldest at maxlen=20

    def flush_memory(self) -> None:
        """Persist long-term memory to disk. Call on shutdown / SIGTERM."""
        self._save_long_term_memory()

    def perceive_event(self, event_text: str) -> None:
        """Add an external event (like USER_JOINED) to memory."""
        self.short_term_memory.append(AgentMemoryItem("system", event_text))
        logger.debug("Agent '%s' perceived event: %s", self.name, event_text)

    def perceive_dialogue(self, speaker: str, text: str) -> None:
        """Add spoken dialogue to memory."""
        role = "assistant" if speaker == self.name else "user"
        prefix = "" if speaker == self.name else f"[{speaker} said]: "
        
        self.short_term_memory.append(
            AgentMemoryItem(role, f"{prefix}{text}", {"speaker": speaker})
        )

    def think_and_act(self, prompt_intent: str) -> str:
        """
        The core cognitive cycle.
        1. Compile context (Identity + Skill + Memory)
        2. Execute LLM call
        3. Return generated dialogue text
        """
        if not self.provider:
            return f"[{self.name} is offline — no LLM provider]"

        # Inject memory of past topics to avoid repetition
        memory_instruction = ""
        if self.covered_topics:
            topics_str = ", ".join(list(self.covered_topics)[-5:])
            memory_instruction = f"\n\n=== MEMORY ===\nYou recently discussed: {topics_str}. Do not repeat the exact same takes."

        system_instruction = f"{self.core_identity}\n\n=== CURRENT INSTRUCTIONS ===\n{self.active_skill_prompt}{memory_instruction}"
        
        messages = self._build_chat_messages(prompt_intent)

        resp = self.provider.messages_create(
            model=self.model,
            max_tokens=150,
            system=system_instruction,
            messages=messages,
        )
        text = resp.content[0].text.strip()
        # Agent remembers its own thought/action
        self.perceive_dialogue(self.name, text)
        return text

    def _build_chat_messages(self, current_intent: str) -> List[Dict[str, str]]:
        """Format the memory buffer into provider-compatible message shapes."""
        messages: List[Dict[str, str]] = []

        # Replay short term memory
        # Note: If consecutive 'user' or 'system' messages occur, group them 
        # as a single 'user' block, as some LLM APIs strictly enforce alternating user/assistant turns.
        
        current_role = None
        current_content = []

        for item in self.short_term_memory:
            # Map 'system' events to 'user' role for the chat history API compatibility
            target_role = "user" if item.role in ("user", "system") else "assistant"
            
            if current_role == target_role:
                current_content.append(item.content)
            else:
                if current_role is not None:
                    messages.append({"role": current_role, "content": "\n".join(current_content)})
                current_role = target_role
                current_content = [item.content]

        if current_role is not None:
            messages.append({"role": current_role, "content": "\n".join(current_content)})

        # Fix: Anthropic requires the first message in the array to be from a "user"
        if messages and messages[0]["role"] == "assistant":
            messages.insert(0, {"role": "user", "content": "(Dialogue history started by assistant)"})

        # Ensure the final message is always the current explicit intent (from the user/orchestrator run loop)
        final_user_msg = f"Task: {current_intent}"
        
        if not messages or messages[-1]["role"] != "user":
            messages.append({"role": "user", "content": final_user_msg})
        else:
            messages[-1]["content"] += f"\n\nTask: {current_intent}"

        return messages

    def _load_skill_file(self, filename: str) -> str:
        """Load markdown instruction text from the skills folder."""
        filepath = self.skills_dir / filename
        if not filepath.exists():
            logger.warning("Agent '%s' missing skill file: %s", self.name, filename)
            return f"Assume role based on prior knowledge for missing file {filename}."
            
        return filepath.read_text(encoding="utf-8").strip()

    def _load_long_term_memory(self) -> List[str]:
        """Load covered topics from disk."""
        if self.memory_file.exists():
            try:
                with open(self.memory_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    topics = data.get("covered_topics", [])
                    if not isinstance(topics, list):
                        logger.warning("Corrupted memory file for %s — resetting", self.name)
                        return []
                    return topics
            except Exception as e:
                logger.error("Failed to load memory for %s: %s", self.name, e)
        return []

    def _save_long_term_memory(self) -> None:
        """Save covered topics to disk."""
        try:
            with open(self.memory_file, "w", encoding="utf-8") as f:
                json.dump({"covered_topics": list(self.covered_topics)}, f, indent=2)
        except Exception as e:
            logger.error("Failed to save memory for %s: %s", self.name, e)
