#!/usr/bin/env python3
"""
room_keeper.py
Watchdog that monitors room health and auto-respawns dead rooms.

Runs in a background thread alongside the main radio turn loop.
When the active room dies (status != 'live'), it creates a new room
and signals the main loop to switch to the new room_id.

Architecture placement: scripts/radio-runner/
Depends on: orchestrator_bridge
Used by: radio_runner.py
"""

import logging
import os
import threading
import time
from dataclasses import dataclass
from typing import Callable, Optional

logger = logging.getLogger(__name__)

# ── Configuration ────────────────────────────────────────────────────────────

DEFAULT_CHECK_INTERVAL: int = int(os.environ.get("ROOM_CHECK_INTERVAL_SECONDS", "60"))
MAX_RESPAWN_ATTEMPTS: int = int(os.environ.get("MAX_RESPAWN_ATTEMPTS", "5"))

# Statuses that indicate the room is alive
ALIVE_STATUSES: set[str] = {"live", "pending"}


# ── Data Models ──────────────────────────────────────────────────────────────

@dataclass
class RespawnResult:
    """Result of a room respawn operation."""

    old_room_id: str
    new_room_id: str
    attempt: int
    success: bool
    error: Optional[str] = None


# ── RoomKeeper ───────────────────────────────────────────────────────────────

class RoomKeeper:
    """
    Background watchdog that monitors a room and respawns on death.

    Usage:
        keeper = RoomKeeper(
            bridge=bridge,
            on_room_changed=lambda old, new: print(f"Switched {old} -> {new}"),
        )
        keeper.start(room_id, host_agent, cohost_agent, room_type, objective)
        # ... main loop runs ...
        keeper.stop()
    """

    def __init__(
        self,
        bridge,  # OrchestratorBridge
        on_room_changed: Optional[Callable[[str, str], None]] = None,
        check_interval: int = DEFAULT_CHECK_INTERVAL,
        max_attempts: int = MAX_RESPAWN_ATTEMPTS,
    ) -> None:
        self._bridge = bridge
        self._on_room_changed = on_room_changed
        self._check_interval = check_interval
        self._max_attempts = max_attempts

        self._room_id: str = ""
        self._host_agent = None
        self._cohost_agent = None
        self._title: str = "Beely Radio Live"
        self._room_type: str = "debate"
        self._objective: str = "Live news discussion"

        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._respawn_count: int = 0
        self._failed: bool = False
        self._lock = threading.Lock()

    # ── Public API ───────────────────────────────────────────────────────────

    @property
    def room_id(self) -> str:
        """Current active room ID (thread-safe read)."""
        with self._lock:
            return self._room_id

    @property
    def respawn_count(self) -> int:
        """Total number of respawn operations performed."""
        with self._lock:
            return self._respawn_count

    @property
    def failed(self) -> bool:
        """True if all respawn attempts were exhausted and the show cannot continue."""
        return self._failed

    def start(
        self,
        room_id: str,
        host_agent,
        cohost_agent,
        title: str = "Beely Radio Live",
        room_type: str = "debate",
        objective: str = "Live news discussion",
    ) -> None:
        """
        Start the watchdog thread.

        Args:
            room_id: Initial room to monitor
            host_agent: RegisteredAgent for room creation
            cohost_agent: RegisteredAgent to join the new room
            title: Room title for respawning
            room_type: Room type for respawning
            objective: Room objective for respawning
        """
        with self._lock:
            self._room_id = room_id
        self._host_agent = host_agent
        self._cohost_agent = cohost_agent
        self._title = title
        self._room_type = room_type
        self._objective = objective

        self._stop_event.clear()
        self._thread = threading.Thread(
            target=self._watch_loop,
            name="room-keeper",
            daemon=True,
        )
        self._thread.start()
        logger.info(
            "RoomKeeper started",
            extra={"room_id": room_id[:8], "interval": self._check_interval},
        )

    def stop(self) -> None:
        """Stop the watchdog thread."""
        self._stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=10)
        logger.info("RoomKeeper stopped")

    def update_room_id(self, new_room_id: str) -> None:
        """
        Update the room ID being monitored.
        Call this if the main loop creates a new room externally.
        """
        with self._lock:
            self._room_id = new_room_id
        logger.info("RoomKeeper updated to new room", extra={"room_id": new_room_id[:8]})

    # ── Watch Loop ───────────────────────────────────────────────────────────

    def _watch_loop(self) -> None:
        """Background thread: periodically check room health, respawn if dead."""
        backoff: float = 1.0

        while not self._stop_event.is_set():
            self._stop_event.wait(self._check_interval)
            if self._stop_event.is_set():
                break

            current_room_id = self.room_id
            if not current_room_id:
                continue

            try:
                status = self._bridge.get_room_status(current_room_id)

                if status in ALIVE_STATUSES:
                    backoff = 1.0  # reset backoff on healthy check
                    # Send heartbeat to keep room visible in discovery
                    try:
                        self._bridge.send_heartbeat(
                            current_room_id,
                            self._host_agent.api_key if self._host_agent else "",
                        )
                    except Exception as hb_exc:
                        logger.warning("Heartbeat send failed", extra={"error": str(hb_exc)})
                    logger.debug(
                        "Room healthy",
                        extra={"room_id": current_room_id[:8], "status": status},
                    )
                    continue

                # Room is dead — attempt respawn
                logger.warning(
                    "Room dead — initiating respawn",
                    extra={"room_id": current_room_id[:8], "status": status},
                )
                result = self._respawn(current_room_id)

                if result.success:
                    backoff = 1.0
                    logger.info(
                        "Room respawned successfully",
                        extra={
                            "old": result.old_room_id[:8],
                            "new": result.new_room_id[:8],
                            "attempt": result.attempt,
                        },
                    )
                else:
                    # Exponential backoff on failure
                    backoff = min(backoff * 2, 60.0)
                    logger.error(
                        "Respawn failed — backing off",
                        extra={"backoff": backoff, "error": result.error},
                    )
                    self._stop_event.wait(backoff)

            except Exception as exc:
                logger.error(
                    "RoomKeeper error",
                    extra={"room_id": current_room_id[:8], "error": str(exc)},
                )
                backoff = min(backoff * 2, 60.0)
                self._stop_event.wait(backoff)

    # ── Respawn Logic ────────────────────────────────────────────────────────

    def _respawn(self, old_room_id: str) -> RespawnResult:
        """
        Create a new room, join the co-host, and notify listeners.

        Uses exponential backoff with MAX_RESPAWN_ATTEMPTS retries.
        """
        for attempt in range(1, self._max_attempts + 1):
            try:
                # Create new room
                new_room_id = self._bridge.create_room(
                    host=self._host_agent,
                    title=self._title,
                    room_type=self._room_type,
                    objective=self._objective,
                )

                # Join co-host
                self._bridge.join_room(new_room_id, self._cohost_agent)
                time.sleep(1.0)  # let orchestrator register

                # Update internal state
                with self._lock:
                    self._room_id = new_room_id
                    self._respawn_count += 1

                # Notify callback
                if self._on_room_changed:
                    try:
                        self._on_room_changed(old_room_id, new_room_id)
                    except Exception as cb_exc:
                        logger.warning(
                            "on_room_changed callback failed",
                            extra={"error": str(cb_exc)},
                        )

                return RespawnResult(
                    old_room_id=old_room_id,
                    new_room_id=new_room_id,
                    attempt=attempt,
                    success=True,
                )

            except Exception as exc:
                logger.warning(
                    f"Respawn attempt {attempt}/{self._max_attempts} failed",
                    extra={"error": str(exc)},
                )
                if attempt < self._max_attempts:
                    time.sleep(2.0 * attempt)  # linear backoff between retries

        # All attempts exhausted — mark as permanently failed and notify main loop
        self._failed = True
        logger.critical(
            "RoomKeeper permanently failed — all respawn attempts exhausted",
            extra={"old_room_id": old_room_id[:8], "attempts": self._max_attempts},
        )
        if self._on_room_changed:
            try:
                self._on_room_changed(old_room_id, "")
            except Exception as cb_exc:
                logger.warning("on_room_changed failure callback failed", extra={"error": str(cb_exc)})

        return RespawnResult(
            old_room_id=old_room_id,
            new_room_id="",
            attempt=self._max_attempts,
            success=False,
            error=f"All {self._max_attempts} respawn attempts exhausted",
        )
