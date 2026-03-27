"""FastAPI routes for orchestrator service."""

import logging
from typing import Dict, List, Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..models.room import Room
from ..models.message import Message
from ..services.orchestration_service import OrchestrationService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["orchestration"])

# Singleton service instance - initialized in main.py lifespan
_orchestration_service: Optional[OrchestrationService] = None


def set_orchestration_service(service: OrchestrationService) -> None:
    """Set the orchestration service singleton."""
    global _orchestration_service
    _orchestration_service = service


def get_orchestration_service() -> OrchestrationService:
    """Get the orchestration service singleton."""
    global _orchestration_service
    logger.info(f"get_orchestration_service called, _orchestration_service is: {_orchestration_service}")
    if _orchestration_service is None:
        logger.error("OrchestrationService singleton is None!")
        raise RuntimeError(
            "OrchestrationService not initialized. "
            "Ensure the orchestrator started successfully and the lifespan handler ran."
        )
    logger.info(f"Returning orchestration service with room_state_manager: {_orchestration_service.room_state_manager}")
    return _orchestration_service


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
        service = get_orchestration_service()
        room_state = await service.create_room(request.room)
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
        service = get_orchestration_service()
        room_state = await service.start_room(room_id)
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
        service = get_orchestration_service()
        room_state = await service.close_room(room_id, reason)
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
        logger.info(f"get_room_state called for room {room_id}")
        service = get_orchestration_service()
        logger.info(f"Got orchestration service: {service}, room_state_manager: {service.room_state_manager}")
        room_state = await service.get_room_state(room_id)
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
        service = get_orchestration_service()
        await service.submit_message(request.message, room_id)
        room_state = await service.get_room_state(room_id)
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
        service = get_orchestration_service()
        result = await service.process_turn(room_id)
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


@router.get("/debug/llm")
async def debug_llm() -> dict:
    """Diagnose LLM provider configuration and connectivity."""
    from ..config.settings import settings
    from ..services.llm_provider import get_provider, _detect_provider_from_env

    info: dict = {
        "LLM_PROVIDER_setting": settings.LLM_PROVIDER,
        "LLM_API_KEY_set": bool(settings.LLM_API_KEY),
        "SCORING_MODEL": settings.SCORING_MODEL,
    }

    detected_name, detected_key = _detect_provider_from_env()
    info["auto_detected_provider"] = detected_name
    info["auto_detected_key_set"] = bool(detected_key)

    try:
        provider = get_provider()
        info["provider_loaded"] = type(provider).__name__
        # Quick test call
        response = provider.messages_create(
            model=settings.SCORING_MODEL,
            max_tokens=20,
            messages=[{"role": "user", "content": "Say hello in 3 words."}],
        )
        if hasattr(response, "content") and response.content:
            info["test_response"] = response.content[0].text.strip()
        else:
            info["test_response"] = str(response)
        info["status"] = "ok"
    except Exception as e:
        info["status"] = "error"
        info["error"] = str(e)

    return info


@router.get("/version")
async def version() -> dict:
    """Get service version."""
    from ..config.settings import settings

    return {
        "service": settings.SERVICE_NAME,
        "version": settings.SERVICE_VERSION,
        "environment": settings.ENVIRONMENT,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Content-generation routes
# ─────────────────────────────────────────────────────────────────────────────

# DEPRECATED — podcast generation extracted to standalone product.
# These models and routes are preserved for reference only.
#
# class VoicePreferences(BaseModel):
#     primary_voice_id: Optional[str] = None
#     secondary_voice_id: Optional[str] = None
#
# class GeneratePodcastRequest(BaseModel):
#     podcast_id: str
#     episode_id: str
#     title: str
#     source_urls: List[str] = []
#     voice_preferences: Optional[VoicePreferences] = None
#     format: Literal["monologue", "dialogue"] = "monologue"
#
# class GeneratePodcastResponse(BaseModel):
#     episode_id: str
#     status: str
#     script: str
#     estimated_duration_seconds: int
#     estimated_cost_usdc: float
#     estimated_time_seconds: int
#
# @router.post("/podcasts/generate", response_model=GeneratePodcastResponse)
# async def generate_podcast_episode(request: GeneratePodcastRequest) -> GeneratePodcastResponse:
#     """DEPRECATED — podcast generation extracted to standalone product."""
#     raise HTTPException(status_code=410, detail="Podcast generation has moved to a standalone product.")
#
# @router.get("/podcasts/{episode_id}/status")
# async def get_podcast_episode_status(episode_id: str) -> dict:
#     """DEPRECATED — podcast generation extracted to standalone product."""
#     raise HTTPException(status_code=410, detail="Podcast generation has moved to a standalone product.")


class SummaryRequest(BaseModel):
    transcript: str


class SummaryResponse(BaseModel):
    summary: str


@router.post("/transcript/summary", response_model=SummaryResponse)
async def generate_summary(request: SummaryRequest) -> SummaryResponse:
    """
    Generate a concise summary of a room transcript using the LLM.

    Accepts up to 5 000 characters of transcript and returns a 3-5 sentence
    summary suitable for room completion cards and social sharing.
    """
    if not request.transcript or not request.transcript.strip():
        raise HTTPException(status_code=400, detail="transcript is required")
    try:
        service = get_orchestration_service()
        summary = await service.generate_summary(request.transcript)
        return SummaryResponse(summary=summary)
    except Exception as e:
        logger.error("Summary generation failed", extra={"error": str(e)})
        raise HTTPException(status_code=500, detail=f"Summary generation failed: {str(e)}")
