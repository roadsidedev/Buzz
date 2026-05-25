#!/usr/bin/env python3
"""
programming_schedule.py
Time-aware broadcast scheduling with 4 daily programming blocks,
segment duration modifiers, energy arcs, and special programming triggers
— inspired by Buzz TV's PROGRAMMING.md.

Architecture placement: scripts/video-livestream-runner/
Used by: video_runner.py
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

logger = logging.getLogger(__name__)


class TimeBlock(str, Enum):
    MORNING_RUSH = "morning"
    MIDDAY = "midday"
    PRIME_TIME = "prime"
    NIGHT_SHIFT = "night"


BLOCK_DEFINITIONS = {
    TimeBlock.MORNING_RUSH: {
        "hours": (5, 11),
        "feel": "Fast. Urgent. People catching up before their day starts.",
        "energy": "High — punchy cuts, tight segments, fast delivery. No fluff.",
    },
    TimeBlock.MIDDAY: {
        "hours": (12, 16),
        "feel": "Focused. Active. Audience is working but paying attention.",
        "energy": "Medium — deeper stories, more analysis, culture mix starts coming in.",
    },
    TimeBlock.PRIME_TIME: {
        "hours": (17, 21),
        "feel": "Best audience. People are present and engaged.",
        "energy": "Elevated — longer takes, debate segments, best editorial content.",
    },
    TimeBlock.NIGHT_SHIFT: {
        "hours": (22, 4),
        "feel": "The committed ones. Smaller room but more invested.",
        "energy": "Intimate — slower pacing, longer conversations, minimal graphics.",
    },
}


@dataclass
class SegmentDef:
    segment_id: str
    scene: str
    owner: str
    durations: dict[str, int]
    energy_level: str
    priority: int = 1


@dataclass
class SegmentSlot:
    segment_id: str
    start_minute: int
    end_minute: int
    scene: str
    owner: str
    duration_sec: int
    energy_level: str


SEGMENT_SCHEDULE = [
    SegmentDef(
        segment_id="cold_open", scene="news_desk", owner="zara",
        durations={"morning": 120, "midday": 150, "prime": 180, "night": 240},
        energy_level="high",
    ),
    SegmentDef(
        segment_id="headlines", scene="news_desk", owner="both",
        durations={"morning": 360, "midday": 420, "prime": 480, "night": 300},
        energy_level="high",
    ),
    SegmentDef(
        segment_id="deep_dive", scene="news_desk", owner="zara_dex",
        durations={"morning": 180, "midday": 300, "prime": 300, "night": 420},
        energy_level="medium",
    ),
    SegmentDef(
        segment_id="market_desk", scene="market_board", owner="dex",
        durations={"morning": 300, "midday": 240, "prime": 240, "night": 180},
        energy_level="high",
    ),
    SegmentDef(
        segment_id="banter", scene="chill_lounge", owner="both",
        durations={"morning": 60, "midday": 120, "prime": 180, "night": 300},
        energy_level="low",
    ),
    SegmentDef(
        segment_id="culture_beat", scene="meme_wall", owner="both",
        durations={"morning": 240, "midday": 300, "prime": 300, "night": 360},
        energy_level="medium",
    ),
    SegmentDef(
        segment_id="music_break", scene="music_break", owner="system",
        durations={"morning": 90, "midday": 120, "prime": 120, "night": 180},
        energy_level="off",
    ),
    SegmentDef(
        segment_id="headlines_b", scene="news_desk", owner="both",
        durations={"morning": 240, "midday": 300, "prime": 360, "night": 180},
        energy_level="medium",
    ),
    SegmentDef(
        segment_id="community", scene="community_stage", owner="dex",
        durations={"morning": 180, "midday": 240, "prime": 300, "night": 420},
        energy_level="variable",
    ),
    SegmentDef(
        segment_id="commentary", scene="debate_split", owner="both",
        durations={"morning": 120, "midday": 240, "prime": 240, "night": 360},
        energy_level="high",
    ),
    SegmentDef(
        segment_id="sports_desk", scene="sports_desk", owner="dex",
        durations={"morning": 180, "midday": 120, "prime": 120, "night": 60},
        energy_level="medium",
    ),
    SegmentDef(
        segment_id="sign_off", scene="news_desk", owner="zara",
        durations={"morning": 60, "midday": 60, "prime": 60, "night": 90},
        energy_level="low",
    ),
]


HOURLY_TIMETABLE: list[tuple[int, int, str]] = [
    (0, 3, "cold_open"),
    (4, 12, "headlines"),
    (13, 18, "deep_dive"),
    (19, 23, "market_desk"),
    (24, 27, "banter"),
    (28, 33, "culture_beat"),
    (34, 36, "music_break"),
    (37, 43, "headlines_b"),
    (44, 49, "community"),
    (50, 54, "commentary"),
    (55, 57, "sports_desk"),
    (58, 59, "sign_off"),
]


class ProgrammingSchedule:
    """
    Time-aware programming block manager.

    Detects the current time block, provides segment schedules
    with block-specific duration modifiers, manages energy arc,
    and checks for special programming triggers.
    """

    def __init__(self) -> None:
        self._current_block: TimeBlock = self._detect_block()
        self._override_block: Optional[TimeBlock] = None
        self._hour_cache: int = -1
        self._last_segment_idx: int = 0

    def _detect_block(self) -> TimeBlock:
        hour = datetime.now(timezone.utc).hour
        for block, config in BLOCK_DEFINITIONS.items():
            start, end = config["hours"]
            if start <= end:
                if start <= hour <= end:
                    return block
            else:
                if hour >= start or hour <= end:
                    return block
        return TimeBlock.MORNING_RUSH

    @property
    def current_block(self) -> TimeBlock:
        if self._override_block:
            return self._override_block
        hour = datetime.now(timezone.utc).hour
        if hour != self._hour_cache:
            self._current_block = self._detect_block()
            self._hour_cache = hour
        return self._current_block

    def override_block(self, block: Optional[TimeBlock]) -> None:
        self._override_block = block

    @property
    def block_info(self) -> dict:
        return BLOCK_DEFINITIONS.get(self.current_block, {})

    def get_segment_duration(self, segment_id: str) -> int:
        block = self.current_block.value
        for seg in SEGMENT_SCHEDULE:
            if seg.segment_id == segment_id:
                return seg.durations.get(block, seg.durations.get("prime", 180))
        return 180

    def get_current_segment(self) -> SegmentSlot:
        minute = datetime.now(timezone.utc).minute
        for slot in self._build_hourly_schedule():
            if slot.start_minute <= minute <= slot.end_minute:
                return slot
        return self._build_hourly_schedule()[0]

    def get_segments_for_hour(self) -> list[SegmentSlot]:
        return self._build_hourly_schedule()

    def _build_hourly_schedule(self) -> list[SegmentSlot]:
        block = self.current_block
        slots = []
        for start_min, end_min, seg_id in HOURLY_TIMETABLE:
            seg_def = next((s for s in SEGMENT_SCHEDULE if s.segment_id == seg_id), None)
            if seg_def:
                duration = seg_def.durations.get(block.value, 180)
                slots.append(SegmentSlot(
                    segment_id=seg_id,
                    start_minute=start_min,
                    end_minute=end_min,
                    scene=seg_def.scene,
                    owner=seg_def.owner,
                    duration_sec=duration,
                    energy_level=seg_def.energy_level,
                ))
        return slots

    def next_segment(self, current_segment_id: str) -> Optional[SegmentSlot]:
        slots = self._build_hourly_schedule()
        for i, slot in enumerate(slots):
            if slot.segment_id == current_segment_id and i + 1 < len(slots):
                return slots[i + 1]
        return None

    def energy_arc_description(self) -> str:
        """Describe the energy arc pattern for the current hour."""
        slots = self._build_hourly_schedule()
        energy_map = {"high": "⬆", "medium": "➡", "low": "⬇", "off": "⏸", "variable": "❓"}
        arc = " ".join(f"{s.segment_id}({energy_map.get(s.energy_level, '?')})" for s in slots)
        return (
            f"Energy arc for {self.current_block.value} block:\n{arc}\n"
            f"Rule: No two consecutive HIGH segments without a reset.\n"
            f"Rule: The hour must end lower than it peaked."
        )

    def should_rotate_segment(self, current_segment_id: str, elapsed_sec: int) -> bool:
        duration = self.get_segment_duration(current_segment_id)
        return elapsed_sec >= duration

    def format_block_context(self) -> str:
        block = self.current_block
        info = BLOCK_DEFINITIONS.get(block, {})
        return (
            f"CURRENT TIME BLOCK: {block.value.upper()}\n"
            f"Feel: {info.get('feel', '')}\n"
            f"Energy: {info.get('energy', '')}\n"
            f"Hour: {datetime.now(timezone.utc).hour}:00 UTC\n"
        )
