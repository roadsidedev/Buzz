"""Room state and metadata models."""

from pydantic import BaseModel, Field
from typing import Optional, Union, Literal
from datetime import datetime
from enum import Enum


class RoomType(str, Enum):
    """Supported room types."""

    DEBATE = "debate"
    CODING = "coding"
    RESEARCH = "research"
    TRADING = "trading"
    SIMULATION = "simulation"
    CUSTOM = "custom"


class RoomTemplate(str, Enum):
    """Templates for custom rooms."""

    DEBATE_TEMPLATE = "debate"
    CODING_TEMPLATE = "coding"
    RESEARCH_TEMPLATE = "research"
    TRADING_TEMPLATE = "trading"
    SIMULATION_TEMPLATE = "simulation"
    BLANK = "blank"


class RoomStatus(str, Enum):
    """Room lifecycle states."""

    PENDING = "pending"  # Created, awaiting first participant
    LIVE = "live"  # Active with participants
    PAUSED = "paused"  # Temporarily halted
    COMPLETED = "completed"  # Output contract satisfied
    CANCELLED = "cancelled"  # Host terminated early


class CompletionLevel(str, Enum):
    """Output contract completion levels."""

    MINIMUM = "minimum"  # Basic requirements met
    STANDARD = "standard"  # Full contract fulfilled
    EXCEPTIONAL = "exceptional"  # Exceeded expectations


# ============================================================================
# Room Type Configuration Classes
# ============================================================================


class DebateConfig(BaseModel):
    """Configuration for debate rooms."""

    sides: int = Field(default=2, ge=2, le=5, description="Number of sides (2-5)")
    speaking_order: Literal["alternating", "free-form"] = Field(
        default="free-form", description="Speaker selection strategy"
    )
    topic: str = Field(..., description="Debate topic or resolution")


class CodingConfig(BaseModel):
    """Configuration for coding challenge rooms."""

    language: str = Field(..., description="Primary language (python, javascript, rust, etc)")
    framework: Optional[str] = Field(default=None, description="Framework (django, fastapi, etc)")
    problem_statement: str = Field(..., description="Coding problem to solve")
    test_required: bool = Field(default=True, description="Require passing tests")
    difficulty: Literal["easy", "medium", "hard"] = Field(
        default="medium", description="Problem difficulty"
    )


class ResearchConfig(BaseModel):
    """Configuration for research discussion rooms."""

    domain: str = Field(..., description="Research domain (biology, physics, economics, etc)")
    methodology: str = Field(..., description="Research approach (empirical, theoretical, mixed)")
    research_question: str = Field(..., description="Primary research question")
    citation_required: bool = Field(default=False, description="Require citations")


class TradingConfig(BaseModel):
    """Configuration for trading analysis rooms."""

    asset_class: str = Field(..., description="Asset type (stocks, crypto, forex, commodities)")
    instrument: str = Field(..., description="Specific ticker or pair (e.g., BTC/USD)")
    timeframe: str = Field(..., description="Analysis timeframe (1h, 4h, 1d, 1w)")
    risk_tolerance: Literal["conservative", "moderate", "aggressive"] = Field(
        default="moderate", description="Risk profile for recommendations"
    )
    disclaimer: str = Field(
        default="Not financial advice. Do your own research.",
        description="Risk disclaimer"
    )


class SimulationConfig(BaseModel):
    """Configuration for simulation and scenario planning rooms."""

    scenario_name: str = Field(..., description="Scenario title")
    scenario_description: str = Field(..., description="Detailed scenario setup")
    constraints: list[str] = Field(
        default_factory=list, description="Constraints or rules (e.g., 'no shortcuts')"
    )
    success_definition: str = Field(..., description="What defines success in this scenario")
    difficulty: Literal["beginner", "intermediate", "advanced"] = Field(
        default="intermediate", description="Scenario difficulty"
    )


class CustomConfig(BaseModel):
    """Configuration for custom user-defined rooms."""

    template_used: RoomTemplate = Field(default=RoomTemplate.BLANK, description="Template base")
    custom_name: str = Field(..., description="Custom room type name (e.g., 'Storytelling')")
    custom_description: str = Field(..., description="What this room type is about")
    success_criteria: str = Field(..., description="How to measure success")
    validation_rules: list[str] = Field(
        default_factory=list, description="Rules for message validation"
    )
    # Custom scoring weights (0.0-1.0, must sum to ~1.0)
    custom_scoring_weights: dict = Field(
        default_factory=lambda: {
            "relevance": 0.35,
            "novelty": 0.25,
            "coherence": 0.20,
            "actionability": 0.15,
            "engagement": 0.05,
        },
        description="Custom weights for the 5 scoring dimensions",
    )
    min_turns_required: int = Field(default=4, ge=1, description="Minimum turns to complete")
    max_turns_standard: int = Field(default=8, ge=1, description="Target turns for standard completion")
    max_turns_exceptional: int = Field(default=12, ge=1, description="Target turns for exceptional")


# Type union for all room configs
RoomTypeConfig = Union[
    DebateConfig, CodingConfig, ResearchConfig, TradingConfig, SimulationConfig, CustomConfig
]


class Room(BaseModel):
    """Room entity for orchestration."""

    id: str = Field(..., description="Unique room UUID")
    host_agent_id: str = Field(..., description="Host agent UUID")
    room_type: RoomType = Field(..., description="Room type (debate, coding, custom, etc.)")
    type_config: RoomTypeConfig = Field(..., description="Type-specific configuration")
    status: RoomStatus = Field(default=RoomStatus.PENDING, description="Current status")
    objective: str = Field(..., description="Room objective (10-500 chars)")
    spawn_fee_cents: int = Field(..., description="Spawn fee in cents")

    # Participants
    participant_ids: list[str] = Field(default_factory=list, description="All participant agent IDs")
    speaker_ids: list[str] = Field(default_factory=list, description="Current speakers")

    # Output contract
    completion_level: CompletionLevel = Field(
        default=CompletionLevel.MINIMUM, description="Current completion level"
    )
    output_artifacts: dict = Field(default_factory=dict, description="Generated outputs")

    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = Field(default=None)
    completed_at: Optional[datetime] = Field(default=None)
    turn_count: int = Field(default=0, description="Number of completed turns")
    viewer_count: int = Field(default=0, description="Current concurrent viewers")


class RoomState(BaseModel):
    """Orchestrator's in-memory state for a room."""

    room: Room
    message_queue: list[str] = Field(default_factory=list, description="Pending message IDs")
    turn_history: list[dict] = Field(default_factory=list, description="Past turn decisions")
    last_speaker_id: Optional[str] = Field(default=None, description="Agent who spoke last turn")
    transcript: list[dict] = Field(default_factory=list, description="Finalized transcript")
    contract_satisfaction: float = Field(default=0.0, ge=0, le=100, description="% contract fulfilled")
