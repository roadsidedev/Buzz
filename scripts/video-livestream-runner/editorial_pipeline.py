#!/usr/bin/env python3
"""
editorial_pipeline.py
News Researcher and Producer editorial scoring pipeline.

Two-stage system inspired by Buzz TV's PIPELINE.md:
Stage 1 (News Researcher): Transforms raw data into broadcast-ready copy
Stage 2 (Producer): Scores every story on 5 factors before it can air

No story reaches the anchors without Producer approval.
Raw data never touches the broadcast.

Architecture placement: scripts/video-livestream-runner/
Used by: video_runner.py
"""

import json
import logging
import os
import random
import time
from dataclasses import dataclass, field
from typing import Any, Optional

logger = logging.getLogger(__name__)


@dataclass
class EditorialStory:
    story_id: str
    headline: str
    anchor_copy: str
    source: str
    category: str = "technology"
    visual_suggestion: str = "none"
    visual_detail: str = ""
    talking_points: list[str] = field(default_factory=list)
    energy: str = "neutral"
    is_breaking: bool = False
    deep_dive_worthy: bool = False
    freshness_hours: float = 0.0
    score: float = 0.0

    def __hash__(self) -> int:
        return hash(self.story_id)


SCORING_WEIGHTS = {
    "recency": 0.25,
    "virality": 0.20,
    "novelty": 0.20,
    "audience_fit": 0.20,
    "emotional_charge": 0.15,
}

ENERGY_SCORES = {
    "shocking": 15, "wild": 14, "heavy": 12,
    "important": 10, "fun": 8, "light": 5, "neutral": 7,
}

HIGH_FIT_CATEGORIES = [
    "technology", "crypto", "finance", "sports", "culture", "ai",
]


class NewsResearcher:
    """
    Stage 1: Transforms raw news data into broadcast-ready anchor copy.

    Takes raw RSS/API data and produces EditorialStory objects with
    anchor-ready copy, visual suggestions, and editorial metadata.
    """

    def __init__(self) -> None:
        self._seen_hashes: set[str] = set()

    def transform(self, raw_entries: list[dict]) -> list[EditorialStory]:
        stories = []
        for entry in raw_entries:
            title = entry.get("title", "")
            summary = (entry.get("summary", "") or "")[:300]
            source = entry.get("source", "News Feed")
            story_id = self._make_id(title, source)

            if story_id in self._seen_hashes:
                continue
            self._seen_hashes.add(story_id)

            stories.append(EditorialStory(
                story_id=story_id,
                headline=title[:80],
                anchor_copy=self._make_anchor_copy(title, summary),
                source=source,
                visual_suggestion=self._suggest_visual(title, summary),
                visual_detail=title[:60],
                talking_points=self._extract_talking_points(summary),
                energy=self._classify_energy(summary),
                freshness_hours=0.5,
                is_breaking=self._is_breaking(title, summary),
                deep_dive_worthy=self._is_deep_dive_worthy(title, summary),
            ))
        return stories

    def _make_id(self, title: str, source: str) -> str:
        import hashlib
        raw = (title.lower().strip() + "|" + source.lower()).encode()
        return hashlib.sha256(raw).hexdigest()[:16]

    def _make_anchor_copy(self, title: str, summary: str) -> str:
        return (
            f"{title.strip('.')}. "
            f"{summary[:150].strip('.')}. "
            f"Here's what you need to know."
        )

    def _suggest_visual(self, title: str, summary: str) -> str:
        lower = (title + " " + summary).lower()
        if any(w in lower for w in ["chart", "price", "market", "bitcoin", "stock", "$"]):
            return "chart"
        if any(w in lower for w in ["social", "twitter", "meme", "viral", "post"]):
            return "social_embed"
        if any(w in lower for w in ["study", "research", "report", "survey"]):
            return "topic_card"
        if any(w in lower for w in ["breaking", "developing", "just in", "urgent"]):
            return "lower_third"
        return "none"

    def _extract_talking_points(self, summary: str) -> list[str]:
        sentences = [s.strip() for s in summary.split(".") if len(s.strip()) > 15]
        return sentences[:3]

    def _classify_energy(self, summary: str) -> str:
        lower = summary.lower()
        if any(w in lower for w in ["shock", "crisis", "emergency", "crash"]):
            return "shocking"
        if any(w in lower for w in ["surge", "breakthrough", "record", "milestone"]):
            return "wild"
        if any(w in lower for w in ["crash", "collapse", "war", "disaster"]):
            return "heavy"
        if any(w in lower for w in ["announce", "launch", "release", "introduc"]):
            return "important"
        return "neutral"

    def _is_breaking(self, title: str, summary: str) -> bool:
        lower = (title + " " + summary).lower()
        return any(w in lower for w in ["breaking", "developing", "just in", "urgent"])

    def _is_deep_dive_worthy(self, title: str, summary: str) -> bool:
        lower = (title + " " + summary).lower()
        keywords = ["analysis", "explained", "why", "how", "future", "impact"]
        return any(k in lower for k in keywords)


class Producer:
    """
    Stage 2: Five-factor editorial scoring gate.

    Every story MUST pass through the Producer before it can air.
    Controls the story queue with MUST_AIR, QUEUE, HOLD, and DROP thresholds.
    """

    def __init__(self) -> None:
        self._aired_ids: set[str] = set()
        self._queue: list[EditorialStory] = []

    def score(self, story: EditorialStory, social_pulse: Optional[list[str]] = None) -> EditorialStory:
        pulse = social_pulse or []

        age = story.freshness_hours
        if age < 0.5: recency = 25
        elif age < 1: recency = 22
        elif age < 2: recency = 18
        elif age < 4: recency = 12
        elif age < 8: recency = 6
        else: recency = 0

        in_social = any(
            word.lower() in " ".join(pulse).lower()
            for word in story.headline.split()[:5]
        )
        virality = 20 if in_social else random.randint(3, 10)

        novelty = 0 if story.story_id in self._aired_ids else 20

        audience_fit = 20 if story.category.lower() in HIGH_FIT_CATEGORIES else 10

        emotional = ENERGY_SCORES.get(story.energy, 7)

        total = recency + virality + novelty + audience_fit + emotional

        if story.is_breaking:
            total = min(100, total + 20)

        story.score = round(total, 1)
        return story

    def process(self, stories: list[EditorialStory], social_pulse: Optional[list[str]] = None) -> list[EditorialStory]:
        scored = [self.score(s, social_pulse) for s in stories]
        scored.sort(key=lambda s: s.score, reverse=True)

        self._queue = []
        for s in scored:
            if s.score >= 25:
                self._queue.append(s)

        return self._queue[:10]

    def select_for_segment(self, segment_type: str, count: int = 3) -> list[EditorialStory]:
        available = [s for s in self._queue if s.score >= 50]
        selected = available[:count]

        for s in selected:
            if s.story_id not in self._aired_ids:
                self._aired_ids.add(s.story_id)
                if s in self._queue:
                    self._queue.remove(s)

        return selected

    def get_top_story(self) -> Optional[EditorialStory]:
        available = [s for s in self._queue if s.score >= 50]
        if not available:
            return None
        top = available[0]
        self._aired_ids.add(top.story_id)
        if top in self._queue:
            self._queue.remove(top)
        return top

    @property
    def queue_size(self) -> int:
        return len(self._queue)

    @property
    def aired_count(self) -> int:
        return len(self._aired_ids)


class EditorialPipeline:
    """
    Complete editorial pipeline: News Researcher → Producer.

    Usage:
        pipeline = EditorialPipeline()
        stories = pipeline.process(raw_news_entries)
        top_story = pipeline.get_top_story()
        segment_stories = pipeline.select_for_segment("headlines", 3)
    """

    def __init__(self) -> None:
        self.researcher = NewsResearcher()
        self.producer = Producer()

    def process(self, raw_entries: list[dict]) -> list[EditorialStory]:
        stories = self.researcher.transform(raw_entries)
        return self.producer.process(stories)

    def get_top_story(self) -> Optional[EditorialStory]:
        return self.producer.get_top_story()

    def select_for_segment(self, segment_type: str, count: int = 3) -> list[EditorialStory]:
        return self.producer.select_for_segment(segment_type, count)

    @property
    def queue_size(self) -> int:
        return self.producer.queue_size
