#!/usr/bin/env python3
"""
livestream_bridge.py
HTTP adapter between the video-livestream-runner and the Buzz backend API.

Handles agent registration, livestream CRUD, heartbeat, and stream lifecycle.

Architecture placement: scripts/video-livestream-runner/
Depends on: httpx
Used by: video_runner.py, stream_keeper.py
"""

import json
import logging
import os
import time
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Optional

import httpx

AGENT_CREDENTIALS_FILE: str = os.environ.get(
    "LIVESTREAM_AGENTS_FILE",
    str(Path(__file__).parent / ".livestream_agents.json"),
)
logger = logging.getLogger(__name__)


@dataclass
class RegisteredAgent:
    id: str
    api_key: str
    name: str


@dataclass
class Livestream:
    id: str
    stream_key: str
    stream_server_url: str
    status: str
    title: str
    category: str


class LivestreamBridge:
    """
    HTTP adapter for the Buzz backend livestream API.

    Usage:
        bridge = LivestreamBridge()
        bridge.wait_for_backend()
        agent = bridge.register_or_reuse_agent("NewsAnchor", "video_anchor_01")
        stream = bridge.create_livestream(agent, "Buzz News Live", "News")
    """

    def __init__(
        self,
        backend_url: Optional[str] = None,
        timeout: float = 30.0,
    ) -> None:
        self.backend_url = (
            backend_url or
            os.environ.get("LIVESTREAM_BACKEND_URL", "https://clawzz-backend-live.up.railway.app")
        ).rstrip("/")

        self._client = httpx.Client(
            base_url=self.backend_url,
            timeout=timeout,
        )

    def close(self) -> None:
        self._client.close()

    # ── Startup Health Check ──────────────────────────────────────────────────

    def wait_for_backend(
        self,
        max_attempts: int = 12,
        initial_delay: float = 2.0,
        max_delay: float = 30.0,
    ) -> bool:
        delay = initial_delay
        for attempt in range(1, max_attempts + 1):
            try:
                resp = self._client.get("/health", timeout=5.0)
                if resp.status_code < 500:
                    logger.info(
                        "Backend health check passed (attempt %d/%d, status %d)",
                        attempt, max_attempts, resp.status_code,
                    )
                    return True
            except Exception as exc:
                logger.warning(
                    "Backend not ready yet (attempt %d/%d): %s",
                    attempt, max_attempts, exc,
                )
            if attempt < max_attempts:
                logger.info("Retrying in %.1fs", delay)
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
        pre_auth_key: Optional[str] = None,
    ) -> RegisteredAgent:
        if pre_auth_key:
            logger.info("Using pre-authorized API key for '%s'", username)
            try:
                resp = self._retry_get(
                    "/api/v1/auth/me",
                    headers=self._auth_headers(pre_auth_key),
                    label=f"auth_me({username})",
                )
                if resp.status_code < 300:
                    agent_data = resp.json().get("data")
                    if agent_data:
                        return RegisteredAgent(
                            id=agent_data["id"],
                            api_key=pre_auth_key,
                            name=agent_data["name"],
                        )
                logger.warning("Pre-auth key invalid for '%s' — re-registering", username)
            except Exception as exc:
                logger.warning("Pre-auth validation failed for '%s': %s", username, exc)

        creds = self._load_agent_credentials()
        cached = creds.get(username)
        if cached:
            if not cached.get("api_key", "").startswith("beely_"):
                logger.info("Cached key for '%s' uses legacy format — re-registering", username)
            else:
                try:
                    resp = self._client.get(
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

    def register_agent(self, name: str, username: str) -> RegisteredAgent:
        payload = {
            "name": name,
            "username": username,
            "description": "Video livestream anchor agent",
        }

        resp = self._client.post(
            "/api/v1/agents/register",
            json=payload,
            headers={"Content-Type": "application/json"},
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

    # ── Livestream Lifecycle ─────────────────────────────────────────────────

    def create_livestream(
        self,
        agent: RegisteredAgent,
        title: str = "Buzz News Live",
        category: str = "News",
        description: str = "",
    ) -> Livestream:
        resp = self._client.post(
            "/api/v1/livestreams",
            json={
                "title": title,
                "category": category,
                "description": description,
                "streamCapabilities": ["video", "audio", "chat"],
            },
            headers=self._auth_headers(agent.api_key),
        )
        self._assert_ok(resp, "create_livestream")
        data = resp.json()["data"]
        stream = data["stream"]

        # IMPORTANT: streamKey is a secret. It is used both as the RTMP path suffix
        # and for publish authorization via the backend's /auth-publish endpoint.
        livestream = Livestream(
            id=stream["id"],
            stream_key=data["streamKey"],
            stream_server_url=data["streamServerUrl"],
            status=stream["status"],
            title=stream["title"],
            category=stream["category"],
        )
        logger.info(
            "Livestream created",
            extra={"stream_id": livestream.id[:8], "title": title, "category": category},
        )
        return livestream

    def get_livestream_status(self, stream_id: str, agent: RegisteredAgent) -> str:
        resp = self._client.get(
            f"/api/v1/livestreams/{stream_id}",
            headers=self._auth_headers(agent.api_key),
        )
        self._assert_ok(resp, "get_livestream_status")
        data = resp.json()["data"]
        return data["stream"]["status"]

    def update_livestream(
        self,
        stream_id: str,
        agent: RegisteredAgent,
        status: Optional[str] = None,
        title: Optional[str] = None,
    ) -> None:
        body: dict[str, str] = {}
        if status:
            body["status"] = status
        if title:
            body["title"] = title
        if not body:
            return
        resp = self._client.put(
            f"/api/v1/livestreams/{stream_id}",
            json=body,
            headers=self._auth_headers(agent.api_key),
        )
        self._assert_ok(resp, "update_livestream")
        logger.info("Livestream updated", extra={"stream_id": stream_id[:8], **body})

    def send_heartbeat(self, stream_id: str, agent: RegisteredAgent) -> bool:
        try:
            resp = self._client.post(
                f"/api/v1/livestreams/{stream_id}/heartbeat",
                headers=self._auth_headers(agent.api_key),
            )
            if resp.status_code >= 300:
                logger.warning(
                    "Heartbeat rejected",
                    extra={"stream_id": stream_id[:8], "status": resp.status_code},
                )
                return False
            logger.debug("Heartbeat sent", extra={"stream_id": stream_id[:8]})
            return True
        except Exception as exc:
            logger.warning("Heartbeat failed", extra={"error": str(exc)})
            return False

    def confirm_ingest_started(self, stream_id: str, agent: RegisteredAgent) -> bool:
        """
        Tell the backend that this stream has successfully started publishing
        real video frames. This is the definitive "broadcasting" signal that
        updates ingest_active = TRUE on the backend side.

        Should be called after:
          1. MediaMixer start() succeeded (FFmpeg spawned, frames flowing)
          2. OR after the first pre-flight publish test passes

        Returns True if the backend acknowledged the ingest start.
        """
        try:
            resp = self._client.post(
                f"/api/v1/livestreams/{stream_id}/ingest-started",
                headers=self._auth_headers(agent.api_key),
                timeout=10.0,
            )
            if resp.status_code < 300:
                logger.info("Ingest started confirmed on backend", extra={"stream_id": stream_id[:8]})
                return True
            logger.warning(
                "Ingest confirmation rejected",
                extra={"stream_id": stream_id[:8], "status": resp.status_code},
            )
            return False
        except Exception as exc:
            logger.warning("Ingest confirmation failed", extra={"error": str(exc)})
            return False

    def build_rtmp_url(self, livestream: Livestream) -> str:
        """
        Construct the full RTMP ingest URL that the video runner should publish to.

        Format: {streamServerUrl}/{streamKey}
        Example: rtmp://buzz-rtmp-server.../app/abc123def456...

        This URL (including the secret streamKey) is sent to nginx-rtmp.
        The backend's /auth-publish endpoint validates the streamKey before
        allowing the publish. Keep the streamKey secret.
        """
        return f"{livestream.stream_server_url.rstrip('/')}/{livestream.stream_key}"

    # ── Audio Synthesis ──────────────────────────────────────────────────────

    def synthesize_speech(
        self,
        text: str,
        agent: RegisteredAgent,
        voice_name: str = "",
        stream_id: str = "",
    ) -> Optional[bytes]:
        """
        Synthesize text to speech via the backend TTS endpoint.

        Returns raw MP3 bytes on success, None on failure.
        """
        try:
            resp = self._client.post(
                "/api/v1/tts/synthesize",
                json={
                    "text": text,
                    "agentName": voice_name or agent.name,
                },
                headers=self._auth_headers(agent.api_key),
                timeout=60.0,
            )
            if resp.status_code >= 300:
                logger.warning(
                    "TTS synthesis failed",
                    extra={"status": resp.status_code, "body": resp.text[:200]},
                )
                return None

            data = resp.json()
            audio_base64 = data.get("audioBytes")

            if not audio_base64:
                logger.info(
                    "TTS returned no audio (disabled or empty synthesis)",
                    extra={"duration_ms": data.get("durationMs", 0), "provider": data.get("provider", "none")},
                )
                return None

            import base64
            audio_bytes = base64.b64decode(audio_base64)
            logger.info(
                "TTS audio synthesized successfully",
                extra={"bytes": len(audio_bytes), "duration_ms": data.get("durationMs", 0)},
            )
            return audio_bytes

        except Exception as exc:
            logger.warning("TTS synthesis error: %s", exc)
            return None

    # ── Internals ────────────────────────────────────────────────────────────

    def _auth_headers(self, api_key: str) -> dict[str, str]:
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
            raise RuntimeError(f"[{context}] HTTP {resp.status_code}: {body}")

    def _retry_get(
        self,
        path: str,
        headers: Optional[dict[str, str]] = None,
        label: str = "",
        attempts: int = 4,
        delay: float = 1.0,
    ) -> httpx.Response:
        last_exc: Optional[Exception] = None
        for i in range(attempts):
            try:
                resp = self._client.get(path, headers=headers, timeout=10.0)
                if resp.status_code < 500:
                    return resp
            except Exception as exc:
                last_exc = exc
                logger.warning("Retry %d/%d for %s: %s", i + 1, attempts, label, exc)
            if i < attempts - 1:
                time.sleep(delay * (i + 1))
        raise last_exc or RuntimeError(f"All {attempts} retries failed for {label}")
