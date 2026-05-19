#!/usr/bin/env python3
"""
stream_keeper.py
Watchdog that monitors livestream health and auto-respawns dead streams.

Runs in a background thread. Checks:
  1. Is the FFmpeg subprocess alive?
  2. Is the backend livestream status still "live"?
  3. Sends heartbeats to keep stream visible in discovery

On failure: creates a new livestream and signals the main loop.

Architecture placement: scripts/video-livestream-runner/
Depends on: livestream_bridge
Used by: video_runner.py
"""

import logging
import os
import threading
import time
from dataclasses import dataclass
from typing import Callable, Optional

logger = logging.getLogger(__name__)

DEFAULT_CHECK_INTERVAL: int = int(os.environ.get("STREAM_CHECK_INTERVAL_SECONDS", "30"))
MAX_RESPAWN_ATTEMPTS: int = int(os.environ.get("MAX_RESPAWN_ATTEMPTS", "5"))


@dataclass
class RespawnResult:
    old_stream_id: str
    new_stream_id: str
    new_rtmp_url: str
    attempt: int
    success: bool
    error: Optional[str] = None


class StreamKeeper:
    """
    Background watchdog that monitors livestream health and respawns on death.

    Usage:
        keeper = StreamKeeper(
            bridge=bridge,
            on_stream_changed=lambda old, new, rtmp: print(f"Switched {old} -> {new}"),
        )
        keeper.start(stream_id, rtmp_url, agent, title, category)
        # ... main loop runs ...
        keeper.stop()
    """

    def __init__(
        self,
        bridge,
        on_stream_changed: Optional[Callable[[str, str, str], None]] = None,
        check_interval: int = DEFAULT_CHECK_INTERVAL,
        max_attempts: int = MAX_RESPAWN_ATTEMPTS,
    ) -> None:
        self._bridge = bridge
        self._on_stream_changed = on_stream_changed
        self._check_interval = check_interval
        self._max_attempts = max_attempts

        self._stream_id: str = ""
        self._rtmp_url: str = ""
        self._agent = None
        self._title: str = "Buzz News Live"
        self._category: str = "News"

        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._respawn_count: int = 0
        self._failed: bool = False
        self._lock = threading.Lock()

    # ── Public API ───────────────────────────────────────────────────────────

    @property
    def stream_id(self) -> str:
        with self._lock:
            return self._stream_id

    @property
    def rtmp_url(self) -> str:
        with self._lock:
            return self._rtmp_url

    @property
    def respawn_count(self) -> int:
        with self._lock:
            return self._respawn_count

    @property
    def failed(self) -> bool:
        return self._failed

    def start(
        self,
        stream_id: str,
        rtmp_url: str,
        agent,
        title: str = "Buzz News Live",
        category: str = "News",
    ) -> None:
        with self._lock:
            self._stream_id = stream_id
            self._rtmp_url = rtmp_url
        self._agent = agent
        self._title = title
        self._category = category

        self._stop_event.clear()
        self._thread = threading.Thread(
            target=self._watch_loop,
            name="stream-keeper",
            daemon=True,
        )
        self._thread.start()
        logger.info(
            "StreamKeeper started",
            extra={"stream_id": stream_id[:8], "interval": self._check_interval},
        )

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=10)
        logger.info("StreamKeeper stopped")

    def update_stream(self, stream_id: str, rtmp_url: str) -> None:
        with self._lock:
            self._stream_id = stream_id
            self._rtmp_url = rtmp_url
        logger.info("StreamKeeper updated to new stream", extra={"stream_id": stream_id[:8]})

    # ── Watch Loop ───────────────────────────────────────────────────────────

    def _watch_loop(self) -> None:
        backoff: float = 1.0

        while not self._stop_event.is_set():
            self._stop_event.wait(self._check_interval)
            if self._stop_event.is_set():
                break

            current_id = self.stream_id
            if not current_id:
                continue

            try:
                status = self._bridge.get_livestream_status(current_id, self._agent)

                if status == "live":
                    backoff = 1.0
                    self._bridge.send_heartbeat(current_id, self._agent)
                    logger.debug("Stream healthy", extra={"stream_id": current_id[:8]})
                    continue

                logger.warning(
                    "Stream not live (status=%s) — initiating respawn",
                    status,
                    extra={"stream_id": current_id[:8]},
                )
                result = self._respawn(current_id)

                if result.success:
                    backoff = 1.0
                    logger.info(
                        "Stream respawned",
                        extra={"old": result.old_stream_id[:8], "new": result.new_stream_id[:8]},
                    )
                else:
                    backoff = min(backoff * 2, 60.0)
                    logger.error("Respawn failed — backing off %.1fs", backoff)
                    self._stop_event.wait(backoff)

            except Exception as exc:
                logger.error("StreamKeeper error: %s", exc)
                backoff = min(backoff * 2, 60.0)
                self._stop_event.wait(backoff)

    # ── Respawn Logic ────────────────────────────────────────────────────────

    def _respawn(self, old_stream_id: str) -> RespawnResult:
        for attempt in range(1, self._max_attempts + 1):
            try:
                stream = self._bridge.create_livestream(
                    agent=self._agent,
                    title=self._title,
                    category=self._category,
                )
                new_rtmp = self._bridge.build_rtmp_url(stream)

                with self._lock:
                    self._stream_id = stream.id
                    self._rtmp_url = new_rtmp
                    self._respawn_count += 1

                if self._on_stream_changed:
                    try:
                        self._on_stream_changed(old_stream_id, stream.id, new_rtmp)
                    except Exception as cb_exc:
                        logger.warning("on_stream_changed callback failed: %s", cb_exc)

                return RespawnResult(
                    old_stream_id=old_stream_id,
                    new_stream_id=stream.id,
                    new_rtmp_url=new_rtmp,
                    attempt=attempt,
                    success=True,
                )

            except Exception as exc:
                logger.warning("Respawn attempt %d/%d failed: %s", attempt, self._max_attempts, exc)
                if attempt < self._max_attempts:
                    time.sleep(2.0 * attempt)

        self._failed = True
        logger.critical("StreamKeeper permanently failed — all respawn attempts exhausted")
        if self._on_stream_changed:
            try:
                self._on_stream_changed(old_stream_id, "", "")
            except Exception:
                pass

        return RespawnResult(
            old_stream_id=old_stream_id,
            new_stream_id="",
            new_rtmp_url="",
            attempt=self._max_attempts,
            success=False,
            error=f"All {self._max_attempts} respawn attempts exhausted",
        )
