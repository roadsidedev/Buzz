"""FastAPI routes for orchestrator service."""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..models.room import Room
from ..models.message import Message
from ..services.orchestration_service import OrchestrationService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["orchestration"])

# Initialize service (TODO: use dependency injection)
orchestration_service = OrchestrationService()


# Request/Response Models


class CreateRoomRequest(BaseModel):
    """Request to create and initialize a room."""

    room: Room


class SubmitMessageRequest(BaseModel):
    """Request to submit a message for scoring."""

    message: Message


class ProcessTurnRequest(BaseModel):
    """Request to process a turn."""

    room_id: str


class ProcessTurnResponse(BaseModel):
    """Turn processing result."""

    status: str
    turn_number: Optional[int] = None
    selected_message_id: Optional[str] = None
    selected_agent_id: Optional[str] = None
    score: Optional[float] = None
    completion_level: Optional[str] = None
    contract_satisfaction: Optional[float] = None


# Routes


@router.post("/rooms")
async def create_room(request: CreateRoomRequest) -> dict:
    """
    Create and initialize a room in orchestrator.

    Args:
        request: Room creation request

    Returns:
        Room state initialized
    """
    try:
        room_state = await orchestration_service.create_room(request.room)
        return {
            "status": "success",
            "room_id": room_state.room.id,
            "message": "Room created",
        }
    except Exception as e:
        logger.error("Room creation failed", extra={"error": str(e)})
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/rooms/{room_id}/start")
async def start_room(room_id: str) -> dict:
    """
    Start a room (transition to LIVE).

    Args:
        room_id: Room UUID

    Returns:
        Updated room state
    """
    try:
        room_state = await orchestration_service.start_room(room_id)
        return {
            "status": "success",
            "room_id": room_state.room.id,
            "room_status": room_state.room.status.value,
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/rooms/{room_id}/close")
async def close_room(room_id: str, reason: str = "user_request") -> dict:
    """
    Close a room.

    Args:
        room_id: Room UUID
        reason: Closure reason

    Returns:
        Final room state
    """
    try:
        room_state = await orchestration_service.close_room(room_id, reason)
        return {
            "status": "success",
            "room_id": room_state.room.id,
            "room_status": room_state.room.status.value,
            "completion_level": room_state.room.completion_level.value,
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/rooms/{room_id}/state")
async def get_room_state(room_id: str) -> dict:
    """
    Get current room state.

    Args:
        room_id: Room UUID

    Returns:
        Room state snapshot
    """
    try:
        room_state = await orchestration_service.get_room_state(room_id)
        return {
            "status": "success",
            "room_id": room_state.room.id,
            "room_status": room_state.room.status.value,
            "turn_count": room_state.room.turn_count,
            "queue_size": len(room_state.message_queue),
            "contract_satisfaction": room_state.contract_satisfaction,
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/rooms/{room_id}/messages")
async def submit_message(room_id: str, request: SubmitMessageRequest) -> dict:
    """
    Submit a message for scoring.

    Args:
        room_id: Room UUID
        request: Message submission

    Returns:
        Queue confirmation
    """
    try:
        await orchestration_service.submit_message(request.message, room_id)
        room_state = await orchestration_service.get_room_state(room_id)
        return {
            "status": "success",
            "message_id": request.message.id,
            "queue_position": len(room_state.message_queue),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/rooms/{room_id}/process-turn")
async def process_turn(room_id: str) -> ProcessTurnResponse:
    """
    Process a turn: score, select, and prepare broadcast.

    Args:
        room_id: Room UUID

    Returns:
        Turn result with selected message and score
    """
    try:
        result = await orchestration_service.process_turn(room_id)
        return ProcessTurnResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error("Turn processing error", extra={"room_id": room_id, "error": str(e)})
        raise HTTPException(status_code=500, detail="Turn processing failed")


# Health and status


@router.get("/health")
async def health_check() -> dict:
    """Health check endpoint."""
    return {"status": "healthy", "service": "orchestrator"}


@router.get("/version")
async def version() -> dict:
    """Get service version."""
    from ..config.settings import settings

    return {
        "service": settings.SERVICE_NAME,
        "version": settings.SERVICE_VERSION,
        "environment": settings.ENVIRONMENT,
    }
