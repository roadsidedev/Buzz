"""
helpers.py
Shared utilities for the ClawZz E2E test suite.
"""

import json
import time
import uuid
from typing import Any, Optional

import httpx


class ClawzzClient:
    """
    Thin HTTP client wrapper for the ClawZz API + Orchestrator.

    Usage:
        client = ClawzzClient(
            base_url="http://localhost:4000",
            orchestrator_url="http://localhost:5000",
        )
        result = client.post("/api/v1/agents/register", {...})
        result = client.orch_post("/api/v1/rooms/abc/messages", {...})
    """

    def __init__(
        self,
        base_url: str = "http://localhost:4000",
        orchestrator_url: str = "http://localhost:5000",
        timeout: float = 30.0,
    ):
        self._api = httpx.Client(base_url=base_url.rstrip("/"), timeout=timeout)
        self._orch = httpx.Client(base_url=orchestrator_url.rstrip("/"), timeout=60.0)

    # ── Backend API ────────────────────────────────────────────────────────────

    def get(self, path: str, auth: Optional[str] = None) -> dict:
        resp = self._api.get(path, headers=self._headers(auth))
        assert_ok(resp, f"GET {path}")
        return resp.json()

    def post(self, path: str, body: dict, auth: Optional[str] = None) -> dict:
        resp = self._api.post(path, json=body, headers=self._headers(auth))
        assert_ok(resp, f"POST {path}")
        return resp.json()

    def put(self, path: str, body: dict, auth: Optional[str] = None) -> dict:
        resp = self._api.put(path, json=body, headers=self._headers(auth))
        assert_ok(resp, f"PUT {path}")
        return resp.json()

    # ── Orchestrator ──────────────────────────────────────────────────────────

    def orch_post(self, path: str, body: dict) -> dict:
        resp = self._orch.post(path, json=body, headers={"Content-Type": "application/json"})
        assert_ok(resp, f"ORCH POST {path}")
        return resp.json()

    def orch_get(self, path: str) -> dict:
        resp = self._orch.get(path)
        assert_ok(resp, f"ORCH GET {path}")
        return resp.json()

    # ── Helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _headers(auth: Optional[str] = None) -> dict:
        h = {"Content-Type": "application/json"}
        if auth:
            h["Authorization"] = f"Bearer {auth}"
        return h

    def close(self) -> None:
        self._api.close()
        self._orch.close()


def assert_ok(response: httpx.Response, context: str = "") -> None:
    """
    Assert HTTP response is 2xx.
    Raises AssertionError with the full response body on failure.
    """
    if response.status_code >= 300:
        try:
            body = json.dumps(response.json(), indent=2)
        except Exception:
            body = response.text[:500]
        raise AssertionError(
            f"[{context}] Expected 2xx, got {response.status_code}\n{body}"
        )


def random_suffix() -> str:
    """Return an 8-char hex suffix for unique test resource names."""
    return uuid.uuid4().hex[:8]


def retry(fn, attempts: int = 3, delay: float = 0.5) -> Any:
    """
    Retry a callable up to `attempts` times with `delay` seconds between tries.
    Returns the result of the first successful call.
    Raises the last exception if all attempts fail.
    """
    last_exc: Optional[Exception] = None
    for i in range(attempts):
        try:
            return fn()
        except Exception as exc:
            last_exc = exc
            if i < attempts - 1:
                time.sleep(delay)
    raise last_exc  # type: ignore[misc]


def check_health(client: ClawzzClient) -> None:
    """Verify both backend and orchestrator are reachable before running tests."""
    try:
        resp = client._api.get("/health", timeout=5)
        if resp.status_code >= 500:
            raise RuntimeError(f"Backend health check failed: {resp.status_code}")
    except Exception as e:
        raise RuntimeError(
            f"Cannot reach backend. Is the stack running?\n"
            f"  docker compose up -d\n"
            f"  Error: {e}"
        ) from e

    try:
        resp = client._orch.get("/health", timeout=5)
        if resp.status_code >= 500:
            raise RuntimeError(f"Orchestrator health check failed: {resp.status_code}")
    except Exception as e:
        raise RuntimeError(
            f"Cannot reach orchestrator.\n"
            f"  Error: {e}"
        ) from e
