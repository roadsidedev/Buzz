#!/usr/bin/env python3
"""
radio_runner.py
Top-level daemon that wires all radio-runner modules into a 24/7 turn loop.

Main loop (every 20-30s):
  1. NewsPoller.get_latest()             → fresh headlines
  2. DialogueEngine.generate_turn()     → HOST + COHOST messages
  3. OrchestratorBridge.submit_and_process() → winner text
  4. MusicScheduler check                → optionally inject music break
  5. RoomKeeper runs in background       → monitors + respawns

Architecture placement: scripts/radio-runner/
Depends on: news_poller, dialogue_engine, orchestrator_bridge,
            music_scheduler, room_keeper
Used by: CLI / systemd / Docker

Usage:
  python radio_runner.py
  python radio_runner.py --turn-interval 25 --break-interval 8
  python radio_runner.py --max-turns 20  (auto-stop after 20 turns — good for testing)
"""

import argparse
import logging
import os
import signal
import sys
import time
import uuid
from collections import deque
from typing import Callable, Optional

from dotenv import load_dotenv

# Load .env from script directory
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from dialogue_engine import DialogueEngine, DialogueTurn
from event_listener import EventQueue, WebhookServer
from music_scheduler import MusicScheduler
from news_poller import NewsPoller
from orchestrator_bridge import OrchestratorBridge, RegisteredAgent
from room_keeper import RoomKeeper

# ── Logging ──────────────────────────────────────────────────────────────────

LOG_FORMAT = "[%(asctime)s] [%(name)-18s] [%(levelname)-5s] %(message)s"


def setup_logging(level: str = "INFO") -> None:
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format=LOG_FORMAT,
        datefmt="%H:%M:%S",
        stream=sys.stdout,
    )


logger = logging.getLogger("radio_runner")


# ── Configuration ────────────────────────────────────────────────────────────

BACKEND_URL = os.environ.get("BEELY_BACKEND_URL", "https://clawzz-backend-live.up.railway.app")
# Orchestrator is now part of the backend — keep env var for backward compat but unused
ORCHESTRATOR_URL = os.environ.get("ORCHESTRATOR_URL")
NEWS_POLL_INTERVAL = int(os.environ.get("NEWS_POLL_INTERVAL_SECONDS", "180"))  # 3 min


# ── Main Loop ────────────────────────────────────────────────────────────────

class RadioRunner:
    """
    Orchestrates the full radio show: news → dialogue → scoring → music breaks.

    Wires together NewsPoller, DialogueEngine, OrchestratorBridge,
    MusicScheduler, and RoomKeeper into a single turn loop.
    """

    def __init__(
        self,
        turn_interval: int = 25,
        break_interval: int = 8,
        break_duration: int = 120,
        room_type: str = "debate",
        max_turns: int = 0,
    ) -> None:
        self._turn_interval = turn_interval
        self._room_type = room_type
        self._max_turns = max_turns
        self._running = False
        self._turn_count = 0
        self._history: deque[DialogueTurn] = deque(maxlen=10)

        # ── Initialize modules ───────────────────────────────────────────────
        self._poller = NewsPoller()
        self._engine = DialogueEngine()
        self._bridge = OrchestratorBridge(
            backend_url=BACKEND_URL,
            orchestrator_url=ORCHESTRATOR_URL,  # None = use backend_url
        )
        self._scheduler = MusicScheduler(
            break_interval=break_interval,
            break_duration=break_duration,
        )

        # ── Event handling (Phase 2) ─────────────────────────────────────────
        self._event_queue = EventQueue()
        self._webhook_server = WebhookServer(
            port=int(os.environ.get("WEBHOOK_PORT", "8080")),
            event_queue=self._event_queue,
        )

        # Room keeper — callback updates our internal room_id
        self._room_id: str = ""
        self._keeper = RoomKeeper(
            bridge=self._bridge,
            on_room_changed=self._handle_room_change,
        )

        # Agents — registered during setup
        self._host: Optional[RegisteredAgent] = None
        self._cohost: Optional[RegisteredAgent] = None

        # News cache — poll every N seconds, not every turn
        self._cached_headlines: list = []
        self._commit_headlines: Callable[[], None] = lambda: None
        self._last_news_poll: float = 0.0

    # ── Lifecycle ────────────────────────────────────────────────────────────

    def run(self) -> None:
        """Start the radio show. Blocks until stopped via SIGINT or max_turns."""
        self._running = True

        # Register signal handlers
        signal.signal(signal.SIGINT, self._handle_shutdown)
        signal.signal(signal.SIGTERM, self._handle_shutdown)

        try:
            self._setup()
            self._main_loop()
        except KeyboardInterrupt:
            pass
        finally:
            self._teardown()

    # ── Setup ────────────────────────────────────────────────────────────────

    def _setup(self) -> None:
        """Register agents, create initial room, start watchdog."""
        # Stable agent usernames — suffix only used in display name to distinguish
        # deployments.  Credentials are persisted across restarts so the same
        # agent rows are reused (avoids orphan accumulation and free-tier exhaustion).
        agent_suffix = os.environ.get("RADIO_AGENT_SUFFIX", "01")

        logger.info("=" * 60)
        logger.info("  Beely Radio Runner — Starting up")
        logger.info(f"  Backend      : {BACKEND_URL}")
        logger.info(f"  Turn interval: {self._turn_interval}s")
        logger.info(f"  Break every  : {self._scheduler.break_interval} turns")
        logger.info(f"  Max turns    : {self._max_turns or 'unlimited'}")
        logger.info("=" * 60)

        # 0. Wait for backend to be reachable (exponential backoff)
        logger.info("Waiting for backend health check...")
        self._bridge.wait_for_backend()

        # 1. Register HOST agent (Alex) — reuses cached credentials if available
        logger.info("Registering HOST agent (Alex)...")
        self._host = self._bridge.register_or_reuse_agent(
            name=f"Alex — RadioHost ({agent_suffix})",
            username=f"radio_alex_{agent_suffix}",
            pre_auth_key=os.environ.get("RADIO_HOST_API_KEY") or os.environ.get("radio_host_api"),
        )

        # 2. Register CO-HOST agent (Mira) — reuses cached credentials if available
        logger.info("Registering CO-HOST agent (Mira)...")
        self._cohost = self._bridge.register_or_reuse_agent(
            name=f"Mira — RadioCohost ({agent_suffix})",
            username=f"radio_mira_{agent_suffix}",
            pre_auth_key=os.environ.get("RADIO_COHOST_API_KEY") or os.environ.get("radio_cohost_api"),
        )

        # 3. Create initial room
        title = "Beely Radio — AI-First Live Streaming"
        objective = "Live news radio show — AI hosts discuss today's headlines"
        logger.info("Creating initial radio room...")
        self._room_id = self._bridge.create_room(
            host=self._host,
            title=title,
            room_type=self._room_type,
            objective=objective,
        )

        # 4. Co-host joins
        logger.info("Co-host joining room...")
        self._bridge.join_room(self._room_id, self._cohost)
        time.sleep(1.5)  # let orchestrator register

        # 5. Start room keeper watchdog
        self._keeper.start(
            room_id=self._room_id,
            host_agent=self._host,
            cohost_agent=self._cohost,
            title=title,
            room_type=self._room_type,
            objective=objective,
        )

        logger.info(f"Radio show ready — Room: {self._room_id[:8]}...")
        logger.info(f"Open in browser: {BACKEND_URL}/room/{self._room_id}/live")

        # 6. Start Webhook server for external interruptions
        self._webhook_server.start()

    # ── Main Loop ────────────────────────────────────────────────────────────

    def _main_loop(self) -> None:
        """Core turn loop: poll news, generate dialogue, score, repeat."""
        while self._running:
            try:
                # Check if room keeper permanently failed
                if self._keeper.failed:
                    logger.critical("Room keeper permanently failed — halting radio show.")
                    self._running = False
                    break

                # Check if room keeper relocated us
                current_room = self._keeper.room_id
                if current_room and current_room != self._room_id:
                    logger.info(f"Room changed by keeper: {self._room_id[:8]} → {current_room[:8]}")
                    self._room_id = current_room

                # 1. Poll news (cached — only refresh every NEWS_POLL_INTERVAL)
                self._refresh_headlines()

                # Check for high-priority injected events
                injected_events = self._event_queue.pop_all()
                if injected_events:
                    logger.info(f"Processing {len(injected_events)} injected events (e.g. BREAKING NEWS)!")

                # 2. Generate dialogue
                logger.info(f"Turn {self._turn_count + 1} — generating dialogue...")
                turn = self._engine.generate_turn(
                    headlines=self._cached_headlines,
                    history=self._history[-5:],
                    events=injected_events,
                )

                logger.info(f"  ALEX: {turn.host_text[:80]}...")
                logger.info(f"  MIRA: {turn.cohost_text[:80]}...")

                # 3. Submit to orchestrator and process turn
                result = self._bridge.submit_and_process(
                    room_id=self._room_id,
                    host_agent_id=self._host.id,
                    host_text=turn.host_text,
                    cohost_agent_id=self._cohost.id,
                    cohost_text=turn.cohost_text,
                )

                # 4. Handle results & pacing
                if result.selected_message_id:
                    winner_text = turn.host_text if result.selected_agent_id == self._host.id else turn.cohost_text
                    winner_name = self._host.name if result.selected_agent_id == self._host.id else self._cohost.name
                    
                    logger.info("Triggering audio synthesis...")
                    duration_ms = self._bridge.play_audio(
                        room_id=self._room_id,
                        message_id=result.selected_message_id,
                        text=winner_text,
                        agent_id=result.selected_agent_id,
                        api_key=self._host.api_key,
                        agent_name=winner_name
                    )
                    
                    # Sleep dynamically based on speech duration + 1.5s natural pause
                    sleep_time = max(1.5, (duration_ms / 1000.0) + 1.5)
                    logger.info(f"Sleeping {sleep_time:.2f}s for audio playback + padding...")
                    time.sleep(sleep_time)
                else:
                    logger.warning("No message selected, turning over quickly")
                    time.sleep(self._turn_interval)

                self._turn_count += 1
                self._history.append(turn)
                self._scheduler.record_turn()
                # Mark headlines as seen only after a successful turn
                self._commit_headlines()
                self._commit_headlines = lambda: None  # prevent double-commit

                logger.info(
                    f"  Turn {self._turn_count} result: "
                    f"status={result.status}  score={result.score:.1f}  "
                    f"topic=\"{turn.topic[:40]}\""
                )

                # 4. Check for music break
                if self._scheduler.should_inject():
                    self._inject_music_break()

                # 5. Check max turns
                if self._max_turns and self._turn_count >= self._max_turns:
                    logger.info(f"Max turns ({self._max_turns}) reached — stopping.")
                    self._running = False
                    break

                # 6. Wait for next turn
                logger.debug(f"Sleeping {self._turn_interval}s until next turn...")
                self._interruptible_sleep(self._turn_interval)

            except Exception as exc:
                logger.error(f"Turn loop error: {exc}", exc_info=True)
                # Don't crash — wait and retry
                self._interruptible_sleep(5)

    # ── Music Break ──────────────────────────────────────────────────────────

    def _inject_music_break(self) -> None:
        """Inject a music break between turns."""
        music_break = self._scheduler.start_break()
        payload = self._scheduler.build_event_payload(music_break)

        logger.info(
            f"♪ MUSIC BREAK #{music_break.break_number} — "
            f"{music_break.duration_seconds}s from {music_break.source[:40]}"
        )

        # Emit event to room
        self._bridge.emit_room_event(
            room_id=self._room_id,
            event_type="MUSIC_BREAK",
            payload=payload,
            auth_key=self._host.api_key if self._host else "",
        )

        # Wait for break duration (interruptible)
        self._interruptible_sleep(music_break.duration_seconds)
        self._scheduler.end_break()

        # Signal the next dialogue turn to use the post-music-break re-entry skill
        self._event_queue.push(
            "POST_MUSIC_BREAK",
            priority=5,
            payload={"break_number": music_break.break_number},
        )

    # ── News Polling ─────────────────────────────────────────────────────────

    def _refresh_headlines(self) -> None:
        """Refresh news cache if enough time has passed."""
        now = time.monotonic()
        if now - self._last_news_poll >= NEWS_POLL_INTERVAL or not self._cached_headlines:
            try:
                headlines, commit = self._poller.get_latest(n=5)
                self._cached_headlines = headlines
                self._commit_headlines = commit
                self._last_news_poll = now
                if self._cached_headlines:
                    logger.info(
                        f"News refreshed: {len(self._cached_headlines)} headlines  "
                        f"(top: \"{self._cached_headlines[0].title[:50]}...\")"
                    )
                else:
                    logger.warning("No fresh headlines available")
            except Exception as exc:
                logger.warning(f"News poll failed: {exc}")

    # ── Callbacks & Signals ──────────────────────────────────────────────────

    def _handle_room_change(self, old_room_id: str, new_room_id: str) -> None:
        """Callback from RoomKeeper when a room respawn occurs (or permanently fails)."""
        if not new_room_id:
            logger.critical("RoomKeeper exhausted all respawn attempts — stopping show.")
            self._running = False
            return
        logger.info(f"Room respawned: {old_room_id[:8]} → {new_room_id[:8]}")
        # History carries over — we continue the conversation seamlessly

    def _handle_shutdown(self, signum, frame) -> None:
        """Handle SIGINT/SIGTERM gracefully."""
        logger.info("Shutdown signal received — finishing current turn...")
        self._running = False

    def _interruptible_sleep(self, seconds: float) -> None:
        """Sleep that can be interrupted by setting self._running = False."""
        end = time.monotonic() + seconds
        while self._running and time.monotonic() < end:
            time.sleep(min(0.5, end - time.monotonic()))

    # ── Teardown ─────────────────────────────────────────────────────────────

    def _teardown(self) -> None:
        """Clean shutdown: stop keeper, flush agent memory, close connections."""
        logger.info("Radio runner shutting down...")
        self._webhook_server.stop()
        self._keeper.stop()

        # Flush agent long-term memory to disk on clean shutdown
        self._engine.alex.flush_memory()
        self._engine.mira.flush_memory()

        # Close the room gracefully (if we still have a host)
        if self._room_id and self._host:
            try:
                self._bridge.close_room(self._room_id, self._host)
                logger.info(f"Room {self._room_id[:8]} closed")
            except Exception as exc:
                logger.warning(f"Could not close room: {exc}")

        self._bridge.close()

        logger.info("=" * 60)
        logger.info(f"  Radio show ended after {self._turn_count} turns")
        logger.info(f"  Music breaks: {self._scheduler.break_count}")
        logger.info(f"  Room respawns: {self._keeper.respawn_count}")
        logger.info("=" * 60)


# ── CLI ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Beely AI Radio Show — 24/7 news radio with AI hosts"
    )
    parser.add_argument(
        "--turn-interval",
        type=int,
        default=int(os.environ.get("TURN_INTERVAL_SECONDS", "25")),
        help="Seconds between turns (default: 25)",
    )
    parser.add_argument(
        "--break-interval",
        type=int,
        default=int(os.environ.get("BREAK_INTERVAL", "8")),
        help="Number of turns between music breaks (default: 8)",
    )
    parser.add_argument(
        "--break-duration",
        type=int,
        default=int(os.environ.get("BREAK_DURATION_SECONDS", "120")),
        help="Music break duration in seconds (default: 120)",
    )
    parser.add_argument(
        "--room-type",
        default=os.environ.get("ROOM_TYPE", "debate"),
        help="Room type for the radio show (default: debate)",
    )
    parser.add_argument(
        "--max-turns",
        type=int,
        default=0,
        help="Stop after N turns (0 = run forever, default: 0)",
    )
    parser.add_argument(
        "--log-level",
        default=os.environ.get("LOG_LEVEL", "INFO"),
        help="Log level (default: INFO)",
    )
    args = parser.parse_args()

    setup_logging(args.log_level)

    runner = RadioRunner(
        turn_interval=args.turn_interval,
        break_interval=args.break_interval,
        break_duration=args.break_duration,
        room_type=args.room_type,
        max_turns=args.max_turns,
    )
    runner.run()


if __name__ == "__main__":
    main()
