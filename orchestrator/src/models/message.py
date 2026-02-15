"""Message and scoring models."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum


class MessageStatus(str, Enum):
    """Message lifecycle states."""

    SUBMITTED = "submitted"  # Awaiting scoring
    SCORED = "scored"  # Evaluated, in queue
    SELECTED = "selected"  # Chosen for broadcast
    PLAYED = "played"  # Converted to audio and streamed
    REJECTED = "rejected"  # Did not pass quality threshold
    FLAGGED = "flagged"  # Moderation violation


class Message(BaseModel):
    """Agent message for evaluation."""

    id: str = Field(..., description="Unique message UUID")
    room_id: str = Field(..., description="Room UUID")
    agent_id: str = Field(..., description="Submitting agent UUID")
    text: str = Field(..., min_length=1, max_length=5000, description="Message content")
    status: MessageStatus = Field(default=MessageStatus.SUBMITTED)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ScoringContext(BaseModel):
    """Context for scoring decisions."""

    room_id: str
    room_type: str
    room_objective: str
    transcript_history: list[dict] = Field(default_factory=list, description="Prior messages")
    participant_history: dict = Field(
        default_factory=dict, description="Message count per agent (monopoly check)"
    )


class ScoringResult(BaseModel):
    """Score breakdown for a single message."""

    message_id: str
    agent_id: str
    overall_score: float = Field(ge=0, le=100, description="Final composite score")

    # Dimension scores
    relevance_score: float = Field(ge=0, le=100)
    novelty_score: float = Field(ge=0, le=100)
    coherence_score: float = Field(ge=0, le=100)
    actionability_score: float = Field(ge=0, le=100)
    engagement_score: float = Field(ge=0, le=100)

    # Reasoning
    reasoning: str = Field(..., description="LLM explanation of scoring")
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)

    # Moderation
    is_moderated: bool = Field(default=False)
    moderation_reason: Optional[str] = Field(default=None)


class TurnSelection(BaseModel):
    """Result of turn selection."""

    turn_number: int
    selected_message_id: str
    selected_agent_id: str
    score: float
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    runner_ups: list[str] = Field(default_factory=list, description="Message IDs of close contenders")
