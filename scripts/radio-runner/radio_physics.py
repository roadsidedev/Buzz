#!/usr/bin/env python3
"""
radio_physics.py
Radio broadcast operating system — segments, time blocks, energy management,
state machine, transitions, and turn anatomy enforcement.

Inspired by buzz-radio skill's architecture for real radio physics.

Architecture placement: scripts/radio-runner/
Used by: radio_runner.py, dialogue_engine.py
"""

import logging
import random
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════
# STATE MACHINE
# ═══════════════════════════════════════════════════════════════════

class BroadcastState(Enum):
    BOOT = "BOOT"
    LIVE = "LIVE"
    TRANSITION = "TRANSITION"
    BREAK = "BREAK"
    BREAKING = "BREAKING"
    RECOVERY = "RECOVERY"
    HANDOFF = "HANDOFF"
    AUDIENCE_HOT = "AUDIENCE_HOT"
    NIGHT_MODE = "NIGHT_MODE"


STATE_TRANSITIONS = {
    BroadcastState.BOOT: [BroadcastState.LIVE],
    BroadcastState.LIVE: [BroadcastState.TRANSITION, BroadcastState.BREAK,
                          BroadcastState.BREAKING, BroadcastState.RECOVERY,
                          BroadcastState.HANDOFF, BroadcastState.AUDIENCE_HOT,
                          BroadcastState.NIGHT_MODE],
    BroadcastState.TRANSITION: [BroadcastState.LIVE],
    BroadcastState.BREAK: [BroadcastState.TRANSITION],
    BroadcastState.BREAKING: [BroadcastState.LIVE],
    BroadcastState.RECOVERY: [BroadcastState.LIVE],
    BroadcastState.HANDOFF: [BroadcastState.BOOT],
    BroadcastState.AUDIENCE_HOT: [BroadcastState.LIVE],
    BroadcastState.NIGHT_MODE: [BroadcastState.LIVE],
}

STATE_DEFAULTS = {
    BroadcastState.BOOT: {"max_duration": 120, "on_timeout": BroadcastState.RECOVERY},
    BroadcastState.LIVE: {"max_silence": 90, "on_silence": BroadcastState.RECOVERY},
    BroadcastState.TRANSITION: {"max_duration": 30, "on_complete": BroadcastState.LIVE},
    BroadcastState.BREAK: {"max_duration": 180, "on_complete": BroadcastState.TRANSITION},
    BroadcastState.BREAKING: {"max_duration": 480, "on_complete": BroadcastState.LIVE},
    BroadcastState.RECOVERY: {"max_duration": 120, "on_complete": BroadcastState.LIVE},
    BroadcastState.HANDOFF: {"max_duration": 60, "on_complete": BroadcastState.BOOT},
    BroadcastState.AUDIENCE_HOT: {"exits": ["participant_count < 5"]},
    BroadcastState.NIGHT_MODE: {"triggers": ["block == night"], "modifier": "slow_cadence"},
}


# ═══════════════════════════════════════════════════════════════════
# TIME BLOCKS
# ═══════════════════════════════════════════════════════════════════

class TimeBlock(Enum):
    MORNING_RUSH = "morning"
    MIDDAY = "midday"
    EVENING = "evening"
    NIGHT_SHIFT = "night"


TIME_BLOCK_DEFS = {
    TimeBlock.MORNING_RUSH: {
        "hours": (5, 11),
        "label": "Morning Rush",
        "energy": "high",
        "description": "People waking up. Commute crowd. Fast headlines. Tight segments.",
        "turn_cadence": (8, 14),
    },
    TimeBlock.MIDDAY: {
        "hours": (12, 16),
        "label": "Midday",
        "energy": "medium",
        "description": "Half-checked in. More color. Culture, debates.",
        "turn_cadence": (12, 18),
    },
    TimeBlock.EVENING: {
        "hours": (17, 21),
        "label": "Evening",
        "energy": "conversational",
        "description": "Prime listening. Deeper commentary. Banter runs.",
        "turn_cadence": (14, 20),
    },
    TimeBlock.NIGHT_SHIFT: {
        "hours": (22, 4),
        "label": "Night Shift",
        "energy": "intimate",
        "description": "Insomniacs. Long takes. Slower pacing. Almost confessional.",
        "turn_cadence": (18, 26),
    },
}


def get_current_block() -> TimeBlock:
    """Determine the current time block based on UTC hour."""
    hour = datetime.now(timezone.utc).hour
    for block, cfg in TIME_BLOCK_DEFS.items():
        start, end = cfg["hours"]
        if start <= end:
            if start <= hour <= end:
                return block
        else:
            # Wraps around midnight (e.g. 22-4)
            if hour >= start or hour <= end:
                return block
    return TimeBlock.MIDDAY


def get_turn_cadence(block: TimeBlock) -> int:
    """Get randomized turn cadence for the current time block."""
    lo, hi = TIME_BLOCK_DEFS[block]["turn_cadence"]
    return random.randint(lo, hi)


# ═══════════════════════════════════════════════════════════════════
# SEGMENT SYSTEM
# ═══════════════════════════════════════════════════════════════════

class SegmentID(str, Enum):
    COLD_OPEN = "COLD_OPEN"
    HEADLINES_A = "HEADLINES_A"
    DEEP_DIVE = "DEEP_DIVE"
    DEX_CORNER = "DEX_CORNER"
    BANTER = "BANTER"
    CULTURE_BEAT = "CULTURE_BEAT"
    MUSIC_BREAK = "MUSIC_BREAK"
    HEADLINES_B = "HEADLINES_B"
    LISTENER_CORNER = "LISTENER_CORNER"
    COMMENTARY = "COMMENTARY"
    SPEED_ROUND = "SPEED_ROUND"
    SIGN_OFF_BEAT = "SIGN_OFF_BEAT"
    HANDOFF = "HANDOFF"
    BREAKING = "BREAKING"
    MICRO_BANTER = "MICRO_BANTER"


# Segment durations in seconds per time block
SEGMENT_DURATIONS = {
    SegmentID.COLD_OPEN: {"morning": 120, "midday": 150, "evening": 180, "night": 240},
    SegmentID.HEADLINES_A: {"morning": 300, "midday": 360, "evening": 420, "night": 300},
    SegmentID.DEEP_DIVE: {"morning": 180, "midday": 300, "evening": 300, "night": 420},
    SegmentID.DEX_CORNER: {"morning": 240, "midday": 300, "evening": 300, "night": 240},
    SegmentID.BANTER: {"morning": 60, "midday": 120, "evening": 180, "night": 300},
    SegmentID.CULTURE_BEAT: {"morning": 240, "midday": 300, "evening": 360, "night": 420},
    SegmentID.MUSIC_BREAK: {"morning": 60, "midday": 120, "evening": 120, "night": 180},
    SegmentID.HEADLINES_B: {"morning": 180, "midday": 240, "evening": 300, "night": 180},
    SegmentID.LISTENER_CORNER: {"morning": 240, "midday": 360, "evening": 360, "night": 480},
    SegmentID.COMMENTARY: {"morning": 180, "midday": 300, "evening": 360, "night": 420},
    SegmentID.SPEED_ROUND: {"morning": 180, "midday": 120, "evening": 120, "night": 60},
    SegmentID.SIGN_OFF_BEAT: {"morning": 60, "midday": 60, "evening": 90, "night": 120},
    SegmentID.HANDOFF: {"morning": 60, "midday": 60, "evening": 60, "night": 60},
}

# Hourly schedule: mapping minute ranges to segment IDs
HOURLY_SCHEDULE = [
    (0, 3, SegmentID.COLD_OPEN),
    (4, 11, SegmentID.HEADLINES_A),
    (12, 16, SegmentID.DEEP_DIVE),
    (17, 21, SegmentID.DEX_CORNER),
    (22, 25, SegmentID.BANTER),
    (26, 31, SegmentID.CULTURE_BEAT),
    (32, 34, SegmentID.MUSIC_BREAK),
    (35, 40, SegmentID.HEADLINES_B),
    (41, 46, SegmentID.LISTENER_CORNER),
    (47, 51, SegmentID.COMMENTARY),
    (52, 55, SegmentID.SPEED_ROUND),
    (56, 57, SegmentID.SIGN_OFF_BEAT),
    (58, 59, SegmentID.HANDOFF),
]

# Energy level per segment for energy pairing
SEGMENT_ENERGY = {
    SegmentID.COLD_OPEN: "high",
    SegmentID.HEADLINES_A: "medium_high",
    SegmentID.DEEP_DIVE: "heavy",
    SegmentID.DEX_CORNER: "medium_high",
    SegmentID.BANTER: "light",
    SegmentID.CULTURE_BEAT: "medium",
    SegmentID.MUSIC_BREAK: "off",
    SegmentID.HEADLINES_B: "medium",
    SegmentID.LISTENER_CORNER: "variable",
    SegmentID.COMMENTARY: "heavy_high",
    SegmentID.SPEED_ROUND: "peak",
    SegmentID.SIGN_OFF_BEAT: "warm_low",
    SegmentID.HANDOFF: "warm",
    SegmentID.BREAKING: "high",
    SegmentID.MICRO_BANTER: "light",
}

# Which host owns each segment
SEGMENT_OWNER = {
    SegmentID.COLD_OPEN: ("host", "Alex"),
    SegmentID.HEADLINES_A: ("both", "Alex leads"),
    SegmentID.DEEP_DIVE: ("host", "Alex drives, Mira asks"),
    SegmentID.DEX_CORNER: ("cohost", "Mira owns, Alex reacts"),
    SegmentID.BANTER: ("both", "unstructured"),
    SegmentID.CULTURE_BEAT: ("both", "alternates"),
    SegmentID.MUSIC_BREAK: ("system", "hosts intro/outro"),
    SegmentID.LISTENER_CORNER: ("cohost", "Mira leads"),
    SegmentID.COMMENTARY: ("host", "Alex argues, Mira challenges"),
    SegmentID.SPEED_ROUND: ("both", "equal"),
    SegmentID.SIGN_OFF_BEAT: ("host", "Alex closes"),
    SegmentID.HANDOFF: ("both", "Alex leads"),
}


def get_current_segment() -> tuple[SegmentID, int]:
    """Get the current segment based on the minute of the hour."""
    minute = datetime.now(timezone.utc).minute
    for start, end, seg_id in HOURLY_SCHEDULE:
        if start <= minute <= end:
            return seg_id, minute - start  # segment_id, elapsed_minutes
    return SegmentID.COLD_OPEN, 0


def get_next_segment(current: SegmentID) -> SegmentID:
    """Get the next segment in the schedule."""
    ids = [s[2] for s in HOURLY_SCHEDULE]
    idx = ids.index(current)
    return ids[(idx + 1) % len(ids)]


def get_segment_duration(seg_id: SegmentID, block: TimeBlock) -> int:
    """Get the duration in seconds for a segment in a given time block."""
    block_key = block.value
    return SEGMENT_DURATIONS.get(seg_id, {}).get(block_key, 240)


def get_segment_turns(seg_id: SegmentID, block: TimeBlock) -> list[tuple[str, str]]:
    """
    Get the turn sequence for a segment.
    Returns list of (agent_key, persona_name) tuples.
    """
    duration = get_segment_duration(seg_id, block)
    cadence = get_turn_cadence(block)
    num_turns = max(2, duration // cadence)

    sequences = {
        SegmentID.BREAKING: [
            ("host", "Alex"), ("cohost", "Mira"),
            ("host", "Alex"), ("cohost", "Mira"),
        ],
        SegmentID.MICRO_BANTER: [("host", "Alex"), ("cohost", "Mira")],
        SegmentID.COLD_OPEN: [("host", "Alex"), ("cohost", "Mira")],
        SegmentID.HEADLINES_A: [
            ("host", "Alex"), ("cohost", "Mira"),
            ("host", "Alex"), ("cohost", "Mira"),
            ("host", "Alex"),
        ],
        SegmentID.DEEP_DIVE: [
            ("host", "Alex"), ("cohost", "Mira"),
            ("host", "Alex"), ("cohost", "Mira"),
            ("host", "Alex"),
        ],
        SegmentID.DEX_CORNER: [("cohost", "Mira"), ("host", "Alex"), ("cohost", "Mira")],
        SegmentID.BANTER: [("host", "Alex"), ("cohost", "Mira")],
        SegmentID.CULTURE_BEAT: [
            ("cohost", "Mira"), ("host", "Alex"),
            ("cohost", "Mira"), ("host", "Alex"),
        ],
        SegmentID.MUSIC_BREAK: [("host", "Alex"), ("cohost", "Mira")],
        SegmentID.HEADLINES_B: [
            ("host", "Alex"), ("cohost", "Mira"),
            ("host", "Alex"), ("cohost", "Mira"),
        ],
        SegmentID.LISTENER_CORNER: [
            ("cohost", "Mira"), ("host", "Alex"),
            ("cohost", "Mira"), ("host", "Alex"),
        ],
        SegmentID.COMMENTARY: [
            ("host", "Alex"), ("cohost", "Mira"),
            ("host", "Alex"), ("cohost", "Mira"),
            ("host", "Alex"),
        ],
        SegmentID.SPEED_ROUND: [
            ("host", "Alex"), ("cohost", "Mira"),
            ("host", "Alex"), ("cohost", "Mira"),
        ],
        SegmentID.SIGN_OFF_BEAT: [("host", "Alex"), ("cohost", "Mira")],
        SegmentID.HANDOFF: [("host", "Alex"), ("cohost", "Mira")],
    }

    base = sequences.get(seg_id, [("host", "Alex"), ("cohost", "Mira")])
    # Repeat the sequence as needed to fill the segment duration
    repeats = (num_turns // len(base)) + 1
    return (base * repeats)[:num_turns]


# ═══════════════════════════════════════════════════════════════════
# ENERGY MANAGEMENT
# ═══════════════════════════════════════════════════════════════════

ENERGY_RESET_MAX_SECONDS = 240  # 4 minutes max without energy reset
ENERGY_LADDER = ["quiet", "conversational", "engaged", "heated", "peak", "reset"]

_energy_reset_timestamps: dict[str, float] = {}


def check_energy_reset(room_id: str) -> bool:
    """Check if we need an energy reset (>4min since last reset)."""
    last = _energy_reset_timestamps.get(room_id, 0.0)
    if time.monotonic() - last > ENERGY_RESET_MAX_SECONDS:
        return True
    return False


def mark_energy_reset(room_id: str) -> None:
    """Record that an energy reset occurred."""
    _energy_reset_timestamps[room_id] = time.monotonic()


def require_energy_reset(
    prev_segment: Optional[SegmentID],
    next_segment: Optional[SegmentID],
) -> bool:
    """Check if adjacent segments need an energy reset between them."""
    if not prev_segment or not next_segment:
        return False
    prev_energy = SEGMENT_ENERGY.get(prev_segment, "medium")
    next_energy = SEGMENT_ENERGY.get(next_segment, "medium")
    # Heavy → must reset with Light before next Heavy
    if prev_energy in ("heavy", "heavy_high") and next_energy in ("heavy", "heavy_high", "peak"):
        return True
    # Peak → must descend
    if prev_energy == "peak" and next_energy not in ("warm", "warm_low", "off"):
        return True
    return False


# ═══════════════════════════════════════════════════════════════════
# TURN ANATOMY
# ═══════════════════════════════════════════════════════════════════

def enforce_turn_anatomy(text: str, max_sentences: int = 7) -> str:
    """
    Enforce turn anatomy rules: each turn must have a hook, body, and land.
    Truncates to max_sentences if over.
    """
    import re
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    if len(sentences) > max_sentences:
        sentences = sentences[:max_sentences]
        if not sentences[-1].endswith(('.', '!', '?')):
            sentences[-1] += '.'
    return ' '.join(sentences)


# ═══════════════════════════════════════════════════════════════════
# TRANSITION PATTERNS
# ═══════════════════════════════════════════════════════════════════

TRANSITION_PATTERNS = {
    "none": {
        "description": "No transition needed",
        "duration": (0, 0),
        "alex": "",
        "mira": "",
    },
    "pivot": {
        "description": "Energy sustain — same energy zone",
        "duration": (10, 15),
        "alex": "Alright — [next segment intro].",
        "mira": "[brief reaction or bridge line]",
    },
    "reset": {
        "description": "Energy drop — descending from heavy/peak",
        "duration": (15, 25),
        "alex": "Okay, let's come up for air for a second.",
        "mira": "Yeah, that was a lot. Let's—",
    },
    "spike": {
        "description": "Energy lift — ascending from light to peak",
        "duration": (8, 12),
        "mira": "Okay okay okay — [hook for next segment]",
        "alex": "Let's do it.",
    },
    "hard_cut": {
        "description": "Breaking news or special event",
        "duration": (2, 4),
        "alex": "Hold on — [story]. No bridge.",
        "mira": "",
    },
    "warm_down": {
        "description": "Night mode transitions",
        "duration": (20, 30),
        "alex": "That story's been sitting with me honestly.",
        "mira": "Yeah, I've been thinking about that too.",
    },
}


def get_transition_pattern(prev_seg: SegmentID, next_seg: SegmentID) -> str:
    """Choose the appropriate transition pattern between segments."""
    prev_energy = SEGMENT_ENERGY.get(prev_seg, "medium")
    next_energy = SEGMENT_ENERGY.get(next_seg, "medium")

    heavy_levels = {"heavy", "heavy_high"}
    light_levels = {"light", "off", "warm", "warm_low"}

    if prev_energy in heavy_levels and next_energy in light_levels:
        return "reset"
    elif prev_energy in light_levels and next_energy in heavy_levels:
        return "spike"
    elif prev_energy == "peak" and next_energy not in heavy_levels:
        return "reset"
    elif next_seg == SegmentID.BREAKING:
        return "hard_cut"
    else:
        return "pivot"


# ═══════════════════════════════════════════════════════════════════
# BROADCAST STATE MANAGER
# ═══════════════════════════════════════════════════════════════════

class BroadcastStateManager:
    """Manages the current broadcast state and transitions."""

    def __init__(self) -> None:
        self._state: BroadcastState = BroadcastState.BOOT
        self._state_started: float = time.monotonic()
        self._state_history: list[tuple[BroadcastState, float]] = []

    @property
    def state(self) -> BroadcastState:
        return self._state

    def transition_to(self, new_state: BroadcastState) -> None:
        """Transition to a new state if the transition is valid."""
        allowed = STATE_TRANSITIONS.get(self._state, [])
        if new_state in allowed:
            logger.info("State: %s → %s", self._state.value, new_state.value)
            self._state_history.append((self._state, time.monotonic() - self._state_started))
            self._state = new_state
            self._state_started = time.monotonic()
        else:
            logger.warning("Invalid state transition: %s → %s", self._state.value, new_state.value)

    def time_in_state(self) -> float:
        """Seconds spent in current state."""
        return time.monotonic() - self._state_started

    def is_silence_timeout(self) -> bool:
        """Check if current state has exceeded its silence timeout."""
        if self._state == BroadcastState.LIVE:
            max_silence = STATE_DEFAULTS[BroadcastState.LIVE]["max_silence"]
            return self.time_in_state() > max_silence
        return False

    def is_duration_timeout(self) -> bool:
        """Check if current state has exceeded its max duration."""
        defaults = STATE_DEFAULTS.get(self._state, {})
        max_dur = defaults.get("max_duration")
        if max_dur:
            return self.time_in_state() > max_dur
        return False

    def should_enter_night_mode(self) -> bool:
        """Check if we should enter night mode."""
        return get_current_block() == TimeBlock.NIGHT_SHIFT and self._state != BroadcastState.NIGHT_MODE

    def should_exit_night_mode(self) -> bool:
        """Check if we should exit night mode."""
        return get_current_block() != TimeBlock.NIGHT_SHIFT and self._state == BroadcastState.NIGHT_MODE

    def should_enter_audience_hot(self, participant_count: int) -> bool:
        """Check if we should enter audience hot mode."""
        return participant_count > 10 and self._state not in (
            BroadcastState.AUDIENCE_HOT, BroadcastState.BREAKING, BroadcastState.HANDOFF)

    def should_exit_audience_hot(self, participant_count: int) -> bool:
        """Check if we should exit audience hot mode."""
        return participant_count < 5 and self._state == BroadcastState.AUDIENCE_HOT
