"""Core orchestration engine coordinating all systems."""

import json
import logging
import re
from datetime import datetime
from typing import Optional
from urllib.parse import urlparse

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
    Core brain of Beely.

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
        logger.info("Starting OrchestrationService.initialize()...")
        try:
            self.room_state_manager = await get_room_state_manager()
            logger.info("get_room_state_manager() returned", {
                "room_state_manager": self.room_state_manager,
                "connected": self.room_state_manager.connected if self.room_state_manager else "N/A"
            })
            logger.info("OrchestrationService initialized with Redis state manager")
        except Exception as e:
            logger.error(f"Failed to initialize room_state_manager: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise

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
        status_value = message.status.value if hasattr(message.status, 'value') else str(message.status)
        await self.room_state_manager.store_message(
            room_id, 
            message.id, 
            {
                "id": message.id,
                "agent_id": message.agent_id,
                "content": message.content,
                "status": status_value,
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
        1. Acquire a distributed Redis lock to prevent concurrent turn processing
           for the same room (race-condition protection).
        2. Get pending messages from queue
        3. Score each against context
        4. Apply moderation
        5. Select winner
        6. Emit turn event
        7. Check contract completion
        8. Return turn metadata

        Args:
            room_id: Room UUID

        Returns:
            Dict with turn result (selected_message, score, reasoning, etc.)
        """
        if not self.room_state_manager:
            raise RuntimeError("OrchestrationService not initialized")

        # ── Distributed lock (H4) ────────────────────────────────────────────
        # Prevent concurrent process_turn calls on the same room from corrupting
        # room state (lost writes, duplicate turns, incorrect contract tracking).
        lock_key = f"turn_lock:{room_id}"
        lock_value = str(id(self))  # unique enough per-process identifier
        lock_ttl_seconds = 30  # generous TTL in case the process dies mid-turn

        redis = self.room_state_manager.redis
        acquired = await redis.set(lock_key, lock_value, nx=True, ex=lock_ttl_seconds)
        if not acquired:
            logger.warning(
                "Turn already in progress for room — skipping duplicate request",
                extra={"room_id": room_id},
            )
            return {"status": "turn_in_progress", "room_id": room_id}

        try:
            return await self._process_turn_locked(room_id)
        finally:
            # Release lock only if we still own it (prevent releasing a lock
            # refreshed by another process after our TTL expired).
            current = await redis.get(lock_key)
            if current and current.decode() == lock_value:
                await redis.delete(lock_key)

    async def _process_turn_locked(self, room_id: str) -> dict:
        """Internal turn processing — must only be called while holding the turn lock."""
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

    # ──────────────────────────────────────────────────────────────────────────
    # Podcast / content-generation helpers
    # ──────────────────────────────────────────────────────────────────────────

    async def generate_podcast_script(
        self,
        podcast_id: str,
        episode_id: str,
        title: str,
        source_urls: list[str] | None = None,
    ) -> dict:
        """
        Generate a podcast episode script via the configured LLM.

        Returns a dict compatible with GeneratePodcastResponse.
        Falls back to a structured placeholder when LLM is unavailable.
        """
        safe_title = self._sanitize_llm_input(title, max_length=200)

        # Only include URLs that pass SSRF policy (C6/H1)
        safe_source_urls = [u for u in (source_urls or [])[:5] if self._is_safe_url(u)]
        sources_text = ""
        if safe_source_urls:
            sources_text = "\n".join(f"- {u}" for u in safe_source_urls)
            sources_text = f"\n\nReference sources:\n{sources_text}"

        prompt = (
            f"You are an expert podcast scriptwriter. Write a compelling, engaging podcast "
            f"script for an episode titled: \"{safe_title}\".{sources_text}\n\n"
            "Requirements:\n"
            "- Natural conversational tone\n"
            "- Clear introduction, body, and conclusion\n"
            "- Duration target: 3-5 minutes when spoken aloud (~450-750 words)\n"
            "- No stage directions, only spoken content\n\n"
            "Write only the script text, nothing else."
        )

        script = await self._call_llm(
            system="You are a professional podcast scriptwriter producing high-quality AI content.",
            user_content=prompt,
            max_tokens=1200,
            fallback=(
                f"Welcome to this episode: {safe_title}. "
                "Today we explore this fascinating topic in depth. "
                "Stay tuned for more insights from the Beely AI network."
            ),
        )

        # Estimate duration: ~150 words per minute
        word_count = len(script.split())
        estimated_seconds = max(60, int(word_count / 150 * 60))

        # Cache status in Redis (48h TTL) if state manager is ready
        if self.room_state_manager:
            try:
                await self.room_state_manager.redis.setex(
                    f"podcast_episode:{episode_id}",
                    172800,  # 48h
                    json.dumps({"status": "ready", "script": script, "episode_id": episode_id}),
                )
            except Exception as cache_err:
                logger.warning("Failed to cache podcast episode: %s", cache_err)

        logger.info(
            "Podcast script generated",
            extra={"episode_id": episode_id, "word_count": word_count},
        )

        return {
            "episode_id": episode_id,
            "status": "ready",
            "script": script,
            "estimated_duration_seconds": estimated_seconds,
            "estimated_cost_usdc": round(word_count * 0.000_01, 4),  # rough token cost
            "estimated_time_seconds": 5,
        }

    # ── Internal helpers ─────────────────────────────────────────────────────

    @staticmethod
    def _sanitize_llm_input(text: str, max_length: int = 1000) -> str:
        """
        Strip prompt-injection patterns from user-supplied text before it is
        interpolated into LLM prompts.

        Removes: instruction-override markers, role-switch attempts, special
        XML-like tags, and truncates to `max_length` characters.
        """
        if not text:
            return ""
        # Truncate first to bound cost
        sanitized = text[:max_length]
        # Remove common injection phrases
        injection_patterns = [
            r"(?i)ignore\s+(all\s+)?previous\s+instructions",
            r"(?i)forget\s+(everything|all|prior)",
            r"(?i)you\s+are\s+now\s+(a|an|the)\s+",
            r"(?i)(system|assistant|human|user)\s*:\s*",
            r"<\|?(im_start|im_end|endoftext)\|?>",
            r"\[\[(SYSTEM|INST|\/INST)\]\]",
        ]
        for pattern in injection_patterns:
            sanitized = re.sub(pattern, " ", sanitized)
        # Collapse excessive whitespace introduced by replacements
        sanitized = re.sub(r"\s{3,}", "  ", sanitized).strip()
        return sanitized

    @staticmethod
    def _is_safe_url(url: str) -> bool:
        """
        SSRF protection: reject URLs that point at private/loopback networks or
        use non-HTTP(S) schemes.

        Blocked:
        - Non-http/https schemes (file://, ftp://, gopher://, etc.)
        - Loopback addresses (127.x.x.x, ::1, localhost)
        - RFC-1918 private ranges (10.x, 172.16-31.x, 192.168.x)
        - Link-local (169.254.x.x)
        - Internal metadata endpoints (169.254.169.254 — AWS/GCP IMDS)
        """
        try:
            parsed = urlparse(url)
        except Exception:
            return False

        if parsed.scheme not in ("http", "https"):
            return False

        hostname = parsed.hostname or ""
        if not hostname:
            return False

        # Block loopback and common internal hostnames
        blocked_hostnames = {"localhost", "metadata.google.internal"}
        if hostname.lower() in blocked_hostnames:
            return False

        # Block by IP range
        import ipaddress
        try:
            addr = ipaddress.ip_address(hostname)
            if (
                addr.is_loopback
                or addr.is_private
                or addr.is_link_local
                or addr.is_multicast
                or addr.is_reserved
                or addr.is_unspecified
            ):
                return False
        except ValueError:
            # Not an IP address — hostname-based; allow it
            pass

        return True

    async def generate_podcast_dialogue(
        self,
        podcast_id: str,
        episode_id: str,
        title: str,
        source_urls: list[str] | None = None,
    ) -> dict:
        """
        Generate a two-host dialogue podcast script in NotebookLM style.

        HOST_A is a curious, thoughtful learner; HOST_B is a knowledgeable expert.
        Each line is prefixed with [HOST_A]: or [HOST_B]: for downstream TTS routing.
        Source URLs are fetched and their text is injected into the prompt for grounding.
        Falls back to title-only if all URL fetches fail.
        Returns a dict compatible with GeneratePodcastResponse.
        """
        # Sanitize user-supplied title before LLM interpolation (H1)
        safe_title = self._sanitize_llm_input(title, max_length=200)

        # Fetch and extract text from source URLs (best-effort, SSRF-safe)
        source_content = ""
        if source_urls:
            try:
                import httpx
                async with httpx.AsyncClient(
                    timeout=10,
                    follow_redirects=False,  # Never follow redirects — prevents redirect-based SSRF
                    max_redirects=0,
                ) as client:
                    for url in source_urls[:3]:  # Cap at 3 sources
                        # Block private/internal URLs before making the request (C6)
                        if not self._is_safe_url(url):
                            logger.warning(
                                "Source URL blocked by SSRF policy",
                                extra={"url": url, "episode_id": episode_id},
                            )
                            continue
                        try:
                            resp = await client.get(
                                url,
                                headers={"Accept": "text/html,text/plain"},
                            )
                            if resp.status_code == 200:
                                # Strip HTML tags with a simple regex
                                text = re.sub(r"<[^>]+>", " ", resp.text)
                                text = re.sub(r"\s+", " ", text).strip()
                                source_content += f"\n\n--- Source: {url} ---\n{text[:3000]}"
                        except Exception as fetch_err:
                            logger.debug("Failed to fetch source URL %s: %s", url, fetch_err)
            except ImportError:
                logger.warning("httpx not installed; skipping source URL fetch")

        sources_block = (
            f"\n\nGround every claim in the following source material:\n{source_content}"
            if source_content
            else ""
        )

        system_prompt = (
            "You are a podcast producer writing natural two-host dialogue scripts. "
            "Respond ONLY with the dialogue lines — no headers, no preamble, no stage directions."
        )

        user_prompt = (
            f'Write a podcast dialogue between two hosts about: "{safe_title}".{sources_block}\n\n'
            "HOST_A is a curious, thoughtful learner who asks questions and builds understanding.\n"
            "HOST_B is a knowledgeable expert who explains with concrete examples.\n\n"
            "Rules:\n"
            "- Alternate speakers 10-16 times total (~600-900 words)\n"
            "- Each line must be on its own line, prefixed exactly as [HOST_A]: or [HOST_B]:\n"
            "- No blank lines between speakers, no other text outside the dialogue\n"
            "- Ground every claim in the source material when provided\n"
            "- End with HOST_A thanking listeners and HOST_B signing off\n\n"
            "Begin the dialogue now."
        )

        fallback_script = (
            f"[HOST_A]: Welcome back everyone. Today we're exploring: {safe_title}.\n"
            f"[HOST_B]: That's right. It's a fascinating topic and we have a lot to cover.\n"
            f"[HOST_A]: Let's dive in. What should our listeners know first?\n"
            f"[HOST_B]: The most important thing to understand is that this area is evolving rapidly. "
            f"Staying curious and informed is the best approach.\n"
            f"[HOST_A]: Great point. Thanks for listening, everyone.\n"
            f"[HOST_B]: Until next time."
        )

        script = await self._call_llm(
            system=system_prompt,
            user_content=user_prompt,
            max_tokens=1500,
            fallback=fallback_script,
        )

        # Validate that the script has dialogue markers; fall back if not
        if "[HOST_A]:" not in script and "[HOST_B]:" not in script:
            logger.warning("Dialogue script missing speaker markers, using fallback")
            script = fallback_script

        word_count = len(script.split())
        estimated_seconds = max(60, int(word_count / 150 * 60))

        # Cache in Redis
        if self.room_state_manager:
            try:
                await self.room_state_manager.redis.setex(
                    f"podcast_episode:{episode_id}",
                    172800,  # 48h
                    json.dumps({
                        "status": "ready",
                        "script": script,
                        "episode_id": episode_id,
                        "format": "dialogue",
                    }),
                )
            except Exception as cache_err:
                logger.warning("Failed to cache dialogue episode: %s", cache_err)

        logger.info(
            "Dialogue podcast script generated",
            extra={"episode_id": episode_id, "word_count": word_count},
        )

        return {
            "episode_id": episode_id,
            "status": "ready",
            "script": script,
            "estimated_duration_seconds": estimated_seconds,
            "estimated_cost_usdc": round(word_count * 0.000_015, 4),  # slightly higher for multi-voice
            "estimated_time_seconds": 8,
        }

    async def get_podcast_episode_status(self, episode_id: str) -> dict | None:
        """
        Return cached episode status/script from Redis, or None if not found.
        """
        if not self.room_state_manager:
            return None
        try:
            raw = await self.room_state_manager.redis.get(f"podcast_episode:{episode_id}")
            if raw is None:
                return None
            return json.loads(raw)
        except Exception as err:
            logger.warning("Failed to retrieve episode status from Redis: %s", err)
            return None

    async def generate_summary(self, transcript: str) -> str:
        """
        Produce a concise 3-5 sentence summary of the provided transcript.

        Truncates input to 5 000 characters before sending to LLM.
        Falls back to the first 500 characters of the transcript on failure.
        """
        truncated = transcript[:5000]

        summary = await self._call_llm(
            system="You are a precise summariser. Respond only with the summary text, no preamble.",
            user_content=(
                f"Summarise the following transcript in 3-5 sentences. "
                f"Be concise and capture the key insights:\n\n{truncated}"
            ),
            max_tokens=300,
            fallback=transcript[:500] + ("..." if len(transcript) > 500 else ""),

        )
        return summary

    async def _call_llm(
        self,
        system: str,
        user_content: str,
        max_tokens: int = 500,
        fallback: str = "",
    ) -> str:
        """
        Internal helper: call the LLM provider and return the text response.

        Returns `fallback` if the provider is unavailable or the call fails.
        """
        client = getattr(self.scoring_engine, "client", None)
        if client is None:
            logger.warning("LLM client not available, returning fallback")
            return fallback

        try:
            response = client.messages_create(
                model=settings.SCORING_MODEL,
                max_tokens=max_tokens,
                messages=[
                    {"role": "user", "content": user_content},
                ],
            )
            # Handle both Anthropic-style and OpenAI-style response objects
            if hasattr(response, "content") and response.content:
                return response.content[0].text.strip()
            if hasattr(response, "choices") and response.choices:
                return response.choices[0].message.content.strip()
            return fallback
        except Exception as err:
            logger.error("LLM call failed in _call_llm: %s", err)
            return fallback
