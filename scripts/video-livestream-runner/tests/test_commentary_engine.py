"""Tests for commentary_engine.py"""

from unittest.mock import MagicMock, patch

import pytest

from commentary_engine import Commentary, CommentaryEngine


@pytest.fixture
def mock_provider():
    provider = MagicMock()
    resp = MagicMock()
    resp.content = [MagicMock()]
    resp.content[0].text = "Bitcoin has crossed $100,000 for the first time. This is a historic milestone."
    provider.messages_create.return_value = resp
    return provider


class TestCommentaryEngine:
    def test_generate_v1_normal(self, mock_provider):
        engine = CommentaryEngine()
        engine._provider = mock_provider
        engine._model = "test-model"

        commentary = engine.generate(
            topic="Bitcoin hits $100K",
            context="Bitcoin price reached $100,000 today",
        )

        assert isinstance(commentary, Commentary)
        assert len(commentary.text) > 0
        assert commentary.topic == "Bitcoin hits $100K"
        assert commentary.visual_cue in ("neutral", "positive", "negative", "breaking")

    def test_generate_v1_breaking_news(self, mock_provider):
        engine = CommentaryEngine()
        engine._provider = mock_provider
        engine._model = "test-model"

        commentary = engine.generate(
            topic="Market Crash",
            context="Dow drops 2000 points",
            incoming_event="Emergency Fed meeting called",
        )

        assert isinstance(commentary, Commentary)
        assert len(commentary.text) > 0

    def test_generate_v1_no_provider(self):
        engine = CommentaryEngine()
        engine._provider = None

        commentary = engine.generate(topic="Test", context="Testing")
        assert commentary.topic == "Test"
        assert commentary.visual_cue == "neutral"

    def test_generate_v1_llm_failure(self, mock_provider):
        mock_provider.messages_create.side_effect = Exception("API error")
        engine = CommentaryEngine()
        engine._provider = mock_provider
        engine._model = "test-model"

        commentary = engine.generate(topic="Test", context="Testing")
        assert "Buzz News" in commentary.text
        assert commentary.topic == "Test"

    def test_classify_cue_neutral(self, mock_provider):
        from commentary_engine import _classify_cue

        mock_provider.messages_create.return_value.content[0].text = "neutral"
        cue = _classify_cue(mock_provider, "test-model", "This is a normal report")
        assert cue == "neutral"

    def test_classify_cue_breaking(self, mock_provider):
        from commentary_engine import _classify_cue

        mock_provider.messages_create.return_value.content[0].text = "breaking"
        cue = _classify_cue(mock_provider, "test-model", "URGENT: Major earthquake")
        assert cue == "breaking"

    def test_classify_cue_fallback(self, mock_provider):
        from commentary_engine import _classify_cue

        mock_provider.messages_create.side_effect = Exception("API error")
        cue = _classify_cue(mock_provider, "test-model", "Some text")
        assert cue == "neutral"

    def test_flush_memory_no_crash(self):
        engine = CommentaryEngine()
        engine._anchor = None
        engine.flush_memory()  # should not raise

    @pytest.mark.skip(reason="Requires RadioAgent with skill files on disk")
    def test_generate_v2(self):
        pass
