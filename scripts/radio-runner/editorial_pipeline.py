#!/usr/bin/env python3
"""
editorial_pipeline.py
News ingestion, filtering, editorial transformation, and scoring pipeline.

Implements a producer layer between raw news data and on-air content.
Raw data never reaches the LLM prompt verbatim — everything is transformed
into broadcast-ready "radio copy."

Inspired by buzz-radio's editorial pipeline architecture.

Architecture placement: scripts/radio-runner/
Depends on: news_poller (for Headline data model)
Used by: radio_runner.py, dialogue_engine.py
"""

import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════
# DATA MODELS
# ═══════════════════════════════════════════════════════════════════

@dataclass
class TransformedItem:
    """A transformed, broadcast-ready news item."""
    headline: str
    radio_copy: str              # How a host would say it on air
    energy: str                  # shocking|funny|important|heavy|fun|wild
    talking_points: list[str] = field(default_factory=list)
    impact: str = "medium"       # high|medium|low
    freshness: float = 0.5       # 0.0-1.0
    freshness_framing: str = ""  # e.g. "this came in earlier—"
    topic_tags: list[str] = field(default_factory=list)
    is_breaking: bool = False
    source_url: str = ""
    aired: bool = False
    air_time: Optional[float] = None


@dataclass
class EditorialContext:
    """Unified data structure passed into every segment prompt."""
    news: list[TransformedItem] = field(default_factory=list)
    crypto: dict = field(default_factory=dict)
    scores: dict = field(default_factory=dict)
    weather: dict = field(default_factory=dict)
    social_pulse: list[str] = field(default_factory=list)
    block: str = "midday"
    hour: int = 0
    day_of_week: str = ""
    participant_count: int = 0
    known_participants: dict = field(default_factory=dict)
    pending_joins: list = field(default_factory=list)
    pending_tips: list = field(default_factory=list)
    pending_questions: list = field(default_factory=list)
    session_callbacks: list = field(default_factory=list)
    used_stories: set = field(default_factory=set)
    last_segment: str = ""
    segment_history: list = field(default_factory=list)
    last_updated: dict = field(default_factory=dict)


# ═══════════════════════════════════════════════════════════════════
# FRESHNESS SCORING
# ═══════════════════════════════════════════════════════════════════

FRESHNESS_FRAMING = {
    1.0: "",
    0.9: "",
    0.7: "",
    0.5: "this came in earlier—",
    0.3: "this was a couple hours ago but—",
    0.1: "we're going back in the archives here—",
}


def calculate_freshness(published_at: Optional[datetime]) -> tuple[float, str]:
    """Calculate freshness score and framing for a news item."""
    if not published_at:
        return 0.3, "this was a couple hours ago but—"

    age_minutes = (datetime.now(timezone.utc) - published_at).total_seconds() / 60.0

    if age_minutes < 30:
        score = 1.0
    elif age_minutes < 60:
        score = 0.9
    elif age_minutes < 120:
        score = 0.7
    elif age_minutes < 240:
        score = 0.5
    elif age_minutes < 480:
        score = 0.3
    else:
        score = 0.1

    framing = FRESHNESS_FRAMING.get(score, "")
    return score, framing


# ═══════════════════════════════════════════════════════════════════
# EDITORIAL TRANSFORM
# ═══════════════════════════════════════════════════════════════════

ENERGY_TAGS = ["shocking", "funny", "important", "heavy", "fun", "wild"]


def transform_to_radio_copy(
    raw_title: str,
    raw_description: str = "",
    source: str = "",
    published_at: Optional[datetime] = None,
) -> TransformedItem:
    """
    Transform raw news data into broadcast-ready radio copy.
    This is the core editorial function — raw data never hits the prompt verbatim.

    The radio_copy field is what the LLM receives instead of raw API output.
    """
    freshness, framing = calculate_freshness(published_at)

    # Classify energy based on keywords in the title/description
    title_lower = (raw_title + " " + raw_description).lower()
    energy = "important"  # default
    if any(w in title_lower for w in ["breaking", "just in", "developing", "confirmed"]):
        energy = "shocking"
    elif any(w in title_lower for w in ["surprising", "stunning", "dramatic", "explosive"]):
        energy = "wild"
    elif any(w in title_lower for w in ["tragic", "deadly", "fatal", "crisis", "war"]):
        energy = "heavy"
    elif any(w in title_lower for w in ["funny", "hilarious", "weird", "strange", "odd"]):
        energy = "funny"

    # Generate radio copy from the raw data
    if raw_description:
        radio_copy = f"{framing}{raw_title}. {raw_description[:200]}"
    else:
        radio_copy = f"{framing}{raw_title}."

    # Extract talking points
    talking_points = []
    if raw_description:
        # Use first sentence as primary talking point
        first_sent = raw_description.split('.')[0] if '.' in raw_description else raw_description
        talking_points.append(first_sent[:100])

    # Determine impact level
    if energy in ("shocking", "heavy"):
        impact = "high"
    elif energy in ("wild", "important"):
        impact = "medium"
    else:
        impact = "low"

    return TransformedItem(
        headline=raw_title,
        radio_copy=radio_copy,
        energy=energy,
        talking_points=talking_points or ["Discuss the implications"],
        impact=impact,
        freshness=freshness,
        freshness_framing=framing,
        is_breaking=(energy == "shocking"),
        topic_tags=_extract_tags(raw_title),
    )


def _extract_tags(title: str) -> list[str]:
    """Extract simple topic tags from a headline."""
    tags = []
    title_lower = title.lower()
    topic_map = {
        "tech": ["apple", "google", "microsoft", "meta", "twitter", "ai", "tech", "software", "cyber"],
        "crypto": ["bitcoin", "crypto", "ethereum", "blockchain", "nft"],
        "sports": ["nba", "nfl", "soccer", "football", "basketball", "tennis", "sports"],
        "politics": ["president", "congress", "senate", "election", "vote", "policy", "government"],
        "science": ["science", "space", "nasa", "climate", "study", "research"],
        "health": ["health", "covid", "vaccine", "medical", "hospital"],
        "entertainment": ["movie", "music", "film", "celebrity", "hollywood", "entertainment"],
        "business": ["market", "stock", "economy", "trade", "bank", "finance"],
    }
    for category, keywords in topic_map.items():
        if any(kw in title_lower for kw in keywords):
            tags.append(category)
    return tags


def transform_crypto_data(raw: dict) -> dict:
    """Transform raw crypto data into broadcast-ready format."""
    result = {}
    for coin, data in raw.items():
        if isinstance(data, dict):
            price = data.get("usd", 0)
            change = data.get("usd_24h_change", 0)
            result[coin] = {
                "price": price,
                "change_24h": change,
                "radio_copy": f"{coin.title()} is at ${price:,.0f}, "
                              f"{'up' if change >= 0 else 'down'} {abs(change):.1f}% in the last 24 hours.",
                "is_surge": abs(change) > 10,
            }
    return result


def check_crypto_surge(crypto: dict) -> Optional[dict]:
    """Check if any major crypto asset has moved >10%."""
    for coin, data in crypto.items():
        if isinstance(data, dict) and abs(data.get("change_24h", 0)) > 10:
            return {"coin": coin, "change": data["change_24h"], "price": data.get("price", 0)}
    return None


def filter_news_items(items: list, max_items: int = 12) -> list[TransformedItem]:
    """Deduplicate and limit news items."""
    seen = set()
    filtered = []
    for item in items:
        if isinstance(item, TransformedItem):
            sig = item.headline.lower().strip()[:60]
        else:
            sig = str(getattr(item, 'title', str(item))).lower().strip()[:60]
        if sig not in seen:
            seen.add(sig)
            filtered.append(item)
        if len(filtered) >= max_items:
            break
    return filtered
