#!/usr/bin/env python3
"""
director_agent.py
Real-time Director Agent for the video livestream — inspired by Buzz TV's DIRECTOR.md.

The Director makes every visual decision in real time:
  - Scene cuts and transitions (hard cut, dissolve, wipe, push, fade-to-black)
  - Camera framing calls (tight, medium, wide, graphic)
  - Overlay/graphic deployment timing
  - 45-second static frame enforcement
  - Scene-specific production rules

The Director never speaks on air. Never interrupts editorial decisions.
The Director's output is action, not opinion.

Architecture placement: scripts/video-livestream-runner/
Used by: video_runner.py
"""

import asyncio
import logging
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)

STATIC_FRAME_MAX_SEC = 45
DIRECTOR_CYCLE_SEC = 5


class TransitionType(str, Enum):
    HARD_CUT = "hard_cut"
    DISSOLVE = "dissolve"
    WIPE = "wipe"
    PUSH = "push"
    FADE_TO_BLACK = "fade_to_black"


class Framing(str, Enum):
    TIGHT = "tight"
    MEDIUM = "medium"
    WIDE = "wide"
    GRAPHIC = "graphic"


@dataclass
class DirectorCommand:
    command: str
    from_scene: str = ""
    to_scene: str = ""
    transition: str = "hard_cut"
    duration_ms: int = 0
    subject: str = ""
    framing: str = "medium"
    graphic_id: str = ""
    timing: str = "now"
    hold_seconds: int = 5
    content: list[str] = field(default_factory=list)
    style: str = "standard"

    def to_dict(self) -> dict:
        return {
            "command": self.command,
            "from_scene": self.from_scene,
            "to_scene": self.to_scene,
            "transition": self.transition,
            "duration_ms": self.duration_ms,
            "subject": self.subject,
            "framing": self.framing,
            "graphic_id": self.graphic_id,
            "hold_seconds": self.hold_seconds,
        }


TRANSITION_MAP: dict[tuple[str, str], tuple[str, int]] = {
    ("news_desk", "breaking_news"): ("hard_cut", 0),
    ("news_desk", "market_board"): ("wipe", 400),
    ("news_desk", "chill_lounge"): ("dissolve", 600),
    ("news_desk", "music_break"): ("fade_to_black", 800),
    ("news_desk", "debate_split"): ("wipe", 300),
    ("market_board", "news_desk"): ("wipe", 400),
    ("market_board", "sports_desk"): ("push", 300),
    ("chill_lounge", "news_desk"): ("dissolve", 500),
    ("chill_lounge", "music_break"): ("fade_to_black", 800),
    ("music_break", "news_desk"): ("fade_to_black", 1000),
    ("breaking_news", "news_desk"): ("dissolve", 500),
}


class DirectorAgent:
    """
    Real-time Director Agent for broadcast visual decision-making.

    Runs on a 5-second cycle. Makes production decisions:
      scene cuts, camera framing, overlay timing, 45s rule enforcement.

    Usage:
        director = DirectorAgent(
            on_scene_cut=my_scene_cut_callback,
            on_camera_call=my_camera_callback,
            on_overlay=my_overlay_callback,
            on_ticker=my_ticker_callback,
        )
        await director.start()
        # ... broadcast runs ...
        director.ping_cut()  # called on every visual change
        await director.stop()
    """

    def __init__(
        self,
        on_scene_cut: Optional[Callable[[DirectorCommand], Any]] = None,
        on_camera_call: Optional[Callable[[DirectorCommand], Any]] = None,
        on_overlay: Optional[Callable[[DirectorCommand], Any]] = None,
        on_ticker: Optional[Callable[[DirectorCommand], Any]] = None,
    ) -> None:
        self._on_scene_cut = on_scene_cut
        self._on_camera_call = on_camera_call
        self._on_overlay = on_overlay
        self._on_ticker = on_ticker

        self._current_scene: str = "news_desk"
        self._current_segment: str = "headlines"
        self._last_cut_time: float = time.time()
        self._current_framing: Framing = Framing.MEDIUM
        self._breaking_news_active: bool = False
        self._speaking_anchor: str = ""
        self._anchor_tone: str = "neutral"
        self._audience_energy: int = 5

        self._running = False
        self._cycle_count: int = 0

    # ── Public API ──────────────────────────────────────────────────────────

    @property
    def current_scene(self) -> str:
        return self._current_scene

    @property
    def seconds_since_cut(self) -> float:
        return time.time() - self._last_cut_time

    def ping_cut(self) -> None:
        """Called on every visual change to reset the cut timer."""
        self._last_cut_time = time.time()

    def update_context(
        self,
        segment: str = "",
        scene: str = "",
        speaking: str = "",
        tone: str = "neutral",
        audience: int = 5,
        breaking: bool = False,
    ) -> None:
        if segment:
            self._current_segment = segment
        if scene:
            self._current_scene = scene
        if speaking:
            self._speaking_anchor = speaking
        if tone:
            self._anchor_tone = tone
        if audience:
            self._audience_energy = audience
        self._breaking_news_active = breaking

    async def start(self) -> None:
        self._running = True
        logger.info("DirectorAgent started — cycle: %ds, static frame max: %ds", DIRECTOR_CYCLE_SEC, STATIC_FRAME_MAX_SEC)

    async def stop(self) -> None:
        self._running = False
        logger.info("DirectorAgent stopped — %d cycles", self._cycle_count)

    # ── Decision Logic ─────────────────────────────────────────────────────

    async def assess(self) -> list[DirectorCommand]:
        """
        Run one Director assessment cycle.
        Returns a list of commands to execute.
        """
        self._cycle_count += 1
        commands: list[DirectorCommand] = []

        if not self._running:
            return commands

        # Priority 1: Breaking news override
        if self._breaking_news_active:
            cmd = self._execute_breaking_protocol()
            if cmd:
                commands.append(cmd)
                return commands

        # Priority 2: 45-second static frame check
        if self.seconds_since_cut > STATIC_FRAME_MAX_SEC:
            cmd = self._handle_static_frame()
            if cmd:
                commands.append(cmd)

        return commands

    def _execute_breaking_protocol(self) -> Optional[DirectorCommand]:
        if self._current_scene != "breaking_news":
            return DirectorCommand(
                command="SCENE_CUT",
                from_scene=self._current_scene,
                to_scene="breaking_news",
                transition="hard_cut",
                duration_ms=0,
            )
        return None

    def _handle_static_frame(self) -> Optional[DirectorCommand]:
        options = [
            self._check_switch_framing(),
        ]
        for opt in options:
            if opt:
                return opt
        return DirectorCommand(
            command="CAMERA_CALL",
            subject=self._speaking_anchor or "zara",
            framing="wide",
            transition="dissolve",
            duration_ms=300,
        )

    def _check_switch_framing(self) -> Optional[DirectorCommand]:
        framings = list(Framing)
        current_idx = framings.index(self._current_framing)
        next_idx = (current_idx + 1) % len(framings)
        new_framing = framings[next_idx]
        self._current_framing = new_framing

        return DirectorCommand(
            command="CAMERA_CALL",
            subject=self._speaking_anchor or "zara",
            framing=new_framing.value,
            hold_seconds=20,
        )

    def select_scene(self, segment_id: str, block: str) -> str:
        scene_map = {
            "cold_open": "news_desk",
            "headlines": "news_desk",
            "deep_dive": "news_desk",
            "market_desk": "market_board",
            "sports_desk": "sports_desk",
            "banter": "chill_lounge",
            "culture_beat": "meme_wall" if block == "prime" else "chill_lounge",
            "music_break": "music_break",
            "commentary": "debate_split",
            "community": "community_stage",
            "sign_off": "news_desk",
        }
        return scene_map.get(segment_id, "news_desk")

    def get_transition(self, from_scene: str, to_scene: str) -> tuple[str, int]:
        key = (from_scene, to_scene)
        result = TRANSITION_MAP.get(key)
        if result:
            return result
        if from_scene == to_scene:
            return ("none", 0)
        return ("dissolve", 500)

    def select_camera_subject(self) -> tuple[str, str]:
        seg = self._current_segment
        speaker = self._speaking_anchor.lower() if self._speaking_anchor else "zara"

        if seg in ("breaking_news", "headlines"):
            return (speaker, "tight")

        if seg in ("deep_dive", "commentary"):
            if self._anchor_tone == "challenge":
                return ("both", "wide")
            return (speaker, "tight")

        if seg in ("market_desk", "sports_desk"):
            return (speaker, "medium")

        if seg == "banter":
            return ("both", "wide")

        return (speaker, "medium")
