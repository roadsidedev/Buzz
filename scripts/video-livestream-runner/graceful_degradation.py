#!/usr/bin/env python3
"""
graceful_degradation.py
Graceful degradation system for the video livestream.

Ensures the broadcast never visibly breaks when external services fail.
Every API failure is handled in-character with broadcast-appropriate fallbacks.
Inspired by Buzz TV's graceful degradation patterns in PIPELINE.md.

Architecture placement: scripts/video-livestream-runner/
Used by: video_runner.py
"""

import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional

logger = logging.getLogger(__name__)


@dataclass
class DegradationStatus:
    news_stale: bool = False
    crypto_stale: bool = False
    sports_stale: bool = False
    social_stale: bool = False
    tts_disabled: bool = False
    news_last_good: float = 0.0
    crypto_last_good: float = 0.0
    sports_last_good: float = 0.0
    social_last_good: float = 0.0
    all_sources_stale_since: float = 0.0


FALLBACK_TOPICS = [
    "The latest developments in artificial intelligence and machine learning",
    "Breaking technology news and industry analysis",
    "Market trends and economic indicators",
    "The future of autonomous AI agents and their impact",
    "Innovation in cloud computing and infrastructure",
    "Cybersecurity threats and digital privacy updates",
    "The intersection of AI, crypto, and decentralized technology",
]

FALLBACK_COMMENTARIES = [
    "We're following this developing story and will bring you updates as they come in.",
    "Our team is gathering more information on this — stay with us.",
    "This is a story we've been tracking. Here's what we know so far.",
    "Let's look at what this means for the broader landscape.",
    "Industry experts are weighing in on this development.",
]


class GracefulDegradation:
    """
    Graceful degradation system — the broadcast survives any API failure.

    Tracks data source health, provides in-character fallbacks,
    and manages stale data timeouts with broadcast-appropriate framing.

    Usage:
        gd = GracefulDegradation()
        gd.record_success("news")
        if gd.news_stale:
            topic, commentary = gd.get_fallback_for("news")
    """

    def __init__(self) -> None:
        self._status = DegradationStatus()
        self._stale_thresholds = {
            "news": 3600 * 4,     # 4 hours
            "crypto": 3600,       # 1 hour
            "sports": 3600 * 2,   # 2 hours
            "social": 3600,       # 1 hour
        }
        self._stale_warnings = {
            "news": "Going back to a story from earlier —",
            "crypto": "I don't have the live number but last I saw—",
            "sports": "Checking the latest scores—",
            "social": "Looking at what's trending—",
        }
        self._tts_failures: int = 0
        self._max_tts_failures: int = 3

    # ── Public API ──────────────────────────────────────────────────────────

    @property
    def news_stale(self) -> bool:
        return self._status.news_stale

    @property
    def all_stale(self) -> bool:
        return bool(self._status.all_sources_stale_since)

    def record_success(self, source: str) -> None:
        now = time.time()
        if source == "news":
            self._status.news_last_good = now
            self._status.news_stale = False
        elif source == "crypto":
            self._status.crypto_last_good = now
            self._status.crypto_stale = False
        elif source == "sports":
            self._status.sports_last_good = now
            self._status.sports_stale = False
        elif source == "social":
            self._status.social_last_good = now
            self._status.social_stale = False
        self._check_all_stale()

    def record_failure(self, source: str) -> None:
        now = time.time()
        stale_after = self._stale_thresholds.get(source, 3600)
        last_good = getattr(self._status, f"{source}_last_good", 0)

        if last_good > 0 and (now - last_good) > stale_after:
            setattr(self._status, f"{source}_stale", True)
            logger.warning("Source '%s' marked stale (%.0fs since last good)", source, now - last_good)

        if source == "tts":
            self._tts_failures += 1
            if self._tts_failures >= self._max_tts_failures:
                self._status.tts_disabled = True
                logger.warning("TTS disabled after %d consecutive failures", self._tts_failures)

        self._check_all_stale()

    def record_tts_success(self) -> None:
        self._tts_failures = 0

    def get_fallback_topic(self) -> str:
        import random
        return random.choice(FALLBACK_TOPICS)

    def get_fallback_commentary(self) -> str:
        import random
        return random.choice(FALLBACK_COMMENTARIES)

    def get_freshness_framing(self, source: str) -> str:
        return self._stale_warnings.get(source, "")

    def get_anchor_framing(self, source: str, headline: str) -> str:
        """Generate broadcast-appropriate framing for stale data."""
        if getattr(self._status, f"{source}_stale", False):
            warning = self.get_freshness_framing(source)
            return f"{warning} {headline}"
        return headline

    def _check_all_stale(self) -> None:
        if (
            self._status.news_stale
            and self._status.crypto_stale
            and self._status.sports_stale
        ):
            if not self._status.all_sources_stale_since:
                self._status.all_sources_stale_since = time.time()
                logger.warning("ALL data sources stale — activating editorial fill mode")

    def reset(self) -> None:
        self._status = DegradationStatus()
        self._tts_failures = 0
        logger.info("GracefulDegradation reset")
