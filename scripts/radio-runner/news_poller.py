#!/usr/bin/env python3
"""
news_poller.py
Poll RSS feeds and NewsAPI for fresh headlines.

Maintains a rolling buffer of deduplicated headlines. Falls back to
RSS-only mode when no NewsAPI key is provided.

Architecture placement: scripts/radio-runner/
Depends on: feedparser, httpx
Used by: radio_runner.py → DialogueEngine
"""

import hashlib
import logging
import os
import time
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Callable, Optional, Tuple

logger = logging.getLogger(__name__)

# ── Configuration ────────────────────────────────────────────────────────────

NEWSAPI_KEY: str = os.environ.get("NEWSAPI_KEY", "")
NEWSAPI_URL: str = "https://newsapi.org/v2/top-headlines"

# Default RSS sources — override via env var RSS_FEEDS (comma-separated URLs)
DEFAULT_RSS_FEEDS: list[str] = [
    "https://feeds.bbci.co.uk/news/world/rss.xml",
    "https://feeds.npr.org/1001/rss.xml",          # Reuters shut down public feeds in 2020
    "https://hnrss.org/frontpage?count=10",
    "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml",
]

# Dedup buffer — keep hashes for the last N headlines to avoid repeats
MAX_SEEN_HEADLINES: int = 500

# Maximum age (seconds) for a headline to be considered "fresh"
MAX_HEADLINE_AGE_SECONDS: int = 3600 * 6  # 6 hours


# ── Data Models ──────────────────────────────────────────────────────────────

@dataclass
class Headline:
    """A single news headline with source metadata."""

    title: str
    url: str
    source: str
    summary: str = ""
    published_at: Optional[datetime] = None
    _hash: str = field(default="", repr=False)

    def __post_init__(self) -> None:
        if not self._hash:
            raw = f"{self.title.lower().strip()}|{self.url.strip()}"
            self._hash = hashlib.sha256(raw.encode()).hexdigest()[:16]


# ── NewsPoller ───────────────────────────────────────────────────────────────

class NewsPoller:
    """
    Polls RSS feeds and NewsAPI, deduplicates, and returns fresh headlines.

    Usage:
        poller = NewsPoller()
        headlines = poller.get_latest(n=5)
    """

    def __init__(
        self,
        rss_feeds: Optional[list[str]] = None,
        newsapi_key: str = "",
        max_age_seconds: int = MAX_HEADLINE_AGE_SECONDS,
    ) -> None:
        env_feeds = os.environ.get("RSS_FEEDS", "")
        if rss_feeds:
            self._feeds = rss_feeds
        elif env_feeds:
            self._feeds = [f.strip() for f in env_feeds.split(",") if f.strip()]
        else:
            self._feeds = DEFAULT_RSS_FEEDS

        self._newsapi_key = newsapi_key or NEWSAPI_KEY
        self._max_age = max_age_seconds
        self._seen: deque[str] = deque(maxlen=MAX_SEEN_HEADLINES)
        self._buffer: list[Headline] = []
        self._last_poll: float = 0.0

    # ── Public API ───────────────────────────────────────────────────────────

    def get_latest(self, n: int = 5) -> Tuple[list, Callable[[], None]]:
        """
        Return up to `n` fresh, unseen headlines and a commit callback.

        Headlines are NOT marked seen until you call commit().  Call commit()
        only after the turn is successfully submitted so a failed turn doesn't
        permanently consume headlines.

        Usage:
            headlines, commit = poller.get_latest(n=5)
            # ... use headlines in the turn ...
            # on success:
            commit()
        """
        self._poll_all()
        fresh = [h for h in self._buffer if h._hash not in self._seen]
        selected = fresh[:n]

        def commit() -> None:
            for h in selected:
                self._seen.append(h._hash)

        logger.info(
            "Headlines selected",
            extra={"count": len(selected), "buffer_size": len(self._buffer)},
        )
        return selected, commit

    # ── Internals ────────────────────────────────────────────────────────────

    def _poll_all(self) -> None:
        """Poll all configured sources and merge into buffer."""
        headlines: list[Headline] = []

        # RSS feeds
        for feed_url in self._feeds:
            try:
                headlines.extend(self._poll_rss(feed_url))
            except Exception as exc:
                logger.warning("RSS poll failed", extra={"feed": feed_url, "error": str(exc)})

        # NewsAPI (optional)
        if self._newsapi_key:
            try:
                headlines.extend(self._poll_newsapi())
            except Exception as exc:
                logger.warning("NewsAPI poll failed", extra={"error": str(exc)})

        # Deduplicate within the batch by hash
        seen_in_batch: set[str] = set()
        unique: list[Headline] = []
        for h in headlines:
            if h._hash not in seen_in_batch:
                seen_in_batch.add(h._hash)
                unique.append(h)

        # Sort by published_at descending (freshest first), None goes to end
        unique.sort(
            key=lambda h: h.published_at.timestamp() if h.published_at else 0,
            reverse=True,
        )

        self._buffer = unique
        self._last_poll = time.monotonic()
        logger.debug("Poll complete", extra={"total_headlines": len(unique)})

    def _poll_rss(self, feed_url: str) -> list[Headline]:
        """Parse a single RSS feed and return headlines."""
        import feedparser

        feed = feedparser.parse(feed_url)
        source_name = feed.feed.get("title", feed_url)[:40]
        headlines: list[Headline] = []

        for entry in feed.entries[:15]:
            title = entry.get("title", "").strip()
            link = entry.get("link", "").strip()
            summary = entry.get("summary", "")[:200].strip()

            if not title or not link:
                continue

            # Parse published date
            published_at: Optional[datetime] = None
            published_parsed = entry.get("published_parsed")
            if published_parsed:
                try:
                    published_at = datetime(*published_parsed[:6], tzinfo=timezone.utc)
                except (TypeError, ValueError):
                    pass

            # Filter stale headlines
            if published_at:
                age = (datetime.now(timezone.utc) - published_at).total_seconds()
                if age > self._max_age:
                    continue

            headlines.append(
                Headline(
                    title=title,
                    url=link,
                    source=source_name,
                    summary=summary,
                    published_at=published_at,
                )
            )

        return headlines

    def _poll_newsapi(self) -> list[Headline]:
        """Fetch top headlines from NewsAPI."""
        import httpx

        resp = httpx.get(
            NEWSAPI_URL,
            params={
                "apiKey": self._newsapi_key,
                "language": "en",
                "pageSize": 10,
            },
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()

        headlines: list[Headline] = []
        for article in data.get("articles", []):
            title = (article.get("title") or "").strip()
            url = (article.get("url") or "").strip()
            source = (article.get("source", {}).get("name") or "NewsAPI")[:40]
            summary = (article.get("description") or "")[:200].strip()

            if not title or not url or title == "[Removed]":
                continue

            published_at: Optional[datetime] = None
            pub_str = article.get("publishedAt")
            if pub_str:
                try:
                    published_at = datetime.fromisoformat(pub_str.replace("Z", "+00:00"))
                except ValueError:
                    pass

            headlines.append(
                Headline(
                    title=title,
                    url=url,
                    source=source,
                    summary=summary,
                    published_at=published_at,
                )
            )

        return headlines
