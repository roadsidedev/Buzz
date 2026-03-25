#!/usr/bin/env python3
"""
test_dialogue_engine.py
Unit tests for the Phase 2 Agentic DialogueEngine and RadioAgent.
"""

from unittest.mock import MagicMock, patch

import pytest

from dialogue_engine import DialogueEngine, DialogueTurn
from event_listener import RadioEvent


class MockHeadline:
    """Stand-in for news_poller.Headline in tests."""
    def __init__(self, title: str, source: str = "Test", summary: str = "") -> None:
        self.title = title
        self.source = source
        self.summary = summary


class TestDialogueEngine:
    """Tests for the Phase 2 Agentic DialogueEngine."""

    @patch("dialogue_engine._resolve_provider")
    def test_generate_turn_no_headlines_returns_filler(self, mock_resolve) -> None:
        mock_provider = MagicMock()
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text="Test filler response")]
        mock_provider.messages_create.return_value = mock_response
        mock_resolve.return_value = mock_provider

        engine = DialogueEngine()
        turn = engine.generate_turn(headlines=[], history=None)
        
        assert isinstance(turn, DialogueTurn)
        assert turn.topic == "slow_news"
        assert turn.host_text == "Test filler response"
        assert turn.cohost_text == "Test filler response"

    @patch("dialogue_engine._resolve_provider")
    def test_generate_turn_with_headlines(self, mock_resolve) -> None:
        mock_provider = MagicMock()
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text="Test news response")]
        mock_provider.messages_create.return_value = mock_response
        mock_resolve.return_value = mock_provider

        engine = DialogueEngine()
        headlines = [MockHeadline("Big Event", "BBC", "Something happened")]
        turn = engine.generate_turn(headlines=headlines, history=None)
        
        assert isinstance(turn, DialogueTurn)
        assert turn.host_text == "Test news response"
        assert turn.cohost_text == "Test news response"
        assert "Big Event" in turn.topic
        assert mock_provider.messages_create.call_count == 2
        
        # Verify long-term memory topic tracking
        assert "Big Event" in engine.alex.covered_topics

    @patch("dialogue_engine._resolve_provider")
    def test_generate_turn_with_breaking_news_event(self, mock_resolve) -> None:
        """Verify that injecting a BREAKING_NEWS event triggers the interrupt logic."""
        mock_provider = MagicMock()
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text="Oh wow, breaking news!")]
        mock_provider.messages_create.return_value = mock_response
        mock_resolve.return_value = mock_provider

        engine = DialogueEngine()
        event = RadioEvent(priority=1, event_type="BREAKING_NEWS", payload={"msg": "Asteroid approaching"})
        
        turn = engine.generate_turn(headlines=[], events=[event])
        
        assert turn.topic == "BREAKING NEWS"
        assert turn.host_text == "Oh wow, breaking news!"
        
        # Verify the agent loaded the proper breaking news skill
        assert "BREAKING NEWS INTERRUPTION" in engine.alex.active_skill_prompt
        # Memory should have the event
        assert any("SYSTEM ALERT" in item.content for item in engine.alex.short_term_memory)
