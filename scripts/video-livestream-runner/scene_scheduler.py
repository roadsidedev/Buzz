#!/usr/bin/env python3
"""
scene_scheduler.py
Rotates between visual scene types at configurable intervals.

Mirrors music_scheduler.py from the radio-runner but switches visual
scene templates instead of injecting audio breaks.

Scene types:
  0: "live_news"      — default commentary with data overlay
  1: "data_card"      — full-screen data visualization
  2: "break_card"     — intermission / break screen

Architecture placement: scripts/video-livestream-runner/
Used by: video_runner.py
"""

import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)

SCENE_NAMES = ["live_news", "data_card", "break_card"]


@dataclass
class SceneRotation:
    scene_name: str
    rotation_number: int
    duration_turns: int


class SceneScheduler:
    """
    Tracks turns and signals when to rotate the visual scene.

    Usage:
        scheduler = SceneScheduler(rotation_interval=6, break_interval=12)
        # After each turn:
        scheduler.record_turn()
        if scheduler.should_rotate():
            scene = scheduler.next_scene()
    """

    def __init__(
        self,
        rotation_interval: int = 6,
        break_interval: int = 12,
    ) -> None:
        self._rotation_interval = max(1, rotation_interval)
        self._break_interval = max(2, break_interval)
        self._turn_count: int = 0
        self._rotation_count: int = 0
        self._scene_index: int = 0

    # ── Public API ───────────────────────────────────────────────────────────

    def record_turn(self) -> None:
        """Record that a turn was processed."""
        self._turn_count += 1

    def should_rotate(self) -> bool:
        """True when the current scene should be swapped."""
        if self._turn_count == 0:
            return False
        return self._turn_count % self._rotation_interval == 0

    def is_break_turn(self) -> bool:
        """True when we should show the break/intermission card."""
        if self._turn_count == 0:
            return False
        return self._turn_count % self._break_interval == 0

    def next_scene(self) -> SceneRotation:
        """
        Determine the next scene to display.

        On break intervals: show break_card
        Otherwise: rotate through live_news → data_card → live_news → ...
        """
        self._rotation_count += 1

        if self.is_break_turn():
            scene_name = "break_card"
        else:
            scene_name = SCENE_NAMES[self._scene_index]
            self._scene_index = (self._scene_index + 1) % 2

        rotation = SceneRotation(
            scene_name=scene_name,
            rotation_number=self._rotation_count,
            duration_turns=self._rotation_interval,
        )
        logger.info(
            "Scene rotation #%d → %s",
            rotation.rotation_number, rotation.scene_name,
        )
        return rotation

    @property
    def turn_count(self) -> int:
        return self._turn_count

    @property
    def rotation_count(self) -> int:
        return self._rotation_count

    @property
    def current_scene(self) -> str:
        return SCENE_NAMES[self._scene_index]
