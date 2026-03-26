#!/usr/bin/env python3
"""
orchestrator_bridge.py
Thin adapter between the radio-runner and the ClawZz API + Orchestrator.

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

AGENT_CREDENTIALS_FILE: str = os.environ.get(
    "RADIO_AGENTS_FILE",
    str(Path(__file__).parent / ".radio_agents.json"),
)

logger = logging.getLogger(__name__)

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
    HTTP adapter for the ClawZz backend API and orchestrator.

    Usage:
        bridge = OrchestratorBridge(
            backend_url="http://localhost:4000",
            orchestrator_url="http://localhost:5000",
        )
        host = bridge.register_agent("RadioHost", "radio_host_001")
        room_id = bridge.create_room(host, "debate", "Today's top news")
    """

    def __init__(
        self,
        backend_url: str = "http://localhost:4000",
        orchestrator_url: str = "http://localhost:5000",
        timeout: float = 30.0,
    ) -> None:
        self._backend = httpx.Client(
            base_url=backend_url.rstrip("/"),
            timeout=timeout,
        )
        self._orchestrator = httpx.Client(
            base_url=orchestrator_url.rstrip("/"),
            timeout=60.0,
        )

    def close(self) -> None:
        """Release HTTP connections."""
        self._backend.close()
        self._orchestrator.close()

    # ── Agent Credential Persistence ─────────────────────────────────────────

    def register_or_reuse_agent(self, name: str, username: str) -> "RegisteredAgent":
        """
        Return a cached agent if credentials exist and the backend confirms the
        agent is still valid.  Falls back to registering a fresh agent.

        Credentials are stored in RADIO_AGENTS_FILE (.radio_agents.json by default)
        so restarting the runner doesn't accumulate orphaned agent rows.
        """
        creds = self._load_agent_credentials()
        cached = creds.get(username)
        if cached:
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

        Args:
            name: Display name (e.g. "Alex — RadioHost")
            username: Unique username (e.g. "radio_alex_abc123")

        Returns:
            RegisteredAgent with id and api_key
        """
        resp = self._backend.post(
            "/api/v1/agents/register",
            json={
                "name": name,
                "username": username,
                "description": f"Radio runner agent: {name}",
            },
            headers={"Content-Type": "application/json"},
        )
        self._assert_ok(resp, "register_agent")
        data = resp.json()
        agent = data["agent"]
        logger.info("Agent registered", extra={"id": agent["id"][:8], "name": name})
        return RegisteredAgent(
            id=agent["id"],
            api_key=agent["api_key"],
            name=name,
        )

    # ── Room Lifecycle ───────────────────────────────────────────────────────

    def create_room(
        self,
        host: RegisteredAgent,
        room_type: str = "debate",
        objective: str = "Live news discussion",
        spawn_fee: int = 250,
    ) -> str:
        """
        Create a new room via the backend API.

        Returns:
            Room ID (UUID string)
        """
        resp = self._backend.post(
            "/api/v1/rooms",
            json={
                "type": room_type,
                "objective": objective,
                "spawnFee": spawn_fee,
                "recordingEnabled": True,
            },
            headers=self._auth_headers(host.api_key),
        )
        self._assert_ok(resp, "create_room")
        data = resp.json()
        room_id = data["data"]["room"]["id"]
        status = data["data"]["room"]["status"]
        logger.info("Room created", extra={"room_id": room_id[:8], "status": status})
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

    # ── Message Submission & Turn Processing ─────────────────────────────────

    def submit_message(
        self,
        room_id: str,
        agent_id: str,
        text: str,
    ) -> str:
        """
        Submit a message to the orchestrator for scoring.

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
                "status": "submitted",
            }
        }
        resp = self._retry_post(
            f"/api/v1/rooms/{room_id}/messages",
            body,
            client=self._orchestrator,
            label="submit_message",
        )
        self._assert_ok(resp, "submit_message")
        logger.debug("Message submitted", extra={"msg_id": msg_id[:8], "agent_id": agent_id[:8]})
        return msg_id

    def process_turn(self, room_id: str) -> TurnResult:
        """
        Trigger orchestrator turn processing (LLM scoring + selection).

        Returns:
            TurnResult with the winning message and score
        """
        resp = self._retry_post(
            f"/api/v1/rooms/{room_id}/process-turn",
            {},
            client=self._orchestrator,
            label="process_turn",
            attempts=2,
            delay=2.0,
        )
        self._assert_ok(resp, "process_turn")
        data = resp.json()
        result = TurnResult(
            status=data.get("status", "unknown"),
            selected_message_id=data.get("selected_message_id"),
            selected_agent_id=data.get("selected_agent_id"),
            score=data.get("score", 0.0),
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
    ) -> TurnResult:
        """
        Convenience: submit both agent messages then process the turn.

        Returns:
            TurnResult from the orchestrator
        """
        self.submit_message(room_id, host_agent_id, host_text)
        self.submit_message(room_id, cohost_agent_id, cohost_text)
        # Small delay to let orchestrator queue settle
        time.sleep(0.3)
        return self.process_turn(room_id)

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
        headers = self._auth_headers(auth_key) if auth_key else {"Content-Type": "application/json"}
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

    # ── Internals ────────────────────────────────────────────────────────────

    @staticmethod
    def _auth_headers(api_key: str) -> dict[str, str]:
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        }

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

    def _retry_post(
        self,
        path: str,
        body: dict,
        client: httpx.Client,
        label: str = "",
        attempts: int = 4,
        delay: float = 0.75,
    ) -> httpx.Response:
        """POST with retry logic for transient failures."""
        last_exc: Optional[Exception] = None
        for i in range(attempts):
            try:
                resp = client.post(
                    path,
                    json=body,
                    headers={"Content-Type": "application/json"},
                )
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
                time.sleep(delay)
        raise last_exc or RuntimeError(f"All {attempts} retries failed for {label}")
