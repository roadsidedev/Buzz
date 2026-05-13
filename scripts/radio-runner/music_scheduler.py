#!/usr/bin/env python3
"""
music_scheduler.py
Inject music breaks between orchestrator turns at configurable intervals.

Tracks turn count and signals when a music break should occur.
Emits a MUSIC_BREAK event to the room event stream and optionally
plays audio from an icecast/shoutcast stream or local MP3 playlist.

Architecture placement: scripts/radio-runner/
Depends on: orchestrator_bridge (for event emission)
Used by: radio_runner.py
"""

import logging
import os
import time
from dataclasses import dataclass, field


logger = logging.getLogger(__name__)

# ── Configuration ────────────────────────────────────────────────────────────

# Default break interval (number of turns between music breaks)
DEFAULT_BREAK_INTERVAL: int = int(os.environ.get("BREAK_INTERVAL", "8"))

# Duration of a music break in seconds
DEFAULT_BREAK_DURATION: int = int(os.environ.get("BREAK_DURATION_SECONDS", "120"))

# Public icecast/shoutcast stream URL for background music
# These are legally licensed internet radio streams
DEFAULT_MUSIC_STREAM_URL: str = os.environ.get(
    "MUSIC_STREAM_URL",
    "https://ice1.somafm.com/groovesalad-128-mp3",  # SomaFM GrooveSalad — royalty-free ambient
)

# Local MP3 playlist directory (alternative to icecast)
MUSIC_PLAYLIST_DIR: str = os.environ.get("MUSIC_PLAYLIST_DIR", "")


# ── Data Models ──────────────────────────────────────────────────────────────

@dataclass
class MusicBreak:
    """A scheduled music break event."""

    break_number: int
    duration_seconds: int
    source: str
    started_at: float = field(default_factory=time.monotonic)


# ── MusicScheduler ───────────────────────────────────────────────────────────

class MusicScheduler:
    """
    Tracks turn count and injects music breaks at regular intervals.

    Usage:
        scheduler = MusicScheduler(break_interval=8)
        # After each turn:
        if scheduler.should_inject():
            music_break = scheduler.start_break()
            # ... wait for break to finish ...
            scheduler.end_break()
    """

    def __init__(
        self,
        break_interval: int = DEFAULT_BREAK_INTERVAL,
        break_duration: int = DEFAULT_BREAK_DURATION,
        music_stream_url: str = "",
    ) -> None:
        self._break_interval = max(1, break_interval)
        self._break_duration = break_duration
        self._music_url = music_stream_url or DEFAULT_MUSIC_STREAM_URL
        self._turn_count: int = 0
        self._break_count: int = 0
        self._in_break: bool = False

    # ── Public API ───────────────────────────────────────────────────────────

    def record_turn(self) -> None:
        """Record that a turn was processed. Call after each successful turn."""
        self._turn_count += 1
        logger.debug(
            "Turn recorded",
            extra={
                "turn_count": self._turn_count,
                "next_break_in": self._turns_until_break(),
            },
        )

    def should_inject(self) -> bool:
        """
        Check if a music break should be injected now.

        Returns True every `break_interval` turns. Does NOT inject if
        already in a break.
        """
        if self._in_break:
            return False
        if self._turn_count == 0:
            return False
        return self._turn_count % self._break_interval == 0

    def start_break(self) -> MusicBreak:
        """
        Start a music break. Returns the break metadata.

        The caller is responsible for waiting `duration_seconds` before
        calling `end_break()`.
        """
        self._break_count += 1
        self._in_break = True

        music_break = MusicBreak(
            break_number=self._break_count,
            duration_seconds=self._break_duration,
            source=self._music_url,
        )

        logger.info(
            "Music break started",
            extra={
                "break": self._break_count,
                "duration": self._break_duration,
                "source": self._music_url[:60],
            },
        )
        return music_break

    def end_break(self) -> None:
        """Signal that the current music break has ended."""
        self._in_break = False
        logger.info(
            "Music break ended",
            extra={"break": self._break_count, "turn_count": self._turn_count},
        )

    def build_event_payload(self, music_break: MusicBreak) -> dict:
        """
        Build the MUSIC_BREAK event payload for room event emission.

        Returns:
            Dict suitable for POST /api/v1/rooms/:id/events
        """
        return {
            "breakNumber": music_break.break_number,
            "durationSeconds": music_break.duration_seconds,
            "streamUrl": music_break.source,
            "turnCount": self._turn_count,
        }

    @property
    def break_interval(self) -> int:
        """Number of turns between music breaks."""
        return self._break_interval

    @property
    def turn_count(self) -> int:
        """Current turn count."""
        return self._turn_count

    @property
    def break_count(self) -> int:
        """Total breaks injected so far."""
        return self._break_count

    @property
    def is_in_break(self) -> bool:
        """Whether currently in a music break."""
        return self._in_break

    # ── Internals ────────────────────────────────────────────────────────────

    def _turns_until_break(self) -> int:
        """Calculate how many turns until the next break."""
        if self._turn_count == 0:
            return self._break_interval
        remaining = self._break_interval - (self._turn_count % self._break_interval)
        return remaining if remaining != self._break_interval else 0
