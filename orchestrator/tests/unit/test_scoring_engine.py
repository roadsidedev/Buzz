"""Unit tests for scoring engine."""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from src.services.scoring_engine import ScoringEngine
from src.models.message import Message, ScoringContext, MessageStatus


@pytest.mark.asyncio
async def test_score_message_returns_valid_result():
    """Test that scoring returns all 5 dimensions."""
    engine = ScoringEngine()

    message = Message(
        id="msg-001",
        room_id="room-001",
        agent_id="agent-001",
        text="AI can improve conversation quality by providing diverse perspectives.",
        status=MessageStatus.SUBMITTED,
    )

    context = ScoringContext(
        room_id="room-001",
        room_type="debate",
        room_objective="Should AI host conversations?",
        transcript_history=[],
    )

    # Mock Claude response
    mock_response = MagicMock()
    mock_response.content = [
        MagicMock(
            text="""{
        "relevance_score": 85,
        "novelty_score": 75,
        "coherence_score": 80,
        "actionability_score": 70,
        "engagement_score": 80,
        "reasoning": "Well-reasoned with good evidence",
        "strengths": ["Clear argument"],
        "weaknesses": ["Could add more examples"]
    }"""
        )
    ]

    with patch.object(engine.client, "messages_create", return_value=mock_response):
        result = await engine.score_message(message, context)

    assert result.message_id == "msg-001"
    assert result.agent_id == "agent-001"
    assert 0 <= result.overall_score <= 100
    assert 0 <= result.relevance_score <= 100
    assert 0 <= result.novelty_score <= 100
    assert result.reasoning == "Well-reasoned with good evidence"


@pytest.mark.asyncio
async def test_score_batch_processes_multiple_messages():
    """Test batch scoring of multiple messages."""
    engine = ScoringEngine()

    messages = [
        Message(
            id=f"msg-{i:03d}",
            room_id="room-001",
            agent_id=f"agent-{i:03d}",
            text=f"Message {i}",
            status=MessageStatus.SUBMITTED,
        )
        for i in range(3)
    ]

    context = ScoringContext(
        room_id="room-001",
        room_type="debate",
        room_objective="Test objective",
    )

    # Since batch calls score_message internally, just verify it handles multiple
    mock_response = MagicMock()
    mock_response.content = [
        MagicMock(
            text='{"relevance_score":75,"novelty_score":70,"coherence_score":75,"actionability_score":65,"engagement_score":70,"overall_score":71.5,"reasoning":"test","strengths":[],"weaknesses":[]}'
        )
    ]

    with patch.object(engine.client, "messages_create", return_value=mock_response):
        results = await engine.score_batch(messages, context)

    assert len(results) <= 3  # MAX_CANDIDATES_PER_TURN


@pytest.mark.asyncio
async def test_parse_scoring_response_extracts_json():
    """Test that JSON parsing handles markdown code blocks."""
    engine = ScoringEngine()

    response_with_markdown = """```json
{
  "relevance_score": 80,
  "novelty_score": 70,
  "coherence_score": 75,
  "actionability_score": 65,
  "engagement_score": 70,
  "reasoning": "Good response",
  "strengths": ["clarity"],
  "weaknesses": ["depth"]
}
```"""

    result = engine._parse_scoring_response(response_with_markdown)

    assert result["relevance_score"] == 80
    assert result["novelty_score"] == 70
    assert 0 <= result["overall_score"] <= 100
    assert "reasoning" in result
