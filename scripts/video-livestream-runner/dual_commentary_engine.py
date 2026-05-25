#!/usr/bin/env python3
"""
dual_commentary_engine.py
Two-anchor AI commentary generation with orchestration scoring.

Manages Zara (main anchor) and Dex (co-anchor) with distinct identities,
chemistry rules, and turn-based orchestration. Each turn generates
candidate lines from both anchors, scores them on 5 dimensions,
selects the winner, and provides the loser's perspective as context.

Architecture placement: scripts/video-livestream-runner/
Depends on: anchor_profiles.py, agent.py
Used by: video_runner.py
"""

import logging
import os
import random
import time
from dataclasses import dataclass, field
from typing import Any, Optional

from agent import RadioAgent
from anchor_profiles import (
    DEX,
    ZARA,
    ANCHOR_CHEMISTRY_RULES,
    ORCHESTRATION_SCORING_DIMENSIONS,
    AnchorProfile,
    format_identity_prompt,
    get_primary,
    get_secondary,
)

logger = logging.getLogger(__name__)


@dataclass
class AnchorTurn:
    speaker: str
    text: str
    scores: dict[str, float] = field(default_factory=dict)
    total_score: float = 0.0
    visual_cue: str = "neutral"
    turn_type: str = "standard"


@dataclass
class OrchestratedSegment:
    winner: AnchorTurn
    runner_up: AnchorTurn
    topic: str
    context: str
    segment_type: str = "headlines"


class LLMClient:
    """Lightweight LLM client wrapping multiple providers for commentary."""

    def __init__(self) -> None:
        self._provider = self._resolve_provider()
        self._model = self._resolve_model()

    def _resolve_provider(self) -> Any:
        from commentary_engine import _resolve_provider
        return _resolve_provider()

    def _resolve_model(self) -> str:
        from commentary_engine import _resolve_model
        return _resolve_model()

    def generate(
        self,
        system: str,
        prompt: str,
        max_tokens: int = 120,
        temperature: float = 0.7,
    ) -> Optional[str]:
        if not self._provider:
            return None
        try:
            resp = self._provider.messages_create(
                model=self._model,
                max_tokens=max_tokens,
                system=system,
                messages=[{"role": "user", "content": prompt}],
            )
            return resp.content[0].text.strip()
        except Exception as exc:
            logger.error("LLM call failed: %s", exc)
            return None


class OrchestrationScorer:
    """
    Scores candidate anchor messages on 5 editorial dimensions.
    Each dimension weighted per ORCHESTRATION_SCORING_DIMENSIONS.
    """

    def __init__(self, llm: LLMClient) -> None:
        self._llm = llm

    def score(
        self,
        candidate: str,
        speaker: str,
        topic: str,
        context: str,
        prior_transcript: list[str],
        segment_type: str,
    ) -> tuple[dict[str, float], float]:
        dims = ORCHESTRATION_SCORING_DIMENSIONS
        try:
            dim_list = "\n".join(
                f"- {k} ({v['weight']*100:.0f}%): {v['description']}"
                for k, v in dims.items()
            )
            prompt = (
                f"Score this anchor line on 5 dimensions (0-100 each).\n\n"
                f"Segment: {segment_type}\n"
                f"Topic: {topic}\n"
                f"Context: {context}\n"
                f"Speaker: {speaker}\n"
                f"Line: \"{candidate}\"\n"
                f"Prior discussion:\n"
                + "\n".join(f"  - {t}" for t in prior_transcript[-4:])
                + f"\n\n{dim_list}\n\n"
                f"Respond with ONLY a JSON object like:\n"
                f'{{"relevance": 85, "novelty": 70, "coherence": 90, "actionability": 60, "engagement": 75}}'
            )
            result = self._llm.generate(
                system="You are an editorial scoring engine. Return ONLY valid JSON. No explanation.",
                prompt=prompt,
                max_tokens=200,
                temperature=0.1,
            )
            if result:
                import json
                result = result.strip()
                if result.startswith("```"):
                    result = result.split("\n", 1)[-1]
                    result = result.rsplit("\n", 1)[0]
                scores = json.loads(result)
                filtered = {k: max(0, min(100, float(v))) for k, v in scores.items() if k in dims}
                total = sum(filtered.get(k, 0) * v["weight"] for k, v in dims.items())
                return filtered, total
        except Exception as exc:
            logger.debug("LLM scoring failed, using heuristic: %s", exc)

        return self._heuristic_score(candidate, speaker, topic, prior_transcript)

    def _heuristic_score(
        self,
        candidate: str,
        speaker: str,
        topic: str,
        prior_transcript: list[str],
    ) -> tuple[dict[str, float], float]:
        word_count = len(candidate.split())
        has_topic = topic.lower() in candidate.lower()
        novelty = 60.0 if prior_transcript and not any(
            candidate[:30].lower() in t.lower() for t in prior_transcript[-2:]
        ) else 40.0

        scores = {
            "relevance": 70.0 if has_topic else 40.0,
            "novelty": novelty,
            "coherence": 65.0,
            "actionability": 55.0 if word_count > 8 else 40.0,
            "engagement": 50.0 + min(20.0, word_count * 2),
        }
        total = sum(
            scores[k] * ORCHESTRATION_SCORING_DIMENSIONS[k]["weight"]
            for k in scores
        )
        return scores, total


class DualCommentaryEngine:
    """
    Two-anchor commentary engine with orchestration scoring.

    Manages Zara and Dex with full identity prompts, chemistry rules,
    turn generation, orchestration scoring, and turn-type awareness.
    Integrates with the RadioAgent framework for memory and skills.
    """

    def __init__(self) -> None:
        self._llm = LLMClient()
        self._scorer = OrchestrationScorer(self._llm)

        self._zara_agent: Optional[RadioAgent] = None
        self._dex_agent: Optional[RadioAgent] = None

        self._prior_transcript: list[str] = []
        self._turn_count: int = 0
        self._last_winner: Optional[str] = None

        self._setup_agents()

    def _setup_agents(self) -> None:
        try:
            self._zara_agent = RadioAgent(
                "Zara",
                "core_identity_host.md",
                self._llm._provider,
                self._llm._model,
                max_memory_turns=15,
            )
            self._dex_agent = RadioAgent(
                "Dex",
                "core_identity_host.md",
                self._llm._provider,
                self._llm._model,
                max_memory_turns=15,
            )
        except Exception as exc:
            logger.warning("RadioAgent init failed, using fallback: %s", exc)

    def _build_anchor_prompt(
        self,
        profile: AnchorProfile,
        topic: str,
        context: str,
        turn_type: str,
        segment_type: str,
        is_winner_last: bool,
    ) -> tuple[str, str]:
        identity = format_identity_prompt(profile)
        chemistry = ANCHOR_CHEMISTRY_RULES

        other = get_secondary() if profile.is_primary else get_primary()
        own_segments = ", ".join(profile.segment_ownership)

        system = (
            f"{identity}\n\n"
            f"{chemistry}\n\n"
            f"=== SEGMENT CONTEXT ===\n"
            f"Segment type: {segment_type}\n"
            f"Your segments: {own_segments}\n"
            f"Co-anchor: {other.name} ({other.role})\n"
            f"Won last turn: {'Yes' if is_winner_last else 'No'}\n"
            f"Keep responses under 40 words. Be concise. Be broadcast-ready."
        )

        turn_prompts = {
            "lead": (
                f"Lead the segment on this topic: {topic}\n"
                f"Context: {context}\n"
                f"Open with authority and set up the discussion for {other.name}."
            ),
            "respond": (
                f"Respond to the current topic: {topic}\n"
                f"Context: {context}\n"
                f"{other.name} just spoke. React, add perspective, or challenge."
            ),
            "challenge": (
                f"Challenge or add perspective on: {topic}\n"
                f"Context: {context}\n"
                f"You disagree or have a substantially different take. Be professional but firm."
            ),
            "support": (
                f"Support or expand on: {topic}\n"
                f"Context: {context}\n"
                f"Add data, context, or a real-world example that backs up the point."
            ),
            "close": (
                f"Close the discussion on: {topic}\n"
                f"Context: {context}\n"
                f"Land the segment with a strong final take or a question for the audience."
            ),
        }

        intent = turn_prompts.get(turn_type, turn_prompts["respond"])
        return system, intent

    def generate_turn(
        self,
        topic: str,
        context: str,
        segment_type: str = "headlines",
        turn_type: Optional[str] = None,
    ) -> OrchestratedSegment:
        """
        Generate one orchestrated turn: both anchors speak, scores select winner.

        Args:
            topic: Current headline/topic
            context: Story context or data
            segment_type: Type of segment (headlines, deep_dive, market, etc.)
            turn_type: Override for turn type (auto-rotates if None)

        Returns:
            OrchestratedSegment with winner and runner-up
        """
        self._turn_count += 1

        if turn_type is None:
            turn_type = self._select_turn_type(segment_type)

        zara_profile = get_primary()
        dex_profile = get_secondary()
        is_zara_last = self._last_winner == "Zara" if self._last_winner else True

        zara_system, zara_intent = self._build_anchor_prompt(
            zara_profile, topic, context, turn_type, segment_type, is_zara_last,
        )
        dex_system, dex_intent = self._build_anchor_prompt(
            dex_profile, topic, context, self._opposite_turn(turn_type), segment_type, not is_zara_last,
        )

        zara_text = self._generate_anchor(zara_profile, zara_system, zara_intent, topic)
        dex_text = self._generate_anchor(dex_profile, dex_system, dex_intent, topic)

        zara_scores, zara_total = self._scorer.score(
            zara_text, "Zara", topic, context, self._prior_transcript, segment_type,
        )
        dex_scores, dex_total = self._scorer.score(
            dex_text, "Dex", topic, context, self._prior_transcript, segment_type,
        )

        zara_vcue = self._classify_cue(zara_text)
        dex_vcue = self._classify_cue(dex_text)

        zara_turn = AnchorTurn(
            speaker="Zara", text=zara_text,
            scores=zara_scores, total_score=zara_total,
            visual_cue=zara_vcue, turn_type=turn_type,
        )
        dex_turn = AnchorTurn(
            speaker="Dex", text=dex_text,
            scores=dex_scores, total_score=dex_total,
            visual_cue=dex_vcue, turn_type=self._opposite_turn(turn_type),
        )

        if zara_total >= dex_total:
            winner, runner = zara_turn, dex_turn
        else:
            winner, runner = dex_turn, zara_turn

        self._last_winner = winner.speaker
        self._prior_transcript.append(f"[{winner.speaker}] {winner.text}")
        self._prior_transcript.append(f"[{runner.speaker}] {runner.text}")
        if len(self._prior_transcript) > 20:
            self._prior_transcript = self._prior_transcript[-20:]

        logger.info(
            "Turn %d — Winner: %s (%.1f) | Runner: %s (%.1f) | Topic: %.40s",
            self._turn_count, winner.speaker, winner.total_score,
            runner.speaker, runner.total_score, topic,
        )

        return OrchestratedSegment(
            winner=winner,
            runner_up=runner,
            topic=topic,
            context=context,
            segment_type=segment_type,
        )

    def _generate_anchor(
        self,
        profile: AnchorProfile,
        system: str,
        intent: str,
        topic: str,
    ) -> str:
        text = self._llm.generate(system, intent, max_tokens=120)
        if not text:
            logger.warning("LLM returned None for %s, using fallback", profile.name)
            text = (
                f"Welcome back to Buzz News. We're following {topic}. "
                f"Let's get into the details."
            )
        return text

    def _select_turn_type(self, segment_type: str) -> str:
        """Auto-select turn type based on segment and rotation."""
        pattern = {
            "cold_open": ["lead", "respond"],
            "headlines": ["lead", "respond", "challenge"],
            "deep_dive": ["lead", "challenge", "support", "challenge", "close"],
            "market_desk": ["lead", "respond", "challenge", "close"],
            "sports_desk": ["lead", "respond", "support", "close"],
            "banter": ["lead", "respond", "respond", "close"],
            "culture_beat": ["lead", "challenge", "respond", "close"],
            "community": ["lead", "respond", "support", "close"],
            "commentary": ["lead", "challenge", "support", "challenge", "close"],
            "sign_off": ["lead", "close"],
        }
        turns = pattern.get(segment_type, ["lead", "respond"])
        idx = (self._turn_count - 1) % len(turns)
        return turns[idx]

    def _opposite_turn(self, turn_type: str) -> str:
        mapping = {
            "lead": "respond",
            "respond": "challenge",
            "challenge": "support",
            "support": "challenge",
            "close": "respond",
        }
        return mapping.get(turn_type, "respond")

    def _classify_cue(self, text: str) -> str:
        from commentary_engine import _classify_cue
        if self._llm._provider:
            return _classify_cue(self._llm._provider, self._llm._model, text)
        return "neutral"

    def flush_memory(self) -> None:
        if self._zara_agent:
            self._zara_agent.flush_memory()
        if self._dex_agent:
            self._dex_agent.flush_memory()
