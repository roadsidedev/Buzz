#!/usr/bin/env python3
"""
dead_air_monitor.py
Silence detection and auto-recovery system for the video livestream.

Monitors the time since last completed broadcast activity. If no anchor
commentary or audio has been produced within the configured threshold,
triggers a RECOVERY state that injects emergency anchor fill and
attempts to restore normal operations — inspired by Buzz TV's dead air
monitor in RUNTIME.md.

Architecture placement: scripts/video-livestream-runner/
Used by: video_runner.py
"""

import logging
import os
import threading
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Callable, Optional

logger = logging.getLogger(__name__)

DEFAULT_SILENCE_THRESHOLD_SEC: int = int(os.environ.get("DEAD_AIR_THRESHOLD_SECONDS", "90"))
DEFAULT_RECOVERY_MAX_SEC: int = int(os.environ.get("DEAD_AIR_RECOVERY_MAX_SECONDS", "120"))


class BroadcastState(str, Enum):
    LIVE = "live"
    RECOVERY = "recovery"
    FAILED = "failed"
    SHUTDOWN = "shutdown"


@dataclass
class RecoveryAction:
    text: str
    speaker: str
    duration_sec: int


RECOVERY_SEQUENCE: list[RecoveryAction] = [
    RecoveryAction(
        speaker="Zara",
        text="We seem to have experienced a brief technical interruption. Let me bring you back up to speed.",
        duration_sec=10,
    ),
    RecoveryAction(
        speaker="Dex",
        text="That's right Zara. Systems are back online. Let's jump back into the headlines.",
        duration_sec=8,
    ),
    RecoveryAction(
        speaker="Zara",
        text="As I was saying before we were briefly disconnected — here's what you need to know right now.",
        duration_sec=10,
    ),
]


@dataclass
class DeadAirEvent:
    silence_duration_sec: float
    recovery_action: Optional[RecoveryAction] = None
    recovery_success: bool = False


class DeadAirMonitor:
    """
    Background monitor that detects broadcast silence and triggers recovery.

    Runs as a daemon thread. Tracks the timestamp of the last completed
    broadcast activity (commentary generation, audio playback, heartbeat).
    If silence exceeds the configured threshold, triggers a recovery
    callback with pre-written emergency anchor fill.

    Usage:
        monitor = DeadAirMonitor(on_recovery=my_recovery_callback)
        monitor.start()
        # ... in main loop ...
        monitor.ping()  # called after each successful turn
        # ...
        monitor.stop()
    """

    def __init__(
        self,
        silence_threshold: int = DEFAULT_SILENCE_THRESHOLD_SEC,
        recovery_max_duration: int = DEFAULT_RECOVERY_MAX_SEC,
        on_recovery: Optional[Callable[[list[RecoveryAction]], None]] = None,
        on_state_change: Optional[Callable[[BroadcastState, BroadcastState], None]] = None,
        check_interval: float = 5.0,
    ) -> None:
        self._silence_threshold = silence_threshold
        self._recovery_max_duration = recovery_max_duration
        self._on_recovery = on_recovery
        self._on_state_change = on_state_change
        self._check_interval = check_interval

        self._last_activity: float = time.time()
        self._state: BroadcastState = BroadcastState.LIVE
        self._previous_state: BroadcastState = BroadcastState.LIVE
        self._recovery_count: int = 0
        self._last_recovery_time: float = 0.0

        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._lock = threading.Lock()

    # ── Public API ────────────────────────────────────────────────────────

    @property
    def state(self) -> BroadcastState:
        with self._lock:
            return self._state

    @property
    def silence_duration(self) -> float:
        return time.time() - self._last_activity

    @property
    def recovery_count(self) -> int:
        with self._lock:
            return self._recovery_count

    @property
    def is_in_recovery(self) -> bool:
        return self._state == BroadcastState.RECOVERY

    def ping(self) -> None:
        """Call after every successful broadcast activity to reset silence timer."""
        self._last_activity = time.time()

    def start(self) -> None:
        self._stop_event.clear()
        self._thread = threading.Thread(
            target=self._monitor_loop,
            name="dead-air-monitor",
            daemon=True,
        )
        self._thread.start()
        logger.info(
            "DeadAirMonitor started — threshold: %ds, recovery max: %ds",
            self._silence_threshold, self._recovery_max_duration,
        )

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=5)
        logger.info("DeadAirMonitor stopped — total recoveries: %d", self._recovery_count)

    # ── Monitor Loop ──────────────────────────────────────────────────────

    def _monitor_loop(self) -> None:
        while not self._stop_event.is_set():
            self._stop_event.wait(self._check_interval)
            if self._stop_event.is_set():
                break

            with self._lock:
                silence = time.time() - self._last_activity

                if self._state == BroadcastState.RECOVERY:
                    recovery_elapsed = time.time() - self._last_recovery_time
                    if recovery_elapsed > self._recovery_max_duration:
                        logger.error(
                            "Recovery timed out after %.0fs — marking FAILED",
                            recovery_elapsed,
                        )
                        self._transition(BroadcastState.FAILED)
                    continue

                if self._state == BroadcastState.FAILED:
                    continue

                if silence > self._silence_threshold:
                    logger.warning(
                        "Dead air detected — %.0fs of silence (threshold: %ds)",
                        silence, self._silence_threshold,
                    )
                    self._recovery_count += 1
                    self._last_recovery_time = time.time()
                    self._transition(BroadcastState.RECOVERY)
                    recovery_actions = list(RECOVERY_SEQUENCE)

                    if self._on_recovery:
                        try:
                            self._on_recovery(recovery_actions)
                            self._transition(BroadcastState.LIVE)
                        except Exception as exc:
                            logger.error("Recovery callback failed: %s", exc)
                            self._transition(BroadcastState.FAILED)

    def _transition(self, new_state: BroadcastState) -> None:
        old = self._state
        self._state = new_state
        logger.info("Broadcast state: %s → %s", old.value, new_state.value)
        if self._on_state_change:
            try:
                self._on_state_change(old, new_state)
            except Exception as exc:
                logger.warning("State change callback failed: %s", exc)
