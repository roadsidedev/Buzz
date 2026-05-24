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
from datetime import datetime, timezone
from typing import Callable, Optional

from dotenv import load_dotenv

# Load .env from script directory
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from audience_manager import AudienceManager, JoinEvent, TipEvent
from dialogue_engine import DialogueEngine, DialogueTurn
from editorial_pipeline import (
    EditorialContext, TransformedItem, transform_to_radio_copy,
    transform_crypto_data, filter_news_items, check_crypto_surge,
)
from event_listener import EventQueue, RadioEvent, WebhookServer
from memory_manager import PersistentMemory, SessionMemory, Callback
from music_scheduler import MusicScheduler
from news_poller import NewsPoller
from orchestrator_bridge import OrchestratorBridge, RegisteredAgent
from radio_physics import (
    BroadcastState, BroadcastStateManager, TimeBlock,
    SegmentID, get_current_block, get_current_segment, get_next_segment,
    get_segment_duration, get_segment_turns, get_turn_cadence,
    enforce_turn_anatomy, check_energy_reset, mark_energy_reset,
    require_energy_reset, get_transition_pattern, TRANSITION_PATTERNS,
)
from room_keeper import RoomKeeper
from special_events import SpecialEventDetector, SpecialEvent

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

BACKEND_URL = os.environ.get("BUZZ_BACKEND_URL", "https://clawzz-backend-live.up.railway.app")
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
        room_type: str = "radio-show",
        max_turns: int = 0,
    ) -> None:
        self._turn_interval = turn_interval
        self._room_type = room_type
        self._max_turns = max_turns
        self._running = False
        self._turn_count = 0
        self._history: deque[DialogueTurn] = deque(maxlen=10)

        # ── New systems ──────────────────────────────────────────────────────
        self._state_manager = BroadcastStateManager()
        self._persistent_memory = PersistentMemory()
        self._session_memory: Optional[SessionMemory] = None
        self._audience_manager = AudienceManager()
        self._event_detector = SpecialEventDetector()
        self._editorial_context = EditorialContext()
        self._current_segment: SegmentID = SegmentID.COLD_OPEN
        self._segment_turns: list[tuple[str, str]] = []
        self._current_turn_idx: int = 0
        self._last_audio_time: float = 0.0

        # ── Initialize modules ───────────────────────────────────────────────
        self._poller = NewsPoller()
        self._engine = DialogueEngine()
        self._bridge = OrchestratorBridge(
            backend_url=BACKEND_URL,
            orchestrator_url=ORCHESTRATOR_URL,
        )
        self._scheduler = MusicScheduler(
            break_interval=break_interval,
            break_duration=break_duration,
        )

        # ── Event handling ───────────────────────────────────────────────────
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
        logger.info("  Buzz Radio Runner — Starting up")
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
        title = "Buzz Radio — AI-First Live Streaming"
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

        # 4b. Send initial heartbeat immediately so room appears in discovery right away
        try:
            self._bridge.send_heartbeat(self._room_id, self._host.api_key)
            logger.info("Initial heartbeat sent")
        except Exception as hb_exc:
            logger.warning("Initial heartbeat failed (non-fatal): %s", hb_exc)

        # 5. Start room keeper watchdog
        self._keeper.start(
            room_id=self._room_id,
            host_agent=self._host,
            cohost_agent=self._cohost,
            title=title,
            room_type=self._room_type,
            objective=objective,
        )

        # 7. Initialize session memory
        self._session_memory = SessionMemory(
            session_id=str(uuid.uuid4()),
            room_id=self._room_id,
            started_at=time.time(),
        )

        # 8. Transition to LIVE state
        self._state_manager.transition_to(BroadcastState.LIVE)
        mark_energy_reset(self._room_id)

        logger.info(f"Radio show ready — Room: {self._room_id[:8]}...")
        logger.info(f"Open in browser: {BACKEND_URL}/room/{self._room_id}/live")

        # 6. Start Webhook server for external interruptions
        self._webhook_server.start()

    # ── Main Loop ────────────────────────────────────────────────────────────

    def _main_loop(self) -> None:
        """Core broadcast loop: state machine, segments, editorial pipeline."""
        while self._running:
            try:
                # ── State Machine Checks ──────────────────────────────────
                if self._state_manager.should_enter_night_mode():
                    self._state_manager.transition_to(BroadcastState.NIGHT_MODE)
                elif self._state_manager.should_exit_night_mode():
                    self._state_manager.transition_to(BroadcastState.LIVE)

                # Check silence timeout
                if self._state_manager.is_silence_timeout():
                    logger.warning("Silence timeout — entering RECOVERY")
                    self._state_manager.transition_to(BroadcastState.RECOVERY)
                    self._run_recovery_segment()
                    self._state_manager.transition_to(BroadcastState.LIVE)

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
                    if self._session_memory:
                        self._session_memory.room_id = current_room

                # ── Editorial Pipeline ─────────────────────────────────────
                self._refresh_headlines()
                self._refresh_editorial_context()

                # ── Check Special Events ───────────────────────────────────
                injected_events = self._event_queue.pop_all()
                special_events = self._check_special_events(injected_events)

                if special_events:
                    for event in special_events:
                        if event.event_type == "BREAKING_NEWS":
                            self._state_manager.transition_to(BroadcastState.BREAKING)
                            self._handle_breaking_news(event)
                            self._state_manager.transition_to(BroadcastState.LIVE)
                        elif event.event_type == "CRYPTO_SURGE":
                            self._handle_crypto_surge(event)

                # ── Segment System ─────────────────────────────────────────
                seg_id, _ = get_current_segment()
                block = get_current_block()

                # Check if segment changed
                if seg_id != self._current_segment:
                    self._state_manager.transition_to(BroadcastState.TRANSITION)
                    prev_seg = self._current_segment
                    self._current_segment = seg_id
                    self._current_turn_idx = 0
                    self._segment_turns = get_segment_turns(seg_id, block)

                    # Check energy reset requirement
                    if require_energy_reset(prev_seg, seg_id):
                        self._run_micro_banter()

                    # Transition pattern
                    transition = get_transition_pattern(prev_seg, seg_id)
                    self._run_transition(prev_seg, seg_id, transition)

                    self._state_manager.transition_to(BroadcastState.LIVE)
                    logger.info("Segment: %s → %s (%s)", prev_seg.value, seg_id.value, block.value)

                # ── Process Turn ───────────────────────────────────────────
                if self._current_turn_idx >= len(self._segment_turns):
                    # Segment over
                    if self._session_memory:
                        self._session_memory.segments_aired.append(seg_id.value)
                    self._current_turn_idx = 0
                    time.sleep(get_turn_cadence(block))
                    continue

                turn_spec = self._segment_turns[self._current_turn_idx]
                agent_key, persona_name = turn_spec
                total_turns = len(self._segment_turns)

                logger.info(
                    f"Turn {self._turn_count + 1} — [{agent_key}] {seg_id.value} "
                    f"(turn {self._current_turn_idx + 1}/{total_turns})"
                )

                # Generate dialogue with full context
                turn = self._engine.generate_turn(
                    editorial=self._editorial_context,
                    headlines=self._cached_headlines,
                    history=list(self._history)[-5:],
                    events=injected_events,
                    segment_id=seg_id,
                    turn_number=self._current_turn_idx + 1,
                    total_turns=total_turns,
                    agent_key=agent_key,
                    session_memory=self._session_memory,
                )

                logger.info(f"  ALEX: {turn.host_text[:80]}...")
                logger.info(f"  MIRA: {turn.cohost_text[:80]}...")

                # ── Energy Reset Check ─────────────────────────────────────
                if check_energy_reset(self._room_id):
                    logger.info("4-minute energy reset triggered — injecting micro-banter")
                    self._run_micro_banter()
                    mark_energy_reset(self._room_id)

                # ── Submit & Process Turn ──────────────────────────────────
                result = self._bridge.submit_and_process(
                    room_id=self._room_id,
                    host_agent_id=self._host.id,
                    host_text=turn.host_text,
                    cohost_agent_id=self._cohost.id,
                    cohost_text=turn.cohost_text,
                    host_api_key=self._host.api_key,
                )

                # ── Audio Synthesis ────────────────────────────────────────
                if result.selected_message_id:
                    self._play_turn_audio(result, turn)
                elif result.status in ("no_messages", "no_valid_messages"):
                    self._play_fallback_audio(turn)
                else:
                    logger.warning("No message selected (status=%s)", result.status)
                    time.sleep(self._turn_interval)

                self._turn_count += 1
                self._current_turn_idx += 1
                self._history.append(turn)
                self._scheduler.record_turn()

                # Mark news items as aired
                if turn.topic and turn.topic not in ("BREAKING NEWS", "post_music_break", "slow_news"):
                    self._commit_headlines()

                logger.info(
                    f"  Turn {self._turn_count} result: "
                    f"status={result.status}  score={result.score:.1f}  "
                    f"topic=\"{turn.topic[:40]}\""
                )

                # ── Music Break Check ──────────────────────────────────────
                if self._scheduler.should_inject():
                    self._inject_music_break()

                # ── Max Turns Check ────────────────────────────────────────
                if self._max_turns and self._turn_count >= self._max_turns:
                    logger.info(f"Max turns ({self._max_turns}) reached — stopping.")
                    self._running = False
                    break

                # ── Turn Cadence ───────────────────────────────────────────
                cadence = get_turn_cadence(block)
                logger.debug(f"Sleeping {cadence}s until next turn...")
                self._interruptible_sleep(cadence)

            except Exception as exc:
                logger.error(f"Turn loop error: {exc}", exc_info=True)
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

    # ── Audio Playback Helpers ──────────────────────────────────────────────

    def _play_turn_audio(self, result, turn: DialogueTurn) -> None:
        """Play the winning message's audio."""
        if result.selected_agent_id == self._host.id:
            winner_text = turn.host_text
            winner_name = self._host.name
        else:
            winner_text = turn.cohost_text
            winner_name = self._cohost.name

        logger.info("Triggering audio synthesis...")
        try:
            duration_ms = self._bridge.play_audio(
                room_id=self._room_id,
                message_id=result.selected_message_id,
                text=winner_text,
                agent_id=result.selected_agent_id,
                api_key=self._host.api_key,
                agent_name=winner_name,
            )
            sleep_time = max(2.0, (duration_ms / 1000.0) + 1.5)
            logger.info(f"Sleeping {sleep_time:.2f}s for audio playback...")
            time.sleep(sleep_time)
        except Exception as audio_exc:
            logger.error("Audio playback error: %s", audio_exc)
            time.sleep(self._turn_interval)

    def _play_fallback_audio(self, turn: DialogueTurn) -> None:
        """Play host dialogue directly as fallback."""
        logger.warning("Playing host dialogue directly as fallback")
        try:
            fallback_id = f"fallback-{self._turn_count + 1}"
            duration_ms = self._bridge.play_audio(
                room_id=self._room_id,
                message_id=fallback_id,
                text=turn.host_text,
                agent_id=self._host.id,
                api_key=self._host.api_key,
                agent_name=self._host.name,
            )
            sleep_time = max(2.0, (duration_ms / 1000.0) + 1.5)
            logger.info(f"Fallback audio: sleeping {sleep_time:.2f}s")
            time.sleep(sleep_time)
        except Exception as exc:
            logger.error("Fallback audio failed: %s", exc)
            time.sleep(self._turn_interval)

    # ── Segment & Transition Helpers ─────────────────────────────────────────

    def _run_transition(
        self, prev_seg: SegmentID, next_seg: SegmentID, pattern: str
    ) -> None:
        """Execute a transition between segments."""
        transition_data = TRANSITION_PATTERNS.get(pattern, TRANSITION_PATTERNS["pivot"])
        dur_lo, dur_hi = transition_data["duration"]
        duration = (dur_lo + dur_hi) // 2

        logger.info("Transition: %s → %s (pattern=%s, %.1fs)", prev_seg.value, next_seg.value, pattern, duration)

        # Generate brief transition dialogue
        if self._host and self._cohost:
            alex_line = transition_data.get("alex", "")
            mira_line = transition_data.get("mira", "")
            if alex_line:
                try:
                    self._bridge.submit_and_process(
                        room_id=self._room_id,
                        host_agent_id=self._host.id,
                        host_text=alex_line,
                        cohost_agent_id=self._cohost.id,
                        cohost_text=mira_line or "Let's do it.",
                        host_api_key=self._host.api_key,
                    )
                except Exception:
                    pass
            self._interruptible_sleep(duration)

    def _run_micro_banter(self) -> None:
        """60-second unscheduled banter to reset energy."""
        logger.info("Running micro-banter (energy reset)")
        if not (self._host and self._cohost):
            return
        try:
            self._bridge.submit_and_process(
                room_id=self._room_id,
                host_agent_id=self._host.id,
                host_text="Let's come up for air for a second. What are we thinking about?",
                cohost_agent_id=self._cohost.id,
                cohost_text="Yeah, let's reset. I've got a thought on that actually—",
                host_api_key=self._host.api_key,
            )
        except Exception as exc:
            logger.warning("Micro-banter failed: %s", exc)
        self._interruptible_sleep(10)

    def _run_recovery_segment(self) -> None:
        """Dead air recovery sequence."""
        logger.warning("Running dead air recovery")
        if not (self._host and self._cohost):
            return
        try:
            self._bridge.submit_and_process(
                room_id=self._room_id,
                host_agent_id=self._host.id,
                host_text="Alright — we had a moment there. We're back. Tech was being difficult.",
                cohost_agent_id=self._cohost.id,
                cohost_text="I did nothing. Continue.",
                host_api_key=self._host.api_key,
            )
        except Exception as exc:
            logger.warning("Recovery segment failed: %s", exc)

    # ── Special Event Handlers ──────────────────────────────────────────────

    def _check_special_events(
        self, injected_events: list,
    ) -> list[SpecialEvent]:
        """Check all data feeds for special events."""
        events = []

        # Breaking news from event queue
        for event in injected_events:
            if event.event_type == "BREAKING_NEWS":
                events.append(SpecialEvent(
                    event_type="BREAKING_NEWS",
                    payload=event.payload,
                ))

        # Crypto surge
        if self._editorial_context.crypto:
            surge = self._event_detector.check_crypto_surge(self._editorial_context.crypto)
            if surge:
                events.append(surge)

        # High audience
        if self._audience_manager.participant_count > 10:
            high_aud = self._event_detector.check_high_audience(self._audience_manager.participant_count)
            if high_aud:
                events.append(high_aud)

        return events

    def _handle_breaking_news(self, event: SpecialEvent) -> None:
        """Handle a breaking news event."""
        headline = event.payload.get("headline", "Breaking story")
        logger.info("=== BREAKING NEWS: %s ===", headline)

        if not (self._host and self._cohost):
            return

        # Generate breaking news turns
        turn = self._engine.generate_turn(
            headlines=self._cached_headlines,
            events=[RadioEvent(priority=0, event_type="BREAKING_NEWS", payload=event.payload)],
            segment_id=SegmentID.BREAKING,
        )

        # Submit and process
        result = self._bridge.submit_and_process(
            room_id=self._room_id,
            host_agent_id=self._host.id,
            host_text=turn.host_text,
            cohost_agent_id=self._cohost.id,
            cohost_text=turn.cohost_text,
            host_api_key=self._host.api_key,
        )

        if result.selected_message_id:
            self._play_turn_audio(result, turn)

        logger.info("Breaking news segment complete")

    def _handle_crypto_surge(self, event: SpecialEvent) -> None:
        """Handle a crypto surge event (>10% move)."""
        coin = event.payload.get("coin", "unknown")
        change = event.payload.get("change_24h", 0)
        logger.info("=== CRYPTO SURGE: %s moved %.1f%% ===", coin, change)

        if self._cohost:
            # Mira's corner would go into crypto surge mode
            self._event_queue.push(
                "CRYPTO_SURGE", priority=2,
                payload={"coin": coin, "change": change},
            )

    # ── Editorial Pipeline ──────────────────────────────────────────────────

    def _refresh_editorial_context(self) -> None:
        """Refresh the editorial context from cached data."""
        block = get_current_block()
        self._editorial_context.block = block.value
        self._editorial_context.hour = datetime.now(timezone.utc).hour

        # Transform headlines into editorial items
        if self._cached_headlines:
            items = []
            for hl in self._cached_headlines[:10]:
                transformed = transform_to_radio_copy(
                    raw_title=getattr(hl, 'title', str(hl)),
                    raw_description=getattr(hl, 'summary', ''),
                    source=getattr(hl, 'source', ''),
                    published_at=getattr(hl, 'published_at', None),
                )
                items.append(transformed)
            self._editorial_context.news = filter_news_items(items)

        # Update audience context
        self._editorial_context.participant_count = self._audience_manager.participant_count
        self._editorial_context.known_participants = (
            self._audience_manager.get_known_listeners_summary()
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
        # Redirect any listeners still on the old room URL so they automatically
        # follow to the new room without a manual refresh.
        if self._host:
            self._bridge.notify_room_redirect(
                old_room_id=old_room_id,
                new_room_id=new_room_id,
                api_key=self._host.api_key,
            )
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
        """Clean shutdown: stop keeper, flush memory, close connections."""
        logger.info("Radio runner shutting down...")
        self._webhook_server.stop()
        self._keeper.stop()

        # Flush agent long-term memory to disk
        self._engine.alex.flush_memory()
        self._engine.mira.flush_memory()

        # Persist session memory
        if self._persistent_memory:
            self._persistent_memory.increment_sessions()
            self._persistent_memory.save()

        # Close the room gracefully
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
        logger.info(f"  Total sessions: {self._persistent_memory.total_sessions}")
        logger.info("=" * 60)


# ── CLI ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Buzz AI Radio Show — 24/7 news radio with AI hosts"
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
