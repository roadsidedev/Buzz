#!/usr/bin/env python3
"""
orchestrator_bridge.py
Thin adapter between the radio-runner and the Buzz API + Orchestrator.

Handles agent registration, room lifecycle, message submission, and
turn processing via HTTP.

Architecture placement: scripts/radio-runner/
Depends on: httpx
Used by: radio_runner.py, room_keeper.py
"""

import json
import logging
import os
import time
import uuid
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Optional

import httpx

# ── Constants ────────────────────────────────────────────────────────────
AGENT_CREDENTIALS_FILE: str = os.environ.get(
    "RADIO_AGENTS_FILE",
    str(Path(__file__).parent / ".radio_agents.json"),
)
logger = logging.getLogger(__name__)

# Note: SYSTEM_SECRET is now handled via the OrchestratorBridge instance to avoid module-level environment issues.

# ── Data Models ──────────────────────────────────────────────────────────────

@dataclass
class RegisteredAgent:
    """An agent registered with the backend."""

    id: str
    api_key: str
    name: str


@dataclass
class TurnResult:
    """Result of a processed orchestrator turn."""

    status: str
    selected_message_id: Optional[str] = None
    selected_agent_id: Optional[str] = None
    score: float = 0.0
    turn_number: Optional[int] = None


# ── OrchestratorBridge ───────────────────────────────────────────────────────

class OrchestratorBridge:
    """
    HTTP adapter for the Buzz backend API.

    Since the orchestrator is now part of the backend service, all requests
    go through a single base URL.

    Usage:
        bridge = OrchestratorBridge(
            backend_url="https://clawzz-backend-live.up.railway.app",
        )
        bridge.wait_for_backend()       # startup health check
        host = bridge.register_agent("RadioHost", "radio_host_001")
        room_id = bridge.create_room(host, "debate", "Today's top news")
    """

    def __init__(
        self,
        backend_url: str = "https://clawzz-backend-live.up.railway.app",
        orchestrator_url: Optional[str] = None,
        timeout: float = 30.0,
        system_secret: Optional[str] = None,
    ) -> None:
        self.backend_url = backend_url.rstrip("/")
        # Orchestrator is now part of the backend — keep param for backward compat
        self.orchestrator_url = (orchestrator_url or self.backend_url).rstrip("/")

        # Load system secret (check both standard casing and user-provided lowercase)
        self.system_secret = (
            system_secret or
            os.environ.get("RADIO_SYSTEM_SECRET") or
            os.environ.get("radio_system_secret")
        )

        if self.system_secret:
            logger.info("System secret loaded for platform bypass")
        else:
            logger.warning("No RADIO_SYSTEM_SECRET or radio_system_secret found!")

        self._backend = httpx.Client(
            base_url=self.backend_url,
            timeout=timeout,
        )
        self._orchestrator = httpx.Client(
            base_url=self.orchestrator_url,
            timeout=120.0,
        )

    def close(self) -> None:
        """Release HTTP connections."""
        self._backend.close()
        self._orchestrator.close()

    # ── Startup Health Check ──────────────────────────────────────────────────

    def wait_for_backend(
        self,
        max_attempts: int = 12,
        initial_delay: float = 2.0,
        max_delay: float = 30.0,
    ) -> bool:
        """
        Block until the backend responds to /health, with exponential backoff.

        Args:
            max_attempts: Maximum number of health-check attempts before giving up.
            initial_delay: Seconds to wait before the first retry.
            max_delay: Cap on the exponential backoff delay.
            health_path: Endpoint to probe.

        Returns:
            True once the backend is reachable.

        Raises:
            RuntimeError: If max_attempts is exhausted without a successful probe.
        """
        delay = initial_delay
        for attempt in range(1, max_attempts + 1):
            try:
                resp = self._backend.get("/health", timeout=5.0)
                if resp.status_code < 500:
                    logger.info(
                        "Backend health check passed (attempt %d/%d, status %d)",
                        attempt, max_attempts, resp.status_code,
                    )
                    return True
                logger.warning(
                    "Backend health check returned %d (attempt %d/%d)",
                    resp.status_code, attempt, max_attempts,
                )
            except Exception as exc:
                logger.warning(
                    "Backend not ready yet (attempt %d/%d): %s",
                    attempt, max_attempts, exc,
                )
            if attempt < max_attempts:
                logger.info("Retrying in %.1fs…", delay)
                time.sleep(delay)
                delay = min(delay * 1.5, max_delay)

        raise RuntimeError(
            f"Backend at {self.backend_url} did not become healthy "
            f"after {max_attempts} attempts"
        )

    # ── Agent Credential Persistence ─────────────────────────────────────────

    def register_or_reuse_agent(
        self, 
        name: str, 
        username: str, 
        pre_auth_key: Optional[str] = None
    ) -> "RegisteredAgent":
        """
        Return a cached agent if credentials exist and the backend confirms the
        agent is still valid.  Falls back to registering a fresh agent.

        If pre_auth_key is provided, it takes priority and registration is skipped.
        All backend calls are retried with backoff to handle transient failures.
        """
        # 1. Check for pre-authorized key
        if pre_auth_key:
            logger.info("Using pre-authorized API key for '%s'", username)
            try:
                resp = self._retry_get(
                    "/api/v1/auth/me",
                    headers=self._auth_headers(pre_auth_key),
                    label=f"auth_me({username})",
                )
                if resp.status_code == 401 or resp.status_code == 403:
                    logger.warning(
                        "Pre-authorized key for '%s' is invalid (HTTP %d) — "
                        "falling back to fresh registration",
                        username, resp.status_code,
                    )
                else:
                    self._assert_ok(resp, "auth_me")
                    agent_data = resp.json().get("data")
                    if not agent_data:
                        raise RuntimeError("Invalid response from /auth/me")

                    return RegisteredAgent(
                        id=agent_data["id"],
                        api_key=pre_auth_key,
                        name=agent_data["name"],
                    )
            except Exception as exc:
                logger.warning(
                    "Pre-authorized key validation failed for '%s': %s — "
                    "falling back to fresh registration",
                    username, exc,
                )

        # 2. Check cache
        creds = self._load_agent_credentials()
        cached = creds.get(username)
        if cached:
            # Treat legacy-format keys (pre-rebrand) as stale immediately
            if not cached.get("api_key", "").startswith("beely_"):
                logger.info("Cached key for '%s' uses legacy format — re-registering", username)
            else:
                try:
                    # Verify the agent still exists on the backend
                    resp = self._backend.get(
                        f"/api/v1/agents/{cached['id']}",
                        headers=self._auth_headers(cached["api_key"]),
                    )
                    if resp.status_code < 300:
                        logger.info("Reusing cached agent credentials for '%s'", username)
                        return RegisteredAgent(**cached)
                except Exception:
                    pass
                logger.info("Cached credentials for '%s' are stale — re-registering", username)

        # 3. Fresh registration
        agent = self.register_agent(name, username)
        creds[username] = asdict(agent)
        self._save_agent_credentials(creds)
        return agent

    def _load_agent_credentials(self) -> dict:
        try:
            path = Path(AGENT_CREDENTIALS_FILE)
            if path.exists():
                return json.loads(path.read_text(encoding="utf-8"))
        except Exception as exc:
            logger.warning("Could not load agent credentials: %s", exc)
        return {}

    def _save_agent_credentials(self, creds: dict) -> None:
        try:
            Path(AGENT_CREDENTIALS_FILE).write_text(
                json.dumps(creds, indent=2), encoding="utf-8"
            )
        except Exception as exc:
            logger.warning("Could not save agent credentials: %s", exc)

    # ── Agent Registration ───────────────────────────────────────────────────

    def register_agent(self, name: str, username: str) -> "RegisteredAgent":
        """
        Register a new agent with the backend.
        """
        payload = {
            "name": name,
            "username": username,
            "description": "Radio runner agent (Alex/Mira)",
        }
        if self.system_secret:
            payload["system_secret"] = self.system_secret

        resp = self._backend.post(
            "/api/v1/agents/register",
            json=payload,
            headers={"Content-Type": "application/json", "Accept-Encoding": "identity"},
        )
        self._assert_ok(resp, "register_agent")
        data = resp.json()
        agent = data["agent"]
        logger.info("Agent registered", extra={"agent_id_short": agent["id"][:8], "agent_name": name})
        return RegisteredAgent(
            id=agent["id"],
            api_key=agent["api_key"],
            name=name,
        )

    # ── Room Lifecycle ───────────────────────────────────────────────────────

    def create_room(
        self,
        host: RegisteredAgent,
        title: str = "Buzz Radio Live",
        room_type: str = "debate",
        objective: str = "Live news discussion",
        spawn_fee: int = 250,
        join_as_host: bool = True,
        max_retries: int = 3,
    ) -> str:
        """
        Create a new room via the backend API and optionally join the host as
        a participant immediately.

        Retries on HTTP 429 (rate limit) using the server's retryAfter value.

        The host agent creates the room (sets hostAgentId) but is NOT
        automatically added to the room_participant table by the backend.
        Calling join_room() here ensures the host appears in the participant
        list alongside the co-host so the frontend shows them as "live".

        Args:
            host: The host agent who creates and owns the room
            title: Display title for the room
            room_type: Room type (e.g. "debate")
            objective: Room objective text
            spawn_fee: Spawn fee in cents (default 250 = $2.50)
            join_as_host: If True (default), auto-join the host as participant
                          after creation. Set False only for testing.
            max_retries: Max retries on rate limit (default 3)

        Returns:
            Room ID (UUID string)
        """
        last_exc: Optional[Exception] = None
        for attempt in range(max_retries + 1):
            resp = self._backend.post(
                "/api/v1/rooms",
                json={
            "type": room_type,
                     "title": title,
                     "objective": objective,
                     "spawnFee": spawn_fee,
                     "recordingEnabled": True,
                     "managedExternally": True,
                },
                headers=self._auth_headers(host.api_key),
            )

            if resp.status_code == 429:
                # Extract retry-after from header or response body
                retry_after = None
                try:
                    body = resp.json()
                    retry_after = body.get("error", {}).get("context", {}).get("retryAfter")
                except Exception:
                    pass
                if retry_after is None:
                    retry_after = resp.headers.get("Retry-After")
                if retry_after is not None:
                    retry_after = int(retry_after)
                else:
                    # Default backoff: 60s * (attempt + 1)
                    retry_after = 60 * (attempt + 1)

                if attempt < max_retries:
                    logger.warning(
                        "Rate limited on room creation — retrying in %ds (attempt %d/%d)",
                        retry_after, attempt + 1, max_retries,
                    )
                    time.sleep(retry_after)
                    continue
                else:
                    raise RuntimeError(
                        f"[create_room] Rate limit exceeded after {max_retries} retries. "
                        f"Retry after {retry_after}s."
                    )

            if resp.status_code == 500:
                # Server error — retry with exponential backoff
                if attempt < max_retries:
                    backoff = min(2 ** (attempt + 1), 30)  # 2s, 4s, 8s, max 30s
                    try:
                        error_body = resp.json()
                        error_msg = error_body.get("error", {}).get("message", "Unknown server error")
                    except Exception:
                        error_msg = resp.text[:200] if resp.text else "Empty response"
                    logger.warning(
                        "Server error on room creation — retrying in %ds (attempt %d/%d): %s",
                        backoff, attempt + 1, max_retries, error_msg,
                    )
                    time.sleep(backoff)
                    continue
                else:
                    try:
                        error_body = resp.json()
                        error_detail = error_body.get("error", {})
                        error_msg = error_detail.get("message", "Unknown server error")
                        error_context = error_detail.get("context", {})
                    except Exception:
                        error_msg = resp.text[:500] if resp.text else "Empty response"
                        error_context = {}
                    raise RuntimeError(
                        f"[create_room] Server error after {max_retries} retries: {error_msg}. "
                        f"Context: {error_context}"
                    )

            self._assert_ok(resp, "create_room")
            break

        data = resp.json()
        room_id = data["data"]["room"]["id"]
        status = data["data"]["room"]["status"]
        logger.info("Room created", extra={"room_id": room_id[:8], "status": status})

        # Auto-join the host as a participant so they appear in the participant
        # list. The backend only sets hostAgentId during creation; it does NOT
        # automatically insert a room_participant row for the host.
        if join_as_host:
            try:
                self.join_room(room_id, host)
                logger.info("Host joined room as participant", extra={"room_id": room_id[:8], "host": host.name})
            except Exception as exc:
                # Non-fatal: the room is still created. Log and continue.
                logger.warning(
                    "Host self-join failed — host may not appear as participant",
                    extra={"room_id": room_id[:8], "error": str(exc)},
                )

        return room_id

    def join_room(self, room_id: str, agent: RegisteredAgent) -> None:
        """Join an agent into a room."""
        resp = self._backend.post(
            f"/api/v1/rooms/{room_id}/join",
            json={},
            headers=self._auth_headers(agent.api_key),
        )
        self._assert_ok(resp, "join_room")
        logger.info("Agent joined room", extra={"room_id": room_id[:8], "agent": agent.name})

    def get_room_status(self, room_id: str) -> str:
        """
        Get the current status of a room.

        Returns:
            Status string: 'pending', 'live', 'completed', 'cancelled'
        """
        resp = self._backend.get(f"/api/v1/rooms/{room_id}")
        self._assert_ok(resp, "get_room_status")
        data = resp.json()
        return data["data"]["room"]["status"]

    def close_room(self, room_id: str, host: RegisteredAgent) -> None:
        """Close a room (host only)."""
        resp = self._backend.post(
            f"/api/v1/rooms/{room_id}/close",
            json={},
            headers=self._auth_headers(host.api_key),
        )
        self._assert_ok(resp, "close_room")
        logger.info("Room closed", extra={"room_id": room_id[:8]})

    def send_heartbeat(self, room_id: str, api_key: str) -> bool:
        """
        Send a heartbeat to signal the room host is still alive.

        The backend uses this to keep the room visible in discovery
        (last_seen_at > NOW() - INTERVAL '60 seconds').

        Args:
            room_id: Room ID to heartbeat
            api_key: Host agent API key for auth

        Returns:
            True if heartbeat was accepted
        """
        try:
            resp = self._backend.post(
                f"/api/v1/rooms/{room_id}/heartbeat",
                headers=self._auth_headers(api_key),
            )
            if resp.status_code >= 300:
                logger.warning(
                    "Heartbeat rejected",
                    extra={"room_id": room_id[:8], "status": resp.status_code},
                )
                return False
            return True
        except Exception as exc:
            logger.warning("Heartbeat failed", extra={"error": str(exc)})
            return False

    # ── Message Submission & Turn Processing ─────────────────────────────────

    def submit_message(
        self,
        room_id: str,
        agent_id: str,
        text: str,
        api_key: Optional[str] = None,
    ) -> str:
        """
        Submit a message to the orchestrator for scoring.

        Args:
            room_id: The room to submit to
            agent_id: The agent submitting the message
            text: The message text
            api_key: Agent API key for auth headers

        Returns:
            The message ID
        """
        msg_id = str(uuid.uuid4())
        body = {
            "message": {
                "id": msg_id,
                "room_id": room_id,
                "agent_id": agent_id,
                "text": text,
                "status": "candidate",
            }
        }
        headers = self._auth_headers(api_key) if api_key else None
        resp = self._retry_post(
            f"/api/v1/rooms/{room_id}/messages",
            body,
            client=self._orchestrator,
            label="submit_message",
            headers=headers,
        )
        self._assert_ok(resp, "submit_message")
        logger.debug("Message submitted", extra={"msg_id": msg_id[:8], "agent_id": agent_id[:8]})
        return msg_id

    def process_turn(self, room_id: str, api_key: Optional[str] = None) -> TurnResult:
        """
        Trigger orchestrator turn processing (LLM scoring + selection).

        Args:
            room_id: The room to process
            api_key: Agent API key for auth headers

        Returns:
            TurnResult with the winning message and score
        """
        headers = self._auth_headers(api_key) if api_key else None
        resp = self._retry_post(
            f"/api/v1/rooms/{room_id}/process-turn",
            {},
            client=self._orchestrator,
            label="process_turn",
            attempts=2,
            delay=2.0,
            headers=headers,
        )
        self._assert_ok(resp, "process_turn")
        raw = resp.json()
        # Backend wraps the result under a "data" envelope:
        # { success: true, data: { status, selected_message_id, ... } }
        # Unwrap it; fall back to the top-level dict for backward compat.
        data = raw.get("data", raw)
        result = TurnResult(
            status=data.get("status", "unknown"),
            selected_message_id=data.get("selected_message_id"),
            selected_agent_id=data.get("selected_agent_id"),
            score=data.get("score") or 0.0,
            turn_number=data.get("turn_number"),
        )
        logger.info(
            "Turn processed",
            extra={
                "status": result.status,
                "score": f"{result.score:.1f}",
                "winner": (result.selected_message_id or "")[:8],
            },
        )
        return result

    def submit_and_process(
        self,
        room_id: str,
        host_agent_id: str,
        host_text: str,
        cohost_agent_id: str,
        cohost_text: str,
        host_api_key: Optional[str] = None,
    ) -> TurnResult:
        """
        Convenience: submit both agent messages then process the turn.

        Returns:
            TurnResult from the orchestrator
        """
        self.submit_message(room_id, host_agent_id, host_text, api_key=host_api_key)
        self.submit_message(room_id, cohost_agent_id, cohost_text, api_key=host_api_key)
        # Small delay to let orchestrator queue settle
        time.sleep(0.3)
        return self.process_turn(room_id, api_key=host_api_key)

    def play_audio(
        self,
        room_id: str,
        message_id: str,
        text: str,
        agent_id: str,
        api_key: str,
        agent_name: str = "",
    ) -> int:
        """
        Trigger backend TTS to synthesize the audio and emit it to the live room.

        The backend uses `agentName` (not `agentId`) for voice selection:
          - name contains "mira" (case-insensitive) → ELEVENLABS_VOICE_B
          - otherwise → ELEVENLABS_VOICE_A (Alex / default)

        Returns:
            Estimated speech duration in milliseconds (0 if TTS disabled)
        """
        resp = self._backend.post(
            f"/api/v1/rooms/{room_id}/tts",
            json={
                "messageId": message_id,
                "text": text,
                "agentId": agent_id,
                "agentName": agent_name,
            },
            headers=self._auth_headers(api_key),
        )
        self._assert_ok(resp, "play_audio")
        data = resp.json()
        duration_ms = data.get("durationMs", 0)

        # Diagnostic logging for TTS pipeline health
        if duration_ms == 0:
            logger.warning(
                "TTS returned 0 duration — audio will NOT be heard by listeners. "
                "Check: (1) ENABLE_TTS=true in backend env, "
                "(2) ELEVENLABS_API_KEY is set, "
                "(3) ElevenLabs API quota not exhausted",
                extra={
                    "room_id": room_id[:8],
                    "agent_name": agent_name,
                    "text_length": len(text),
                    "response": {k: v for k, v in data.items() if k != "audioBase64"},
                },
            )
        else:
            logger.info(
                "TTS audio synthesized",
                extra={
                    "room_id": room_id[:8],
                    "agent_name": agent_name,
                    "duration_ms": duration_ms,
                    "text_length": len(text),
                },
            )

        return duration_ms

    # ── Room Events (for music breaks, etc.) ─────────────────────────────────

    def emit_room_event(
        self,
        room_id: str,
        event_type: str,
        payload: dict,
        auth_key: str = "",
    ) -> bool:
        """
        Emit an event into a room's event stream.

        Args:
            room_id: Target room
            event_type: Event type string (e.g. 'MUSIC_BREAK')
            payload: Arbitrary JSON payload
            auth_key: API key for auth header

        Returns:
            True if event was accepted
        """
        headers = self._auth_headers(auth_key) if auth_key else {"Content-Type": "application/json", "Accept-Encoding": "identity"}
        try:
            resp = self._backend.post(
                f"/api/v1/rooms/{room_id}/events",
                json={"type": event_type, "payload": payload},
                headers=headers,
            )
            if resp.status_code >= 300:
                logger.warning(
                    "Room event rejected",
                    extra={"room_id": room_id[:8], "type": event_type, "status": resp.status_code},
                )
                return False
            return True
        except Exception as exc:
            logger.warning("Room event emit failed", extra={"error": str(exc)})
            return False

    def notify_room_redirect(
        self,
        old_room_id: str,
        new_room_id: str,
        api_key: str = "",
    ) -> None:
        """
        Tell all Socket.IO clients connected to old_room_id to navigate
        to new_room_id.  Called by radio-runner after a room respawn so
        listeners are not stranded on the dead room's URL.

        Non-fatal — failure is logged but does not stop the show.
        """
        try:
            resp = self._backend.post(
                f"/api/v1/rooms/{old_room_id}/redirect",
                json={"newRoomId": new_room_id},
                headers=self._auth_headers(api_key),
            )
            if resp.status_code < 300:
                logger.info(
                    "Room redirect notification sent",
                    extra={"old": old_room_id[:8], "new": new_room_id[:8]},
                )
            else:
                logger.warning(
                    "Room redirect notification rejected",
                    extra={"status": resp.status_code},
                )
        except Exception as exc:
            logger.warning(
                "Room redirect notify failed (non-fatal)",
                extra={"error": str(exc)},
            )

    # ── Internals ────────────────────────────────────────────────────────────

    def _auth_headers(self, api_key: str) -> dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
            "Accept-Encoding": "identity",
        }
        if self.system_secret:
            headers["X-Buzz-System-Secret"] = self.system_secret
        return headers

    @staticmethod
    def _assert_ok(resp: httpx.Response, context: str) -> None:
        if resp.status_code >= 300:
            try:
                body = resp.json()
            except Exception:
                body = resp.text[:500]
            raise RuntimeError(
                f"[{context}] HTTP {resp.status_code}: {body}"
            )

    def _retry_get(
        self,
        path: str,
        headers: Optional[dict[str, str]] = None,
        label: str = "",
        attempts: int = 4,
        delay: float = 1.0,
    ) -> httpx.Response:
        """GET with retry logic for transient connection failures."""
        last_exc: Optional[Exception] = None
        for i in range(attempts):
            try:
                resp = self._backend.get(path, headers=headers, timeout=10.0)
                if resp.status_code < 500:
                    return resp
                logger.warning(
                    f"Retry {i+1}/{attempts} for {label}",
                    extra={"status": resp.status_code},
                )
            except Exception as exc:
                last_exc = exc
                logger.warning(f"Retry {i+1}/{attempts} for {label}", extra={"error": str(exc)})
            if i < attempts - 1:
                time.sleep(delay * (i + 1))
        raise last_exc or RuntimeError(f"All {attempts} retries failed for {label}")

    def _retry_post(
        self,
        path: str,
        body: dict,
        client: httpx.Client,
        label: str = "",
        attempts: int = 4,
        delay: float = 0.75,
        headers: Optional[dict[str, str]] = None,
    ) -> httpx.Response:
        """POST with retry logic for transient failures."""
        default_headers = {"Content-Type": "application/json", "Accept-Encoding": "identity"}
        if headers:
            default_headers.update(headers)
        last_exc: Optional[Exception] = None
        for i in range(attempts):
            try:
                resp = client.post(
                    path,
                    json=body,
                    headers=default_headers,
                )
                if resp.status_code < 500:
                    return resp
                logger.warning(
                    f"Retry {i+1}/{attempts} for {label}",
                    extra={"status": resp.status_code, "body": resp.text[:500]},
                )
            except Exception as exc:
                last_exc = exc
                logger.warning(f"Retry {i+1}/{attempts} for {label}", extra={"error": str(exc)})
            if i < attempts - 1:
                time.sleep(delay * (i + 1))
        raise last_exc or RuntimeError(f"All {attempts} retries failed for {label}")
