"""Core orchestration engine coordinating all systems."""

import logging
from datetime import datetime
from typing import Optional

from ..clients.api_gateway_client import get_api_gateway_client
from ..config.settings import settings
from ..models.message import Message, ScoringContext, MessageStatus
from ..models.room import Room, RoomState, RoomStatus
from .scoring_engine import ScoringEngine
from .moderation_agent import ModerationAgent
from .turn_management import TurnManager
from .output_contracts import ContractValidator
from .room_state_manager import get_room_state_manager

logger = logging.getLogger(__name__)


class OrchestrationService:
    """
    Core brain of ClawZz.

    Responsibilities:
    - Manage room state
    - Solicit messages from participants
    - Score and rank candidates
    - Apply moderation
    - Select turn winners
    - Track contract fulfillment
    - Generate outputs
    """

    def __init__(self):
        """Initialize all sub-services."""
        self.scoring_engine = ScoringEngine()
        self.moderation_agent = ModerationAgent()
        self.turn_manager = TurnManager()
        self.contract_validator = ContractValidator()
        self.api_gateway = get_api_gateway_client()
        self.room_state_manager = None  # Initialized async in startup

    async def initialize(self) -> None:
        """Initialize Redis-backed room state manager (call on startup)."""
        self.room_state_manager = await get_room_state_manager()
        logger.info("OrchestrationService initialized with Redis state manager")

    # Room Lifecycle

    async def create_room(self, room: Room) -> RoomState:
        """
        Create and initialize a room.

        Args:
            room: Room entity from API

        Returns:
            RoomState ready for participation
        """
        if not self.room_state_manager:
            raise RuntimeError("OrchestrationService not initialized")

        room_state = RoomState(room=room)
        await self.room_state_manager.create_room(room_state)

        logger.info(
            "Room created in orchestrator (persisted to Redis)",
            extra={
                "room_id": room.id,
                "room_type": room.room_type.value,
                "host": room.host_agent_id,
            },
        )

        return room_state

    async def start_room(self, room_id: str) -> RoomState:
        """
        Start a room (first participant joined).

        Args:
            room_id: Room UUID

        Returns:
            Updated room state
        """
        if not self.room_state_manager:
            raise RuntimeError("OrchestrationService not initialized")

        room_state = await self.room_state_manager.get_room(room_id)
        if not room_state:
            raise ValueError(f"Room {room_id} not found")

        room_state.room.status = RoomStatus.LIVE
        room_state.room.started_at = datetime.utcnow()

        # Persist updated state
        await self.room_state_manager.update_room(room_state)

        logger.info(
            "Room started",
            extra={"room_id": room_id, "started_at": room_state.room.started_at},
        )

        return room_state

    async def close_room(self, room_id: str, reason: str = "contract_satisfied") -> RoomState:
        """
        Close a room.

        Args:
            room_id: Room UUID
            reason: Closure reason

        Returns:
            Final room state
        """
        if not self.room_state_manager:
            raise RuntimeError("OrchestrationService not initialized")

        room_state = await self.room_state_manager.get_room(room_id)
        if not room_state:
            raise ValueError(f"Room {room_id} not found")

        room_state.room.status = RoomStatus.COMPLETED
        room_state.room.completed_at = datetime.utcnow()

        # Generate final artifacts
        artifacts = self.contract_validator.generate_artifacts(room_state)
        room_state.room.output_artifacts = artifacts

        # Persist final state
        await self.room_state_manager.update_room(room_state)

        # Delete from Redis after persistence (optional - could keep for archive)
        # await self.room_state_manager.delete_room(room_id)

        logger.info(
            "Room closed (persisted to Redis)",
            extra={
                "room_id": room_id,
                "reason": reason,
                "turn_count": room_state.room.turn_count,
                "completion_level": room_state.room.completion_level.value,
            },
        )

        return room_state

    # Message Processing

    async def submit_message(self, message: Message, room_id: str) -> None:
        """
        Accept a message from an agent.

        Args:
            message: Submitted message
            room_id: Target room

        Raises:
            ValueError: If room not found or queue full
        """
        if not self.room_state_manager:
            raise RuntimeError("OrchestrationService not initialized")

        room_state = await self.room_state_manager.get_room(room_id)
        if not room_state:
            raise ValueError(f"Room {room_id} not found")

        if len(room_state.message_queue) >= settings.MESSAGE_QUEUE_MAX_SIZE:
            raise ValueError("Message queue full")

        room_state.message_queue.append(message.id)

        # Store message in Redis
        await self.room_state_manager.store_message(
            room_id, 
            message.id, 
            {
                "id": message.id,
                "agent_id": message.agent_id,
                "content": message.content,
                "status": message.status.value if hasattr(message.status, 'value') else str(message.status),
                "created_at": datetime.utcnow().isoformat(),
            }
        )

        # Persist updated room state
        await self.room_state_manager.update_room(room_state)

        logger.info(
            "Message submitted",
            extra={
                "message_id": message.id,
                "room_id": room_id,
                "queue_size": len(room_state.message_queue),
            },
        )

    async def process_turn(self, room_id: str) -> dict:
        """
        Execute a complete turn: score, select, broadcast.

        Strategy:
        1. Get pending messages from queue
        2. Score each against context
        3. Apply moderation
        4. Select winner
        5. Emit turn event
        6. Check contract completion
        7. Return turn metadata

        Args:
            room_id: Room UUID

        Returns:
            Dict with turn result (selected_message, score, reasoning, etc.)
        """
        if not self.room_state_manager:
            raise RuntimeError("OrchestrationService not initialized")

        room_state = await self.room_state_manager.get_room(room_id)
        if not room_state:
            raise ValueError(f"Room {room_id} not found")

        # Step 1: Fetch pending messages from Phase 1 API Gateway
        message_ids = room_state.message_queue[: settings.MAX_CANDIDATES_PER_TURN]
        if not message_ids:
            logger.warning("No messages to process", extra={"room_id": room_id})
            return {"status": "no_messages", "turn_number": room_state.room.turn_count}

        try:
            messages = await self.api_gateway.get_messages_batch(message_ids)
        except Exception as e:
            logger.error(
                "Failed to fetch messages from API Gateway",
                extra={"room_id": room_id, "error": str(e)},
            )
            return {"status": "fetch_failed", "error": str(e)}

        if not messages:
            logger.warning("No messages fetched from API Gateway", extra={"room_id": room_id})
            return {"status": "no_valid_messages", "turn_number": room_state.room.turn_count}

        # Step 2: Build scoring context
        context = ScoringContext(
            room_id=room_id,
            room_type=room_state.room.room_type.value,
            room_objective=room_state.room.objective,
            transcript_history=room_state.transcript,
            participant_history=self.turn_manager._count_participation(room_state),
        )

        # Step 3 & 4: Score candidates and apply moderation
        scores = []
        for message in messages:
            # Score message
            score = await self.scoring_engine.score_message(message, context)

            # Apply moderation
            score = await self.moderation_agent.update_scoring_for_violations(score, message)

            scores.append(score)

            # Update message status in Phase 1 API Gateway
            if score.is_moderated:
                await self.api_gateway.update_message_status(message.id, MessageStatus.FLAGGED)
            else:
                await self.api_gateway.update_message_status(message.id, MessageStatus.SCORED)

        # Step 5: Select winner
        try:
            turn_selection = self.turn_manager.select_next_speaker(room_state, scores)
        except ValueError as e:
            logger.error("Turn selection failed", extra={"room_id": room_id, "error": str(e)})
            return {"status": "selection_failed", "error": str(e)}

        # Step 6: Update room state
        room_state.room.turn_count += 1
        room_state.last_speaker_id = turn_selection.selected_agent_id
        room_state.message_queue = room_state.message_queue[settings.MAX_CANDIDATES_PER_TURN :]

        # Mark selected message as SELECTED in Phase 1 API Gateway
        await self.api_gateway.update_message_status(
            turn_selection.selected_message_id, MessageStatus.SELECTED
        )

        # Add to transcript
        room_state.transcript.append(
            {
                "turn": turn_selection.turn_number,
                "agent_id": turn_selection.selected_agent_id,
                "message_id": turn_selection.selected_message_id,
                "score": turn_selection.score,
                "timestamp": turn_selection.timestamp.isoformat(),
            }
        )

        # Step 7: Check contract completion
        level, satisfaction, unfulfilled = self.contract_validator.evaluate_completion(
            room_state, ""
        )
        room_state.room.completion_level = level
        room_state.contract_satisfaction = satisfaction

        # Persist updated state to Redis
        await self.room_state_manager.update_room(room_state)

        should_close = self.contract_validator.should_close_room(room_state)

        if should_close:
            await self.close_room(room_id, reason="contract_satisfied")

        logger.info(
            "Turn processed",
            extra={
                "room_id": room_id,
                "turn": turn_selection.turn_number,
                "selected_agent": turn_selection.selected_agent_id,
                "score": turn_selection.score,
                "contract_satisfaction": satisfaction,
            },
        )

        return {
            "status": "success",
            "turn_number": turn_selection.turn_number,
            "selected_message_id": turn_selection.selected_message_id,
            "selected_agent_id": turn_selection.selected_agent_id,
            "score": turn_selection.score,
            "completion_level": level.value,
            "contract_satisfaction": satisfaction,
        }

    async def get_room_state(self, room_id: str) -> RoomState:
        """Get current room state from Redis."""
        if not self.room_state_manager:
            raise RuntimeError("OrchestrationService not initialized")

        room_state = await self.room_state_manager.get_room(room_id)
        if not room_state:
            raise ValueError(f"Room {room_id} not found")
        return room_state
