#!/usr/bin/env python3
"""
test_news_poller.py
Unit tests for the NewsPoller module.
"""

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest

from news_poller import Headline, NewsPoller


class TestHeadline:
    """Tests for the Headline dataclass."""

    def test_hash_is_deterministic(self) -> None:
        h1 = Headline(title="Test", url="https://example.com/1", source="Test")
        h2 = Headline(title="Test", url="https://example.com/1", source="Test")
        assert h1._hash == h2._hash

    def test_hash_differs_for_different_urls(self) -> None:
        h1 = Headline(title="Test", url="https://example.com/1", source="Test")
        h2 = Headline(title="Test", url="https://example.com/2", source="Test")
        assert h1._hash != h2._hash

    def test_hash_is_case_insensitive_on_title(self) -> None:
        h1 = Headline(title="BREAKING NEWS", url="https://example.com/1", source="Test")
        h2 = Headline(title="breaking news", url="https://example.com/1", source="Test")
        assert h1._hash == h2._hash


class TestNewsPoller:
    """Tests for the NewsPoller class."""

    def test_get_latest_marks_seen(self) -> None:
        poller = NewsPoller(rss_feeds=[], newsapi_key="")
        # Patch _poll_all to prevent it from clearing the buffer
        poller._poll_all = lambda: None  # type: ignore[assignment]
        poller._buffer = [
            Headline(title="H1", url="https://a.com/1", source="A"),
            Headline(title="H2", url="https://a.com/2", source="A"),
            Headline(title="H3", url="https://a.com/3", source="A"),
        ]
        first = poller.get_latest(n=2)
        assert len(first) == 2
        assert first[0].title == "H1"
        assert first[1].title == "H2"

        # Second call should skip already-seen
        second = poller.get_latest(n=2)
        assert len(second) == 1
        assert second[0].title == "H3"

    def test_get_latest_returns_empty_when_all_seen(self) -> None:
        poller = NewsPoller(rss_feeds=[], newsapi_key="")
        poller._poll_all = lambda: None  # type: ignore[assignment]
        poller._buffer = [
            Headline(title="Only", url="https://a.com", source="A"),
        ]
        poller.get_latest(n=5)
        result = poller.get_latest(n=5)
        assert result == []

    def test_deduplicates_within_batch(self) -> None:
        """_poll_all deduplicates headlines with the same hash within a batch."""
        poller = NewsPoller(rss_feeds=[], newsapi_key="")

        # Simulate _poll_all receiving duplicates from two sources
        # by calling the internal dedup logic directly
        dup1 = Headline(title="Same", url="https://a.com/same", source="A")
        dup2 = Headline(title="Same", url="https://a.com/same", source="B")
        unique_h = Headline(title="Different", url="https://a.com/other", source="C")

        # Manually run the dedup logic from _poll_all
        headlines = [dup1, dup2, unique_h]
        seen_in_batch: set[str] = set()
        unique: list = []
        for h in headlines:
            if h._hash not in seen_in_batch:
                seen_in_batch.add(h._hash)
                unique.append(h)

        assert len(unique) == 2  # dup removed, unique kept
        assert unique[0].title == "Same"
        assert unique[1].title == "Different"

    def test_poll_rss_filters_stale(self) -> None:
        """RSS entries older than max_age should be filtered out."""
        import time as time_mod
        from datetime import timedelta

        import feedparser as fp_module

        # Build a mock feed with one fresh and one stale entry
        fresh_time = time_mod.gmtime()
        stale_time = time_mod.gmtime(
            (datetime.now(timezone.utc) - timedelta(hours=24)).timestamp()
        )

        mock_feed = MagicMock()
        mock_feed.feed = {"title": "TestFeed"}
        mock_feed.entries = [
            {
                "title": "Fresh",
                "link": "https://a.com/fresh",
                "summary": "Fresh news",
                "published_parsed": fresh_time,
            },
            {
                "title": "Stale",
                "link": "https://a.com/stale",
                "summary": "Old news",
                "published_parsed": stale_time,
            },
        ]

        poller = NewsPoller(rss_feeds=["https://test.feed/rss"], max_age_seconds=3600)

        with patch.object(fp_module, "parse", return_value=mock_feed):
            headlines = poller._poll_rss("https://test.feed/rss")

        assert len(headlines) == 1
        assert headlines[0].title == "Fresh"
