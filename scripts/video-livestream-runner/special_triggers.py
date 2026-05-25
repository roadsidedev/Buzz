#!/usr/bin/env python3
"""
special_triggers.py
Special programming trigger detection and handling for the video livestream.

Detects and manages:
  - BREAKING_NEWS: Immediate interrupt with red banner, Zara leads
  - MARKET_SURGE: ±10% asset move, extended Market Board segment
  - BIG_GAME: Major sports event in progress
  - AUDIENCE_HOT: Viewer count > 15 or tip surge
  - NIGHT_MODE: Automatic activation during night block (22:00-04:59 UTC)

Inspired by Buzz TV's special programming triggers in PROGRAMMING.md.

Architecture placement: scripts/video-livestream-runner/
Used by: video_runner.py
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)


class SpecialTrigger(str, Enum):
    BREAKING_NEWS = "breaking_news"
    MARKET_SURGE = "market_surge"
    BIG_GAME = "big_game"
    AUDIENCE_HOT = "audience_hot"
    NIGHT_MODE = "night_mode"


@dataclass
class TriggerEvent:
    trigger: SpecialTrigger
    severity: int = 5
    payload: dict = field(default_factory=dict)
    source: str = "system"


class SpecialTriggerManager:
    """
    Detects and manages special programming triggers.

    Scans data sources for trigger conditions and broadcasts events.
    Prevents duplicate processing within the same session.

    Usage:
        manager = SpecialTriggerManager(
            on_trigger=my_trigger_handler,
        )
        result = manager.check_news_for_breaking(headlines)
        result = manager.check_crypto_for_surge(prices)
        result = manager.check_sports_for_big_game(scores)
        result = manager.check_audience(count)
        result = manager.check_night_mode()
    """

    def __init__(
        self,
        on_trigger: Optional[Callable[[TriggerEvent], None]] = None,
    ) -> None:
        self._on_trigger = on_trigger
        self._active_triggers: dict[SpecialTrigger, bool] = {
            t: False for t in SpecialTrigger
        }
        self._processed: set[str] = set()

    # ── Public API ──────────────────────────────────────────────────────────

    @property
    def active(self) -> list[SpecialTrigger]:
        return [t for t, v in self._active_triggers.items() if v]

    @property
    def is_breaking(self) -> bool:
        return self._active_triggers.get(SpecialTrigger.BREAKING_NEWS, False)

    @property
    def is_night_mode(self) -> bool:
        return self._active_triggers.get(SpecialTrigger.NIGHT_MODE, False)

    @property
    def is_market_surge(self) -> bool:
        return self._active_triggers.get(SpecialTrigger.MARKET_SURGE, False)

    def is_trigger_active(self, trigger: SpecialTrigger) -> bool:
        return self._active_triggers.get(trigger, False)

    def clear_trigger(self, trigger: SpecialTrigger) -> None:
        self._active_triggers[trigger] = False
        logger.info("Trigger cleared: %s", trigger.value)

    def clear_all(self) -> None:
        for t in self._active_triggers:
            self._active_triggers[t] = False
        logger.info("All special triggers cleared")

    # ── Detection Methods ───────────────────────────────────────────────────

    def check_news_for_breaking(self, headlines: list[dict]) -> Optional[TriggerEvent]:
        for item in headlines:
            title = (item.get("title", "") or "").lower()
            if any(w in title for w in ["breaking", "developing", "just in", "urgent"]):
                event = TriggerEvent(
                    trigger=SpecialTrigger.BREAKING_NEWS,
                    severity=10,
                    payload={"headline": item.get("title", ""), "source": item.get("source", "")},
                    source="news_pipeline",
                )
                self._activate(event)
                return event
        return None

    def check_crypto_for_surge(self, prices: dict[str, dict]) -> Optional[TriggerEvent]:
        for asset, data in prices.items():
            change = abs(data.get("usd_24h_change", 0))
            if change > 10 and not self._active_triggers.get(SpecialTrigger.MARKET_SURGE, False):
                event = TriggerEvent(
                    trigger=SpecialTrigger.MARKET_SURGE,
                    severity=7,
                    payload={"asset": asset, "change": data.get("usd_24h_change", 0)},
                    source="crypto_pipeline",
                )
                self._activate(event)
                return event
        return None

    def check_sports_for_big_game(self, scores: list[dict]) -> Optional[TriggerEvent]:
        for game in scores:
            if game.get("status") == "In Progress" and game.get("is_major", False):
                event = TriggerEvent(
                    trigger=SpecialTrigger.BIG_GAME,
                    severity=6,
                    payload={"game": game.get("name", ""), "league": game.get("league", "")},
                    source="sports_pipeline",
                )
                self._activate(event)
                return event
        return None

    def check_audience(self, viewer_count: int, tip_surge: bool = False) -> Optional[TriggerEvent]:
        if (viewer_count > 15 or tip_surge) and not self._active_triggers.get(SpecialTrigger.AUDIENCE_HOT, False):
            event = TriggerEvent(
                trigger=SpecialTrigger.AUDIENCE_HOT,
                severity=5,
                payload={"viewer_count": viewer_count, "tip_surge": tip_surge},
                source="audience_monitor",
            )
            self._activate(event)
            return event
        if viewer_count < 5 and self._active_triggers.get(SpecialTrigger.AUDIENCE_HOT, False):
            self.clear_trigger(SpecialTrigger.AUDIENCE_HOT)
        return None

    def check_night_mode(self) -> Optional[TriggerEvent]:
        hour = datetime.now(timezone.utc).hour
        is_night = hour >= 22 or hour < 5
        currently_active = self._active_triggers.get(SpecialTrigger.NIGHT_MODE, False)

        if is_night and not currently_active:
            event = TriggerEvent(
                trigger=SpecialTrigger.NIGHT_MODE,
                severity=4,
                payload={"hour": hour},
                source="schedule",
            )
            self._activate(event)
            return event
        if not is_night and currently_active:
            self.clear_trigger(SpecialTrigger.NIGHT_MODE)
        return None

    # ── Internal ────────────────────────────────────────────────────────────

    def _activate(self, event: TriggerEvent) -> None:
        event_id = f"{event.trigger.value}_{event.payload.get('asset', '') or event.payload.get('headline', '')[:20]}"
        if event_id in self._processed:
            return

        self._active_triggers[event.trigger] = True
        self._processed.add(event_id)
        logger.info("Trigger activated: %s (severity: %d, source: %s)",
                     event.trigger.value, event.severity, event.source)

        if self._on_trigger:
            try:
                self._on_trigger(event)
            except Exception as exc:
                logger.error("Trigger callback failed: %s", exc)
