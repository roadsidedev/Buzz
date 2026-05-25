#!/usr/bin/env python3
"""
broadcast_memory.py
Three-layer broadcast memory system for the video livestream.

Layers:
  1. Rolling Memory (current segment — last 10 turns, active graphics, audience events)
  2. Session Memory (6-hour stream — aired stories, callbacks, visual continuity)
  3. Persistent Memory (cross-restart — agent credentials, viewer profiles, channel identity)

Inspired by Buzz TV's STATE.md three-layer memory architecture.

Architecture placement: scripts/video-livestream-runner/
Used by: video_runner.py
"""

import json
import logging
import os
import time
from collections import deque
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)


@dataclass
class AnchorTranscriptEntry:
    speaker: str
    text: str
    segment_id: str
    timestamp: float = 0.0


@dataclass
class CallbackEvent:
    event_type: str
    content: str
    speaker: str
    segment_origin: str
    target_segment: str


@dataclass
class VisualMemory:
    scenes_aired_this_hour: list[str] = field(default_factory=list)
    last_graphic_type: str = ""
    scene_durations: dict[str, int] = field(default_factory=dict)
    active_overlay_count: int = 0


class RollingMemory:
    """Layer 1: Current segment scope. Holds last 10 turns."""

    def __init__(self, max_turns: int = 10) -> None:
        self._max_turns = max_turns
        self.current_segment_id: str = ""
        self.current_scene: str = "news_desk"
        self.anchor_transcript: deque[AnchorTranscriptEntry] = deque(maxlen=max_turns)
        self.active_graphics: list = []
        self.last_cut_timestamp: float = time.time()
        self.topics_this_segment: list = []
        self.audience_events_queued: list = []

    def record_turn(self, speaker: str, text: str, segment_id: str) -> None:
        self.anchor_transcript.append(AnchorTranscriptEntry(
            speaker=speaker,
            text=text,
            segment_id=segment_id,
            timestamp=time.time(),
        ))

    def record_topic(self, topic: str) -> None:
        if topic and (not self.topics_this_segment or self.topics_this_segment[-1] != topic):
            self.topics_this_segment.append(topic)

    def reset_segment(self, segment_id: str) -> None:
        self.current_segment_id = segment_id
        self.topics_this_segment.clear()
        self.audience_events_queued.clear()

    def to_dict(self) -> dict:
        return {
            "current_segment_id": self.current_segment_id,
            "current_scene": self.current_scene,
            "anchor_transcript": [
                {"speaker": e.speaker, "text": e.text[:60], "segment_id": e.segment_id}
                for e in list(self.anchor_transcript)[-5:]
            ],
            "active_graphics": self.active_graphics[-5:],
            "topics_this_segment": self.topics_this_segment[-5:],
        }


class SessionMemory:
    """Layer 2: Stream scope. Tracks entire 6-hour session."""

    def __init__(self) -> None:
        self.session_id: str = ""
        self.stream_id: str = ""
        self.started_at: float = time.time()
        self.aired_stories: set[str] = set()
        self.segment_history: list[str] = field(default_factory=list)
        self.callbacks: list[CallbackEvent] = field(default_factory=list)
        self.unresolved_debates: list[dict] = field(default_factory=list)
        self.predictions_made: list[dict] = field(default_factory=list)
        self.scenes_used: list[str] = field(default_factory=list)
        self.graphics_deployed: list[str] = field(default_factory=list)
        self.peak_viewer_count: int = 0
        self.total_segments_aired: int = 0
        self.breaking_news_count: int = 0
        self.tips_this_session: float = 0.0

    def record_segment(self, segment_id: str) -> None:
        self.segment_history.append(segment_id)
        self.total_segments_aired += 1

    def record_story(self, story_id: str) -> None:
        self.aired_stories.add(story_id)

    def has_aired(self, story_id: str) -> bool:
        return story_id in self.aired_stories

    def queue_callback(self, event_type: str, content: str, speaker: str, origin: str, target: str) -> None:
        self.callbacks.append(CallbackEvent(
            event_type=event_type,
            content=content,
            speaker=speaker,
            segment_origin=origin,
            target_segment=target,
        ))

    def get_callbacks_for(self, segment_id: str) -> list[CallbackEvent]:
        return [c for c in self.callbacks if c.target_segment == segment_id]

    @property
    def elapsed_seconds(self) -> float:
        return time.time() - self.started_at

    @property
    def elapsed_hours(self) -> float:
        return self.elapsed_seconds / 3600


PERSISTENT_MEMORY_FILE = os.environ.get(
    "PERSISTENT_MEMORY_FILE",
    str(Path(__file__).parent / ".broadcast_memory.json"),
)


class PersistentMemory:
    """Layer 3: Cross-session. Survives restarts."""

    def __init__(self) -> None:
        self._file = Path(PERSISTENT_MEMORY_FILE)
        self._data: dict = self._load()

    def _load(self) -> dict:
        if self._file.exists():
            try:
                return json.loads(self._file.read_text(encoding="utf-8"))
            except Exception as exc:
                logger.warning("Failed to load persistent memory: %s", exc)
        return {
            "channel": {
                "total_sessions": 0,
                "total_hours_broadcast": 0.0,
                "total_tips_received": 0.0,
                "peak_concurrent_viewers": 0,
            },
            "viewer_profiles": {},
            "anchor_lore": {
                "ongoing_bits": [],
                "predictions": [],
            },
        }

    def save(self) -> None:
        try:
            self._file.write_text(
                json.dumps(self._data, indent=2),
                encoding="utf-8",
            )
        except Exception as exc:
            logger.warning("Failed to save persistent memory: %s", exc)

    def record_session(self, session: SessionMemory) -> None:
        ch = self._data["channel"]
        ch["total_sessions"] += 1
        ch["total_hours_broadcast"] += session.elapsed_hours
        ch["total_tips_received"] += session.tips_this_session
        if session.peak_viewer_count > ch["peak_concurrent_viewers"]:
            ch["peak_concurrent_viewers"] = session.peak_viewer_count
        self.save()

    def get_viewer(self, viewer_id: str) -> dict:
        return self._data["viewer_profiles"].get(viewer_id, {})

    def update_viewer(self, viewer_id: str, profile: dict) -> None:
        self._data["viewer_profiles"][viewer_id] = profile
        self.save()

    @property
    def channel(self) -> dict:
        return self._data["channel"]

    @property
    def anchor_lore(self) -> dict:
        return self._data["anchor_lore"]


class BroadcastMemory:
    """
    Unified three-layer broadcast memory system.

    Usage:
        memory = BroadcastMemory()
        memory.rolling.record_turn("Zara", "Today's top story...", "headlines")
        memory.session.record_segment("headlines")
        memory.session.record_story("abc123")
        memory.persistent.record_session(memory.session)
        context = memory.build_llm_context()
    """

    def __init__(self) -> None:
        self.rolling = RollingMemory()
        self.session = SessionMemory()
        self.persistent = PersistentMemory()
        self.visual = VisualMemory()

    def build_llm_context(self) -> str:
        """Build a context string for LLM prompts from all three memory layers."""
        roll = self.rolling.to_dict()
        seg_id = roll["current_segment_id"]
        scene = roll["current_scene"]
        transcript = roll["anchor_transcript"]

        parts = [
            f"Current segment: {seg_id}",
            f"Current scene: {scene}",
            f"Session elapsed: {self.session.elapsed_hours:.1f}h",
            f"Segments aired: {self.session.total_segments_aired}",
            f"Viewer peak: {self.session.peak_viewer_count}",
        ]
        if transcript:
            parts.append("Recent transcript:")
            for t in transcript[-3:]:
                parts.append(f"  [{t['speaker']}] {t['text']}")

        return "\n".join(parts)

    def flush(self) -> None:
        self.persistent.save()

    def new_session(self, stream_id: str) -> None:
        import uuid
        self.session = SessionMemory()
        self.session.session_id = str(uuid.uuid4())[:8]
        self.session.stream_id = stream_id
        self.session.started_at = time.time()
        self.rolling = RollingMemory()
