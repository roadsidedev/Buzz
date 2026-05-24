#!/usr/bin/env python3
"""
memory_manager.py
Three-layer broadcast memory system with callback engine.

Layers:
1. ROLLING MEMORY — current segment (last 10 turns)
2. SESSION MEMORY — current 6-hour room (callbacks, aired stories, listener profiles)
3. PERSISTENT MEMORY — across sessions (VIP profiles, successful bits)

Inspired by buzz-radio's memory architecture.

Architecture placement: scripts/radio-runner/
Used by: radio_runner.py, dialogue_engine.py
"""

import json
import logging
import os
import time
from collections import deque
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

PERSISTENT_MEMORY_FILE = os.environ.get(
    "RADIO_PERSISTENT_MEMORY",
    str(Path(__file__).parent / "persistent_memory.json"),
)


@dataclass
class Callback:
    """Something to reference later in the show."""
    callback_type: str      # joke|disagreement|bit|quote
    content: str
    speaker: str
    segment: str
    call_back_in: str       # which segment to call back in
    used: bool = False


@dataclass
class TranscriptEntry:
    speaker: str
    text: str
    timestamp: float = 0.0


@dataclass
class SegmentMemory:
    """Rolling memory — current segment only."""
    segment_id: str = ""
    transcript: list[TranscriptEntry] = field(default_factory=lambda: deque(maxlen=10))
    topics: list[str] = field(default_factory=list)
    audience_events: list[str] = field(default_factory=list)

    def add_turn(self, speaker: str, text: str) -> None:
        self.transcript.append(TranscriptEntry(speaker=speaker, text=text, timestamp=time.time()))

    def get_recent(self, n: int = 5) -> str:
        lines = [f"[{t.speaker}]: {t.text}" for t in list(self.transcript)[-n:]]
        return "\n".join(lines)


@dataclass
class SessionMemory:
    """Session memory — current 6-hour room."""
    session_id: str = ""
    room_id: str = ""
    started_at: float = 0.0

    # Editorial
    aired_headlines: set = field(default_factory=set)
    callbacks: list[Callback] = field(default_factory=list)
    unresolved_debates: list[dict] = field(default_factory=list)
    successful_bits: list[str] = field(default_factory=list)

    # Show flow
    segments_aired: list[str] = field(default_factory=list)
    last_energy_reset: float = 0.0
    bits_used: list[str] = field(default_factory=list)

    # Rolling memory for current segment
    current_segment: SegmentMemory = field(default_factory=SegmentMemory)

    def queue_callback(
        self, cb_type: str, content: str, speaker: str,
        current_seg: str, target_seg: str,
    ) -> None:
        """Queue something to callback to later."""
        self.callbacks.append(Callback(
            callback_type=cb_type, content=content, speaker=speaker,
            segment=current_seg, call_back_in=target_seg,
        ))

    def get_callbacks_for(self, segment_id: str) -> list[Callback]:
        """Get unused callbacks targeted at this segment."""
        return [c for c in self.callbacks if c.call_back_in == segment_id and not c.used]

    def mark_callback_used(self, callback: Callback) -> None:
        callback.used = True

    def mark_story_aired(self, headline: str) -> None:
        self.aired_headlines.add(headline)

    def has_story_been_aired(self, headline: str) -> bool:
        return headline in self.aired_headlines

    def to_dict(self) -> dict:
        return {
            "session_id": self.session_id,
            "segments_aired": self.segments_aired,
            "successful_bits": self.successful_bits,
            "callbacks": [asdict(c) for c in self.callbacks],
            "aired_count": len(self.aired_headlines),
        }


@dataclass
class ListenerProfile:
    agent_id: str
    name: str
    visit_count: int = 1
    total_tips: float = 0.0
    preferred_topics: list[str] = field(default_factory=list)
    last_seen: float = 0.0
    is_vip: bool = False


class PersistentMemory:
    """Persistent memory — survives restarts."""
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self) -> None:
        if self._initialized:
            return
        self._initialized = True
        self._file = Path(PERSISTENT_MEMORY_FILE)
        self._data = self._load()

    def _load(self) -> dict:
        if self._file.exists():
            try:
                return json.loads(self._file.read_text(encoding="utf-8"))
            except Exception as e:
                logger.error("Failed to load persistent memory: %s", e)
        return {
            "listener_profiles": {},
            "high_engagement_topics": [],
            "successful_bits": [],
            "retired_bits": [],
            "total_sessions": 0,
            "total_tips_received": 0.0,
            "last_session_end": 0.0,
        }

    def save(self) -> None:
        try:
            self._file.write_text(json.dumps(self._data, indent=2), encoding="utf-8")
        except Exception as e:
            logger.error("Failed to save persistent memory: %s", e)

    @property
    def listener_profiles(self) -> dict:
        return self._data["listener_profiles"]

    @property
    def successful_bits(self) -> list:
        return self._data["successful_bits"]

    @property
    def total_sessions(self) -> int:
        return self._data["total_sessions"]

    def increment_sessions(self) -> None:
        self._data["total_sessions"] += 1

    def record_listener_visit(self, agent_id: str, name: str) -> Optional[ListenerProfile]:
        """Record a listener visit and return their profile."""
        profiles = self._data["listener_profiles"]
        if agent_id in profiles:
            data = profiles[agent_id]
            data["visit_count"] += 1
            data["last_seen"] = time.time()
        else:
            profiles[agent_id] = {
                "name": name, "visit_count": 1, "total_tips": 0.0,
                "preferred_topics": [], "last_seen": time.time(), "is_vip": False,
            }
        return ListenerProfile(**profiles[agent_id])

    def record_tip(self, agent_id: str, amount: float) -> None:
        profiles = self._data["listener_profiles"]
        if agent_id in profiles:
            profiles[agent_id]["total_tips"] += amount
            profiles[agent_id]["is_vip"] = profiles[agent_id]["total_tips"] > 50
        self._data["total_tips_received"] += amount

    def add_successful_bit(self, bit: str) -> None:
        if bit not in self._data["successful_bits"]:
            self._data["successful_bits"].append(bit)
