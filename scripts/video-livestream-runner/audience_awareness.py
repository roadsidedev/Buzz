#!/usr/bin/env python3
"""
audience_awareness.py
Viewer tracking, tip celebrations, question queue, and audience-hot mode
for the video livestream — inspired by Buzz TV's audience watcher.

Architecture placement: scripts/video-livestream-runner/
Used by: video_runner.py
"""

import logging
import os
import threading
import time
from dataclasses import dataclass, field
from typing import Callable, Optional

logger = logging.getLogger(__name__)

AUDIENCE_POLL_SEC = int(os.environ.get("AUDIENCE_POLL_SECONDS", "30"))
AUDIENCE_HOT_THRESHOLD = int(os.environ.get("AUDIENCE_HOT_THRESHOLD", "15"))
GREETING_COOLDOWN_SEC = int(os.environ.get("GREETING_COOLDOWN_SECONDS", "180"))


@dataclass
class ViewerProfile:
    viewer_id: str
    name: str
    visit_count: int = 1
    total_tips: float = 0.0
    questions_asked: int = 0
    first_seen: float = 0.0
    last_seen: float = 0.0
    is_vip: bool = False
    greeted: bool = False


@dataclass
class TipEvent:
    viewer_id: str
    viewer_name: str
    amount: float
    timestamp: float = 0.0


@dataclass
class QuestionEvent:
    viewer_id: str
    viewer_name: str
    text: str
    timestamp: float = 0.0


class AudienceManager:
    """
    Tracks viewers, processes tips and questions, manages audience-hot mode.

    Usage:
        am = AudienceManager(
            on_viewer_join=my_join_callback,
            on_tip=my_tip_callback,
            on_audience_hot=my_hot_callback,
        )
        am.start()
        ...
        am.record_viewer({"id": "abc", "name": "Bob"})
        am.record_tip({"viewer_id": "abc", "viewer_name": "Bob", "amount": 5.0})
        ...
        am.stop()
    """

    def __init__(
        self,
        on_viewer_join: Optional[Callable[[ViewerProfile], None]] = None,
        on_tip: Optional[Callable[[TipEvent], None]] = None,
        on_question: Optional[Callable[[QuestionEvent], None]] = None,
        on_audience_hot: Optional[Callable[[bool], None]] = None,
    ) -> None:
        self._on_viewer_join = on_viewer_join
        self._on_tip = on_tip
        self._on_question = on_question
        self._on_audience_hot = on_audience_hot

        self._viewers: dict[str, ViewerProfile] = {}
        self._pending_tips: list[TipEvent] = []
        self._pending_questions: list[QuestionEvent] = []
        self._viewer_count: int = 0
        self._audience_hot: bool = False
        self._last_greeting: float = 0.0

        self._lock = threading.Lock()
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None

    # ── Public API ──────────────────────────────────────────────────────────

    @property
    def viewer_count(self) -> int:
        return self._viewer_count

    @property
    def is_hot(self) -> bool:
        return self._audience_hot

    @property
    def pending_tips(self) -> list[TipEvent]:
        with self._lock:
            tips = list(self._pending_tips)
            self._pending_tips.clear()
            return tips

    @property
    def pending_questions(self) -> list[QuestionEvent]:
        with self._lock:
            qs = list(self._pending_questions)
            self._pending_questions.clear()
            return qs

    def record_viewer(self, viewer_data: dict) -> Optional[ViewerProfile]:
        vid = viewer_data.get("id")
        if not vid:
            return None
        name = viewer_data.get("name", "Anonymous")
        now = time.time()

        with self._lock:
            if vid in self._viewers:
                profile = self._viewers[vid]
                profile.visit_count += 1
                profile.last_seen = now
            else:
                profile = ViewerProfile(
                    viewer_id=vid,
                    name=name,
                    first_seen=now,
                    last_seen=now,
                )
                self._viewers[vid] = profile

            self._viewer_count = len(self._viewers)

            if not profile.greeted and (now - self._last_greeting) >= GREETING_COOLDOWN_SEC and self._on_viewer_join:
                self._last_greeting = now
                profile.greeted = True
                try:
                    self._on_viewer_join(profile)
                except Exception as exc:
                    logger.warning("Viewer join callback failed: %s", exc)

            return profile

    def record_tip(self, tip_data: dict) -> Optional[TipEvent]:
        amount = float(tip_data.get("amount", 0))
        if amount <= 0:
            return None

        now = time.time()
        event = TipEvent(
            viewer_id=tip_data.get("viewer_id", ""),
            viewer_name=tip_data.get("viewer_name", "Anonymous"),
            amount=amount,
            timestamp=now,
        )

        with self._lock:
            self._pending_tips.append(event)

            vid = event.viewer_id
            if vid in self._viewers:
                self._viewers[vid].total_tips += amount
                if self._viewers[vid].total_tips > 20:
                    self._viewers[vid].is_vip = True

        if self._on_tip:
            try:
                self._on_tip(event)
            except Exception as exc:
                logger.warning("Tip callback failed: %s", exc)

        return event

    def record_question(self, question_data: dict) -> Optional[QuestionEvent]:
        text = question_data.get("text", "").strip()
        if not text:
            return None

        event = QuestionEvent(
            viewer_id=question_data.get("viewer_id", ""),
            viewer_name=question_data.get("viewer_name", "Anonymous"),
            text=text,
        )

        with self._lock:
            self._pending_questions.append(event)
            vid = event.viewer_id
            if vid in self._viewers:
                self._viewers[vid].questions_asked += 1

        if self._on_question:
            try:
                self._on_question(event)
            except Exception as exc:
                logger.warning("Question callback failed: %s", exc)

        return event

    def start(self) -> None:
        self._stop_event.clear()
        self._thread = threading.Thread(
            target=self._monitor_loop,
            name="audience-monitor",
            daemon=True,
        )
        self._thread.start()
        logger.info("AudienceManager started — poll: %ds, hot threshold: %d", AUDIENCE_POLL_SEC, AUDIENCE_HOT_THRESHOLD)

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=5)
        logger.info("AudienceManager stopped — total viewers: %d, VIPs: %d",
                     len(self._viewers),
                     sum(1 for v in self._viewers.values() if v.is_vip))

    # ── Monitor Loop ────────────────────────────────────────────────────────

    def _monitor_loop(self) -> None:
        while not self._stop_event.is_set():
            self._stop_event.wait(AUDIENCE_POLL_SEC)
            if self._stop_event.is_set():
                break

            count = self._viewer_count

            tip_surge = False
            with self._lock:
                recent = [t for t in self._pending_tips
                          if time.time() - t.timestamp < 300]
                tip_surge = len(recent) >= 3

            was_hot = self._audience_hot
            self._audience_hot = (count > AUDIENCE_HOT_THRESHOLD) or tip_surge

            if self._audience_hot != was_hot and self._on_audience_hot:
                try:
                    self._on_audience_hot(self._audience_hot)
                    logger.info("Audience hot mode: %s (viewers: %d, tip_surge: %s)",
                                self._audience_hot, count, tip_surge)
                except Exception as exc:
                    logger.warning("Audience hot callback failed: %s", exc)
