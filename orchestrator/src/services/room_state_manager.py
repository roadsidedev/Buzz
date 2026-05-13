"""
Room State Manager
Redis-backed persistent room state for orchestrator scalability and reliability

Replaces in-memory dict with Redis to support:
- Horizontal scaling (multiple orchestrator instances)
- Data persistence (survives crashes/restarts)
- State consistency (single source of truth)
- TTL management (auto-cleanup of stale rooms)
"""

import json
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import redis
from redis.exceptions import ConnectionError, TimeoutError as RedisTimeoutError

from ..models.room import Room, RoomState, RoomStatus
from ..config.settings import settings

logger = logging.getLogger(__name__)

# Redis key prefixes for organization
REDIS_KEY_ROOM_STATE = "room_state:"
REDIS_KEY_ROOM_INDEX = "room_index"  # Sorted set of all active rooms
REDIS_KEY_ROOM_PARTICIPANTS = "room_participants:"
REDIS_KEY_ROOM_MESSAGES = "room_messages:"
REDIS_KEY_ROOM_TURN = "room_turn:"

# Default TTL: 48 hours (room lifetime + buffer)
DEFAULT_ROOM_TTL = 48 * 60 * 60


class RoomStateManager:
    """
    Persistent room state management backed by Redis
    
    Handles:
    - Room state serialization/deserialization
    - CRUD operations with Redis
    - TTL and expiration management
    - Atomic operations for consistency
    - Graceful degradation on Redis failures
    """

    def __init__(self, redis_url: Optional[str] = None):
        """Initialize Redis connection"""
        self.redis_url = redis_url or settings.REDIS_URL or "redis://localhost:6379"
        self.client: Optional[redis.Redis] = None
        self.connected = False

    async def initialize(self) -> None:
        """Connect to Redis (async wrapper)"""
        try:
            # Note: redis-py doesn't have async by default, but we mock async interface
            self.client = redis.from_url(self.redis_url, decode_responses=True)
            
            # Test connection
            self.client.ping()
            self.connected = True
            logger.info("RoomStateManager connected to Redis", {"redis_url": self.redis_url})
        except (ConnectionError, RedisTimeoutError) as e:
            logger.error("Failed to connect to Redis", {"error": str(e)})
            self.connected = False
            raise

    async def shutdown(self) -> None:
        """Close Redis connection"""
        if self.client:
            try:
                self.client.close()
                self.connected = False
                logger.info("RoomStateManager Redis connection closed")
            except Exception as e:
                logger.error("Error closing Redis connection", {"error": str(e)})

    async def create_room(self, room_state: RoomState) -> None:
        """
        Persist new room state to Redis
        
        Args:
            room_state: RoomState to persist
        """
        if not self.client:
            raise RuntimeError("RoomStateManager not initialized")

        try:
            # Serialize room state
            state_data = self._serialize_room_state(room_state)
            key = f"{REDIS_KEY_ROOM_STATE}{room_state.room.id}"

            # Store state with TTL
            self.client.setex(
                key,
                DEFAULT_ROOM_TTL,
                json.dumps(state_data)
            )

            # Add to index (sorted set for easy enumeration)
            now = datetime.utcnow()
            self.client.zadd(
                REDIS_KEY_ROOM_INDEX,
                {room_state.room.id: now.timestamp()}
            )

            logger.info(
                "Room created in Redis",
                extra={
                    "room_id": room_state.room.id,
                    "ttl": DEFAULT_ROOM_TTL,
                }
            )
        except Exception as e:
            logger.error(
                "Failed to create room in Redis",
                extra={"room_id": room_state.room.id, "error": str(e)}
            )
            raise

    async def get_room(self, room_id: str) -> Optional[RoomState]:
        """
        Retrieve room state from Redis
        
        Args:
            room_id: Room UUID
            
        Returns:
            RoomState if found, None otherwise
        """
        if not self.client:
            raise RuntimeError("RoomStateManager not initialized")

        try:
            key = f"{REDIS_KEY_ROOM_STATE}{room_id}"
            data = self.client.get(key)

            if not data:
                return None

            return self._deserialize_room_state(json.loads(data))
        except Exception as e:
            logger.warning(
                "Failed to retrieve room from Redis",
                extra={"room_id": room_id, "error": str(e)}
            )
            return None

    async def update_room(self, room_state: RoomState) -> None:
        """
        Update room state in Redis
        
        Args:
            room_state: Updated RoomState
        """
        if not self.client:
            raise RuntimeError("RoomStateManager not initialized")

        try:
            state_data = self._serialize_room_state(room_state)
            key = f"{REDIS_KEY_ROOM_STATE}{room_state.room.id}"

            # Update state, preserving TTL
            ttl = self.client.ttl(key)
            self.client.setex(
                key,
                ttl if ttl > 0 else DEFAULT_ROOM_TTL,
                json.dumps(state_data)
            )

            logger.debug(
                "Room updated in Redis",
                extra={"room_id": room_state.room.id}
            )
        except Exception as e:
            logger.error(
                "Failed to update room in Redis",
                extra={"room_id": room_state.room.id, "error": str(e)}
            )
            raise

    async def delete_room(self, room_id: str) -> None:
        """
        Delete room state from Redis
        
        Args:
            room_id: Room UUID
        """
        if not self.client:
            raise RuntimeError("RoomStateManager not initialized")

        try:
            key = f"{REDIS_KEY_ROOM_STATE}{room_id}"
            
            # Delete state and related data
            self.client.delete(
                key,
                f"{REDIS_KEY_ROOM_PARTICIPANTS}{room_id}",
                f"{REDIS_KEY_ROOM_MESSAGES}{room_id}",
                f"{REDIS_KEY_ROOM_TURN}{room_id}"
            )

            # Remove from index
            self.client.zrem(REDIS_KEY_ROOM_INDEX, room_id)

            logger.info(
                "Room deleted from Redis",
                extra={"room_id": room_id}
            )
        except Exception as e:
            logger.error(
                "Failed to delete room from Redis",
                extra={"room_id": room_id, "error": str(e)}
            )
            raise

    async def get_all_active_rooms(self) -> list[str]:
        """
        Get IDs of all active rooms in Redis
        
        Returns:
            List of room IDs
        """
        if not self.client:
            raise RuntimeError("RoomStateManager not initialized")

        try:
            # Get all rooms from index
            room_ids = self.client.zrange(REDIS_KEY_ROOM_INDEX, 0, -1)
            return list(room_ids)
        except Exception as e:
            logger.error(
                "Failed to list active rooms",
                extra={"error": str(e)}
            )
            return []

    async def set_room_ttl(self, room_id: str, ttl_seconds: int) -> None:
        """
        Update TTL for a room (useful for extending lifetime)
        
        Args:
            room_id: Room UUID
            ttl_seconds: New TTL in seconds
        """
        if not self.client:
            raise RuntimeError("RoomStateManager not initialized")

        try:
            key = f"{REDIS_KEY_ROOM_STATE}{room_id}"
            self.client.expire(key, ttl_seconds)

            logger.debug(
                "Room TTL updated",
                extra={"room_id": room_id, "ttl": ttl_seconds}
            )
        except Exception as e:
            logger.warning(
                "Failed to update room TTL",
                extra={"room_id": room_id, "error": str(e)}
            )

    async def store_participant(self, room_id: str, agent_id: str, data: Dict[str, Any]) -> None:
        """
        Store participant data in Redis
        
        Args:
            room_id: Room UUID
            agent_id: Agent UUID
            data: Participant metadata
        """
        if not self.client:
            raise RuntimeError("RoomStateManager not initialized")

        try:
            key = f"{REDIS_KEY_ROOM_PARTICIPANTS}{room_id}"
            # Store as hash field
            self.client.hset(key, agent_id, json.dumps(data))
            # Set TTL on hash
            self.client.expire(key, DEFAULT_ROOM_TTL)
        except Exception as e:
            logger.warning(
                "Failed to store participant",
                extra={"room_id": room_id, "agent_id": agent_id, "error": str(e)}
            )

    async def get_participants(self, room_id: str) -> Dict[str, Dict[str, Any]]:
        """
        Retrieve all participants for a room
        
        Args:
            room_id: Room UUID
            
        Returns:
            Dict of agent_id -> participant data
        """
        if not self.client:
            raise RuntimeError("RoomStateManager not initialized")

        try:
            key = f"{REDIS_KEY_ROOM_PARTICIPANTS}{room_id}"
            data = self.client.hgetall(key)
            
            return {
                agent_id: json.loads(info)
                for agent_id, info in data.items()
            }
        except Exception as e:
            logger.warning(
                "Failed to retrieve participants",
                extra={"room_id": room_id, "error": str(e)}
            )
            return {}

    async def store_message(self, room_id: str, message_id: str, message_data: Dict[str, Any]) -> None:
        """
        Store message in Redis (time-series like structure)
        
        Args:
            room_id: Room UUID
            message_id: Message UUID
            message_data: Message content and metadata
        """
        if not self.client:
            raise RuntimeError("RoomStateManager not initialized")

        try:
            key = f"{REDIS_KEY_ROOM_MESSAGES}{room_id}"
            # Store as hash with timestamp score
            timestamp = datetime.utcnow().timestamp()
            self.client.hset(key, message_id, json.dumps(message_data))
            # Set TTL
            self.client.expire(key, DEFAULT_ROOM_TTL)
        except Exception as e:
            logger.warning(
                "Failed to store message",
                extra={"room_id": room_id, "message_id": message_id, "error": str(e)}
            )

    async def get_messages(self, room_id: str, limit: int = 100) -> list[Dict[str, Any]]:
        """
        Retrieve recent messages for a room
        
        Args:
            room_id: Room UUID
            limit: Max number of messages to return
            
        Returns:
            List of message objects
        """
        if not self.client:
            raise RuntimeError("RoomStateManager not initialized")

        try:
            key = f"{REDIS_KEY_ROOM_MESSAGES}{room_id}"
            data = self.client.hgetall(key)
            
            messages = [json.loads(msg) for msg in data.values()]
            # Sort by timestamp descending, limit
            messages.sort(key=lambda m: m.get("created_at", 0), reverse=True)
            return messages[:limit]
        except Exception as e:
            logger.warning(
                "Failed to retrieve messages",
                extra={"room_id": room_id, "error": str(e)}
            )
            return []

    async def health_check(self) -> Dict[str, Any]:
        """
        Check Redis health and basic metrics
        
        Returns:
            Health status dict
        """
        if not self.client:
            return {"status": "disconnected"}

        try:
            self.client.ping()
            info = self.client.info("memory")
            
            return {
                "status": "healthy",
                "connected": True,
                "memory_used": info.get("used_memory", 0),
                "memory_peak": info.get("used_memory_peak", 0),
            }
        except Exception as e:
            logger.error("Health check failed", extra={"error": str(e)})
            return {
                "status": "unhealthy",
                "connected": False,
                "error": str(e),
            }

    # ============================================
    # Private Helpers
    # ============================================

    def _serialize_room_state(self, room_state: RoomState) -> Dict[str, Any]:
        """Serialize RoomState to JSON-compatible dict"""
        room_dict = room_state.room.model_dump(mode='json')
        return {
            "room": room_dict,
            "message_queue": room_state.message_queue,
            "turn_history": room_state.turn_history,
            "last_speaker_id": room_state.last_speaker_id,
            "transcript": room_state.transcript,
            "contract_satisfaction": room_state.contract_satisfaction,
        }

    def _deserialize_room_state(self, data: Dict[str, Any]) -> RoomState:
        """Deserialize JSON dict back to RoomState"""
        room_data = data.get("room", {})
        room = Room(**room_data)

        return RoomState(
            room=room,
            message_queue=data.get("message_queue", []),
            turn_history=data.get("turn_history", []),
            last_speaker_id=data.get("last_speaker_id"),
            transcript=data.get("transcript", []),
            contract_satisfaction=data.get("contract_satisfaction", 0.0),
        )


# Singleton instance
_room_state_manager: Optional[RoomStateManager] = None


async def get_room_state_manager() -> RoomStateManager:
    """Get or create room state manager singleton"""
    global _room_state_manager
    
    if not _room_state_manager:
        _room_state_manager = RoomStateManager()
        await _room_state_manager.initialize()
    
    return _room_state_manager
