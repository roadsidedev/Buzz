#!/usr/bin/env python3
"""
special_events.py
Special programming event triggers — breaking news, crypto surges,
big game detection, high audience, tipping surges.

Inspired by buzz-radio's special programming events architecture.

Architecture placement: scripts/radio-runner/
Used by: radio_runner.py
"""

import logging
import time
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class SpecialEvent:
    event_type: str  # BREAKING_NEWS | CRYPTO_SURGE | BIG_GAME | HIGH_AUDIENCE | TIPPING_SURGE
    payload: dict
    timestamp: float = field(default_factory=time.time)
    handled: bool = False


class SpecialEventDetector:
    """
    Detects special programming events from data feeds.
    Each detector method returns an event or None.
    """

    def check_crypto_surge(self, crypto_data: dict) -> Optional[SpecialEvent]:
        """Detect >10% move in major crypto assets."""
        for coin, data in crypto_data.items():
            if isinstance(data, dict):
                change = abs(data.get("change_24h", 0))
                if change > 10:
                    return SpecialEvent(
                        event_type="CRYPTO_SURGE",
                        payload={
                            "coin": coin,
                            "change_24h": data.get("change_24h", 0),
                            "price": data.get("usd", 0),
                            "direction": "up" if data.get("change_24h", 0) > 0 else "down",
                        },
                    )
        return None

    def check_big_game(self, scores_data: dict) -> Optional[list[SpecialEvent]]:
        """Detect live major sporting events in progress."""
        events = []
        for league, games in scores_data.items():
            if isinstance(games, list):
                for game in games:
                    if isinstance(game, dict) and game.get("status") == "in_progress":
                        events.append(SpecialEvent(
                            event_type="BIG_GAME",
                            payload={
                                "league": league,
                                "home": game.get("home", ""),
                                "away": game.get("away", ""),
                                "home_score": game.get("home_score", 0),
                                "away_score": game.get("away_score", 0),
                            },
                        ))
        return events if events else None

    def check_high_audience(self, participant_count: int) -> Optional[SpecialEvent]:
        """Detect when audience exceeds threshold."""
        if participant_count > 10:
            return SpecialEvent(
                event_type="HIGH_AUDIENCE",
                payload={"participant_count": participant_count},
            )
        return None

    def check_tipping_surge(
        self, tips_last_5min: list, window_seconds: int = 300,
    ) -> Optional[SpecialEvent]:
        """Detect 3+ tips in a 5-minute window."""
        now = time.time()
        recent = [t for t in tips_last_5min if now - t.get("timestamp", 0) < window_seconds]
        if len(recent) >= 3:
            total = sum(t.get("amount", 0) for t in recent)
            return SpecialEvent(
                event_type="TIPPING_SURGE",
                payload={
                    "tip_count": len(recent),
                    "total_amount": total,
                    "names": [t.get("name", "someone") for t in recent[:3]],
                },
            )
        return None

    def check_breaking_news(self, news_items: list) -> Optional[SpecialEvent]:
        """Detect breaking news items in the feed."""
        for item in news_items:
            is_breaking = False
            if hasattr(item, 'is_breaking'):
                is_breaking = item.is_breaking
            elif isinstance(item, dict):
                is_breaking = item.get("is_breaking", False)

            title = getattr(item, 'title', '') if hasattr(item, 'title') else item.get('title', '')
            title_lower = title.lower()
            if not is_breaking:
                is_breaking = any(w in title_lower for w in ["breaking", "just in", "developing"])

            if is_breaking:
                return SpecialEvent(
                    event_type="BREAKING_NEWS",
                    payload={"headline": title},
                )
        return None
