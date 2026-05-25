#!/usr/bin/env python3
"""
video_runner.py
Enterprise-grade 24/7 video broadcast daemon — Buzz Video Runner.

Integrates all subsystems:
  - Dual anchor commentary with orchestration scoring (Phase 1.1)
  - Time-aware programming blocks with segment schedules (Phase 1.2)
  - Dead air monitor with auto-recovery (Phase 1.3)
  - Multi-scene HTML rendering engine (Phase 2.1)
  - Graphics overlay system (lower thirds, tickers, cards) (Phase 2.2)
  - Editorial scoring pipeline (Phase 2.3)
  - Director Agent for scene cut decisions (Phase 3.1)
  - Audience awareness and viewer tracking (Phase 3.2)
  - Three-layer broadcast memory (Phase 3.3)
  - Special programming triggers (Phase 3.4)
  - Graceful degradation on API failures (Phase 4.1)
  - 6-hour stream rotation (Phase 4.2)

Architecture placement: scripts/video-livestream-runner/
"""

import argparse
import asyncio
import logging
import os
import shutil
import signal
import sys
import time
from typing import Optional

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from audience_awareness import AudienceManager, TipEvent, ViewerProfile
from broadcast_memory import BroadcastMemory
from commentary_engine import CommentaryEngine
from dead_air_monitor import DeadAirMonitor, RecoveryAction
from director_agent import DirectorAgent, DirectorCommand
from dual_commentary_engine import DualCommentaryEngine, OrchestratedSegment
from editorial_pipeline import EditorialPipeline
from event_listener import EventQueue, WebhookServer
from graceful_degradation import GracefulDegradation
from graphics_overlay import GraphicsOverlayManager, TickerStyle
from livestream_bridge import LivestreamBridge, RegisteredAgent
from media_mixer import MediaMixer
from programming_schedule import ProgrammingSchedule, SegmentSlot, TimeBlock
from scene_engine import SceneEngine
from scene_scheduler import SceneScheduler
from special_triggers import SpecialTrigger, SpecialTriggerManager, TriggerEvent
from stream_keeper import StreamKeeper

LOG_FORMAT = "[%(asctime)s] [%(name)-22s] [%(levelname)-5s] %(message)s"
logger = logging.getLogger("video_runner")

BACKEND_URL = os.environ.get(
    "LIVESTREAM_BACKEND_URL",
    "https://clawzz-backend-live.up.railway.app",
)
USE_DUAL_ANCHOR = os.environ.get("USE_DUAL_ANCHOR", "true").lower() == "true"
DEAD_AIR_THRESHOLD = int(os.environ.get("DEAD_AIR_THRESHOLD_SECONDS", "90"))
STREAM_ROTATION_HOURS = int(os.environ.get("STREAM_ROTATION_HOURS", "6"))


def setup_logging(level: str = "INFO") -> None:
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format=LOG_FORMAT,
        datefmt="%H:%M:%S",
        stream=sys.stdout,
    )


class VideoRunner:
    """
    Enterprise-grade 24/7 video broadcast daemon with all subsystem integration.
    """

    def __init__(
        self,
        turn_interval: int = 30,
        rotation_interval: int = 6,
        stream_title: str = "Buzz News Live",
        stream_category: str = "News",
        max_turns: int = 0,
        width: int = 1280,
        height: int = 720,
        fps: int = 15,
    ) -> None:
        self._turn_interval = turn_interval
        self._stream_title = stream_title
        self._stream_category = stream_category
        self._max_turns = max_turns
        self._width = width
        self._height = height
        self._fps = fps

        self._running = False
        self._turn_count = 0
        self._first_turn_done = False
        self._current_rtmp_url: str = ""
        self._stream_start_time: float = 0.0

        # ── Infrastructure ───────────────────────────────────────────────
        self._bridge = LivestreamBridge(backend_url=BACKEND_URL)
        self._memory = BroadcastMemory()
        self._event_queue = EventQueue()

        # ── Phase 1.1: Commentary ───────────────────────────────────────
        if USE_DUAL_ANCHOR:
            self._commentary = DualCommentaryEngine()
            logger.info("Dual anchor mode (Zara + Dex)")
        else:
            self._commentary = CommentaryEngine()
            logger.info("Single anchor mode (legacy)")

        # ── Phase 1.2: Programming Schedule ──────────────────────────────
        self._schedule = ProgrammingSchedule()

        # ── Phase 1.3: Dead Air Monitor ─────────────────────────────────
        self._dead_air = DeadAirMonitor(
            silence_threshold=DEAD_AIR_THRESHOLD,
            on_recovery=self._handle_recovery,
            on_state_change=self._handle_state_change,
        )

        # ── Phase 2.1: Scene Engine ─────────────────────────────────────
        self._scene_engine = SceneEngine(width=width, height=height, fps=fps)

        # ── Phase 2.2: Graphics ─────────────────────────────────────────
        self._graphics = GraphicsOverlayManager(self._scene_engine)

        # ── Phase 2.3: Editorial ────────────────────────────────────────
        self._editorial = EditorialPipeline()

        # ── Phase 3.1: Director Agent ───────────────────────────────────
        self._director = DirectorAgent(
            on_scene_cut=self._execute_scene_cut,
            on_camera_call=self._execute_camera_call,
            on_overlay=self._execute_overlay,
            on_ticker=self._execute_ticker,
        )

        # ── Phase 3.2: Audience ─────────────────────────────────────────
        self._audience = AudienceManager(
            on_viewer_join=self._handle_viewer_join,
            on_tip=self._handle_tip,
            on_audience_hot=self._handle_audience_hot,
        )

        # ── Phase 3.4: Special Triggers ─────────────────────────────────
        self._triggers = SpecialTriggerManager(
            on_trigger=self._handle_special_trigger,
        )

        # ── Phase 4.1: Graceful Degradation ─────────────────────────────
        self._degradation = GracefulDegradation()

        # ── Legacy Modules ──────────────────────────────────────────────
        self._media_mixer = MediaMixer(width=width, height=height, fps=fps)
        self._scheduler = SceneScheduler(rotation_interval=rotation_interval)
        self._webhook_server = WebhookServer(
            port=int(os.environ.get("WEBHOOK_PORT", "8081")),
            event_queue=self._event_queue,
        )

        self._anchor: Optional[RegisteredAgent] = None
        self._stream_id: str = ""
        self._current_segment: Optional[SegmentSlot] = None
        self._segment_elapsed: float = 0.0

        self._keeper = StreamKeeper(
            bridge=self._bridge,
            on_stream_changed=self._handle_stream_change,
        )

        self._recovery_in_progress = False

    # ── Lifecycle ────────────────────────────────────────────────────────────

    def run(self) -> None:
        self._running = True
        signal.signal(signal.SIGINT, self._handle_shutdown)
        signal.signal(signal.SIGTERM, self._handle_shutdown)
        try:
            asyncio.run(self._async_run())
        except KeyboardInterrupt:
            pass

    async def _async_run(self) -> None:
        try:
            await self._setup()
            await self._main_loop()
        except KeyboardInterrupt:
            pass
        except Exception as exc:
            logger.critical("Fatal error: %s", exc, exc_info=True)
        finally:
            await self._teardown()

    # ── Setup ────────────────────────────────────────────────────────────────

    async def _setup(self) -> None:
        agent_suffix = os.environ.get("LIVESTREAM_AGENT_SUFFIX", "01")
        block = self._schedule.current_block

        logger.info("=" * 70)
        logger.info("  Buzz Video Runner — Enterprise Edition")
        logger.info(f"  Backend       : {BACKEND_URL}")
        logger.info(f"  Turn interval : {self._turn_interval}s")
        logger.info(f"  Resolution    : {self._width}x{self._height} @ {self._fps}fps")
        logger.info(f"  Anchor mode   : {'DUAL (Zara + Dex)' if USE_DUAL_ANCHOR else 'SINGLE'}")
        logger.info(f"  Time block    : {block.value.upper()}")
        logger.info(f"  Stream rotate : {STREAM_ROTATION_HOURS}h")
        logger.info(f"  Dead air      : {DEAD_AIR_THRESHOLD}s")
        logger.info("=" * 70)

        if not shutil.which("ffmpeg"):
            raise RuntimeError("ffmpeg not found on PATH.")
        if not await self._check_playwright():
            raise RuntimeError("Playwright not installed.")

        logger.info("Waiting for backend...")
        self._bridge.wait_for_backend()

        logger.info("Registering anchor agent...")
        self._anchor = self._bridge.register_or_reuse_agent(
            name=f"News Anchor ({agent_suffix})",
            username=f"video_anchor_{agent_suffix}",
            pre_auth_key=os.environ.get("LIVESTREAM_AGENT_API_KEY"),
        )

        logger.info("Creating livestream...")
        stream = self._bridge.create_livestream(
            agent=self._anchor,
            title=self._stream_title,
            category=self._stream_category,
        )
        self._stream_id = stream.id
        self._current_rtmp_url = self._bridge.build_rtmp_url(stream)
        self._stream_start_time = time.time()

        self._memory.new_session(self._stream_id)

        scene_name = "news_desk"
        logger.info("Starting scene engine: %s", scene_name)
        await self._scene_engine.start(scene_name)
        await self._graphics.set_block(block.value)

        logger.info("Starting media mixer...")
        await self._media_mixer.start(
            rtmp_url=self._current_rtmp_url,
            frame_queue=self._scene_engine.frame_queue,
        )

        if self._anchor:
            self._bridge.send_heartbeat(self._stream_id, self._anchor)

        self._keeper.start(
            stream_id=self._stream_id,
            rtmp_url=self._current_rtmp_url,
            agent=self._anchor,
            title=self._stream_title,
            category=self._stream_category,
        )

        self._webhook_server.start()
        self._dead_air.start()
        self._dead_air.ping()
        await self._director.start()

        self._current_segment = self._schedule.get_current_segment()
        self._segment_elapsed = 0.0
        self._triggers.check_night_mode()

        logger.info(f"Livestream ready — ID: {self._stream_id[:8]}")
        logger.info(f"Segment: {self._current_segment.segment_id} | Scene: {scene_name}")

    async def _check_playwright(self) -> bool:
        try:
            from playwright.async_api import async_playwright
            return True
        except ImportError:
            return False

    # ── Main Loop ────────────────────────────────────────────────────────────

    async def _main_loop(self) -> None:
        while self._running:
            try:
                # ── Health checks ────────────────────────────────────────
                if self._dead_air.state.value in ("failed", "shutdown"):
                    logger.critical("DeadAirMonitor failed — stopping.")
                    self._running = False
                    break
                if self._keeper.failed:
                    logger.critical("StreamKeeper failed — stopping.")
                    self._running = False
                    break
                if self._media_mixer.permanently_failed:
                    logger.critical("FFmpeg failed — stopping.")
                    self._running = False
                    break
                if self._dead_air.is_in_recovery:
                    await self._interruptible_sleep(5)
                    continue

                # ── News polling (every 3 min) ──────────────────────────
                news_data = self._poll_news()
                if news_data:
                    self._degradation.record_success("news")
                    scored = self._editorial.process(news_data)
                    breaking = self._triggers.check_news_for_breaking(news_data)
                else:
                    self._degradation.record_failure("news")

                ticker_headlines = [n.get("title", "") for n in news_data[:10]]

                # ── Special trigger checks ───────────────────────────────
                self._triggers.check_night_mode()

                # ── Director assessment ──────────────────────────────────
                seg_id = self._current_segment.segment_id if self._current_segment else "headlines"
                scene = self._scene_engine.current_scene
                self._director.update_context(
                    segment=seg_id,
                    scene=scene,
                )
                director_commands = await self._director.assess()
                for cmd in director_commands:
                    await self._execute_director(cmd)

                # ── Segment rotation check ──────────────────────────────
                if self._current_segment and self._schedule.should_rotate_segment(
                    self._current_segment.segment_id, self._segment_elapsed,
                ):
                    await self._advance_segment()

                # ── Generate commentary ─────────────────────────────────
                logger.info("Turn %d — Segment: %s | Block: %s",
                             self._turn_count + 1,
                             self._current_segment.segment_id if self._current_segment else "?",
                             self._schedule.current_block.value)

                if USE_DUAL_ANCHOR:
                    result = self._generate_dual_commentary(news_data)
                else:
                    result = self._generate_single_commentary(news_data)

                if result is None:
                    await self._interruptible_sleep(5)
                    continue

                if USE_DUAL_ANCHOR:
                    segment = result
                    text = segment.winner.text
                    topic = segment.topic
                    cue = segment.winner.visual_cue
                    speaker = segment.winner.speaker
                else:
                    text = result.text
                    topic = result.topic
                    cue = result.visual_cue
                    speaker = "Zara"

                # ── Director assess with speaker context ────────────────
                self._director.update_context(speaking=speaker)
                director_commands = await self._director.assess()
                for cmd in director_commands:
                    await self._execute_director(cmd)

                # ── Update scene ────────────────────────────────────────
                await self._scene_engine.update_topic(
                    headline=topic,
                    commentary=text,
                    visual_cue=cue,
                    speaker=speaker,
                )
                if ticker_headlines:
                    await self._graphics.update_ticker(ticker_headlines)

                # ── Lower third for speaker identification ──────────────
                if self._turn_count % 5 == 0:
                    await self._graphics.show_lower_third(
                        speaker, f"Buzz News — {seg_id.replace('_', ' ').title()}",
                    )

                # ── Synthesize TTS ──────────────────────────────────────
                if self._anchor:
                    audio = self._bridge.synthesize_speech(
                        text=text,
                        agent=self._anchor,
                        voice_name=speaker,
                        stream_id=self._stream_id,
                    )
                    if audio:
                        await self._media_mixer.queue_audio(audio)
                        self._degradation.record_tts_success()
                    else:
                        self._degradation.record_failure("tts")

                # ── Heartbeat ───────────────────────────────────────────
                if self._anchor:
                    self._bridge.send_heartbeat(self._stream_id, self._anchor)

                # ── State updates ───────────────────────────────────────
                self._turn_count += 1
                self._segment_elapsed += self._turn_interval
                self._first_turn_done = True
                self._dead_air.ping()
                self._director.ping_cut()
                self._memory.rolling.record_turn(speaker, text, seg_id)
                self._memory.rolling.record_topic(topic)
                self._memory.session.record_segment(seg_id)

                if self._turn_count % 10 == 0:
                    logger.info("  [!] Turn %d | Mem: %ds | Dir: %dc | Deg: news=%s tts=%s",
                                self._turn_count,
                                self._memory.session.elapsed_seconds,
                                self._director._cycle_count,
                                self._degradation._status.news_stale,
                                self._degradation._status.tts_disabled)

                # ── Scene rotation ──────────────────────────────────────
                if self._scheduler.should_rotate():
                    rotation = self._scheduler.next_scene()
                    desired = self._director.select_scene(
                        seg_id, self._schedule.current_block.value,
                    )
                    if desired != self._scene_engine.current_scene:
                        await self._scene_engine.switch_scene(desired)
                        self._memory.rolling.current_scene = desired

                # ── Max turns ───────────────────────────────────────────
                if self._max_turns and self._turn_count >= self._max_turns:
                    logger.info("Max turns (%d) reached.", self._max_turns)
                    self._running = False
                    break

                # ── Stream rotation ─────────────────────────────────────
                elapsed_h = (time.time() - self._stream_start_time) / 3600
                if elapsed_h >= STREAM_ROTATION_HOURS:
                    await self._handle_stream_rotation()
                    continue

                await self._interruptible_sleep(self._turn_interval)

            except Exception as exc:
                logger.error("Turn loop error: %s", exc, exc_info=True)
                await self._interruptible_sleep(5)

    # ── Segment Advancement ──────────────────────────────────────────────────

    async def _advance_segment(self) -> None:
        if not self._current_segment:
            return
        next_seg = self._schedule.next_segment(self._current_segment.segment_id)
        if next_seg:
            self._current_segment = next_seg
            self._segment_elapsed = 0.0
            desired_scene = self._director.select_scene(
                next_seg.segment_id, self._schedule.current_block.value,
            )
            if desired_scene != self._scene_engine.current_scene:
                transition, dur = self._director.get_transition(
                    self._scene_engine.current_scene, desired_scene,
                )
                logger.info("  Scene: %s → %s (%s, %dms)",
                             self._scene_engine.current_scene, desired_scene,
                             transition, dur)
                await self._scene_engine.switch_scene(desired_scene)
                self._memory.rolling.current_scene = desired_scene

            logger.info("  Segment → %s (%.0fs)", next_seg.segment_id, next_seg.duration_sec)

            if next_seg.segment_id == "music_break":
                await self._handle_music_break()
            if next_seg.segment_id == "commentary" and USE_DUAL_ANCHOR:
                await self._scene_engine.switch_scene("debate_split")

    # ── Commentary Generation ────────────────────────────────────────────────

    def _poll_news(self) -> list[dict]:
        import feedparser
        try:
            feed = feedparser.parse("https://feeds.bbci.co.uk/news/technology/rss.xml")
            return [
                {"title": e.get("title", ""), "summary": (e.get("summary", "") or "")[:300],
                 "source": "BBC"}
                for e in feed.get("entries", [])[:15]
            ]
        except Exception as exc:
            logger.warning("News poll failed: %s", exc)
            return []

    def _generate_single_commentary(self, news_data: list[dict]):
        incoming = self._event_queue.pop_all()
        event_text = str(incoming[0].payload) if incoming else None
        topic = "Technology News"
        context = "Latest developments in AI and technology"
        if news_data:
            top = news_data[0]
            topic = top.get("title", topic)
            context = top.get("summary", context)
        if self._degradation.news_stale:
            topic = self._degradation.get_fallback_topic()
            context = self._degradation.get_fallback_commentary()
        return self._commentary.generate(topic=topic, context=context, incoming_event=event_text)

    def _generate_dual_commentary(self, news_data: list[dict]) -> Optional[OrchestratedSegment]:
        incoming = self._event_queue.pop_all()
        event_text = str(incoming[0].payload) if incoming else None
        topic = "Technology News"
        context = "Latest developments in AI and technology"
        if news_data:
            top = news_data[0]
            topic = top.get("title", topic)
            context = top.get("summary", context)
        if self._degradation.news_stale:
            topic = self._degradation.get_fallback_topic()
            context = self._degradation.get_fallback_commentary()

        segment_id = self._current_segment.segment_id if self._current_segment else "headlines"
        turn_type = "lead" if event_text else None
        if event_text:
            topic = f"BREAKING: {event_text}"
            context = "Urgent breaking news update."

        return self._commentary.generate_turn(
            topic=topic, context=context,
            segment_type=segment_id, turn_type=turn_type,
        )

    # ── Director Command Execution ──────────────────────────────────────────

    async def _execute_director(self, cmd: DirectorCommand) -> None:
        if cmd.command == "SCENE_CUT":
            await self._execute_scene_cut(cmd)
        elif cmd.command == "CAMERA_CALL":
            await self._execute_camera_call(cmd)
        elif cmd.command == "OVERLAY_TRIGGER":
            await self._execute_overlay(cmd)

    async def _execute_scene_cut(self, cmd: DirectorCommand) -> None:
        logger.debug("Director scene cut: %s → %s (%s)", cmd.from_scene, cmd.to_scene, cmd.transition)
        if cmd.to_scene and cmd.to_scene != self._scene_engine.current_scene:
            await self._scene_engine.switch_scene(cmd.to_scene)

    async def _execute_camera_call(self, cmd: DirectorCommand) -> None:
        logger.debug("Director camera: %s framing=%s", cmd.subject, cmd.framing)

    async def _execute_overlay(self, cmd: DirectorCommand) -> None:
        logger.debug("Director overlay: %s", cmd.graphic_id)

    async def _execute_ticker(self, cmd: DirectorCommand) -> None:
        logger.debug("Director ticker: %s", cmd.style)

    # ── Recovery ────────────────────────────────────────────────────────────

    def _handle_recovery(self, actions: list[RecoveryAction]) -> None:
        self._recovery_in_progress = True
        for action in actions:
            try:
                if self._anchor and self._stream_id:
                    audio = self._bridge.synthesize_speech(
                        text=action.text, agent=self._anchor,
                        voice_name=action.speaker, stream_id=self._stream_id,
                    )
                    if audio:
                        loop = asyncio.new_event_loop()
                        asyncio.set_event_loop(loop)
                        loop.run_until_complete(self._media_mixer.queue_audio(audio))
                        loop.close()
                    time.sleep(action.duration_sec)
            except Exception as exc:
                logger.error("Recovery action failed: %s", exc)
        self._dead_air.ping()
        self._recovery_in_progress = False

    def _handle_state_change(self, old, new) -> None:
        logger.info("State: %s → %s", old.value, new.value)

    # ── Audience ────────────────────────────────────────────────────────────

    def _handle_viewer_join(self, profile: ViewerProfile) -> None:
        logger.info("Viewer joined: %s (visit %d)", profile.name, profile.visit_count)

    def _handle_tip(self, event: TipEvent) -> None:
        logger.info("Tip: %s — $%.2f", event.viewer_name, event.amount)

    def _handle_audience_hot(self, hot: bool) -> None:
        logger.info("Audience hot mode: %s", hot)

    # ── Special Triggers ────────────────────────────────────────────────────

    def _handle_special_trigger(self, event: TriggerEvent) -> None:
        logger.info("Trigger: %s — %s", event.trigger.value, event.payload)

    # ── Music Break ─────────────────────────────────────────────────────────

    async def _handle_music_break(self) -> None:
        duration = self._current_segment.duration_sec if self._current_segment else 120
        logger.info("Music break — %ds", duration)
        await self._scene_engine.switch_scene("music_break")
        if self._anchor:
            self._bridge.synthesize_speech(
                text="We're going to take a short music break. We'll be right back.",
                agent=self._anchor, voice_name="Zara", stream_id=self._stream_id,
            )
        await self._interruptible_sleep(duration)
        await self._scene_engine.switch_scene("news_desk")

    # ── Stream Rotation ────────────────────────────────────────────────────

    async def _handle_stream_rotation(self) -> None:
        logger.info("=== Stream Rotation ===")
        if self._anchor and self._stream_id:
            try:
                self._bridge.synthesize_speech(
                    text="This marks the end of our current broadcast session. "
                         "We'll be right back with a fresh stream. Stay with us.",
                    agent=self._anchor, voice_name="Zara", stream_id=self._stream_id,
                )
                await asyncio.sleep(5)
                self._bridge.update_livestream(self._stream_id, self._anchor, status="ended")
            except Exception as exc:
                logger.warning("Stream rotation close failed: %s", exc)

        stream = self._bridge.create_livestream(
            agent=self._anchor, title=self._stream_title, category=self._stream_category,
        )
        self._stream_id = stream.id
        self._current_rtmp_url = self._bridge.build_rtmp_url(stream)
        self._stream_start_time = time.time()

        await self._media_mixer.stop()
        await self._media_mixer.start(
            rtmp_url=self._current_rtmp_url, frame_queue=self._scene_engine.frame_queue,
        )
        if self._anchor:
            self._bridge.send_heartbeat(self._stream_id, self._anchor)
        self._keeper.update_stream(self._stream_id, self._current_rtmp_url)
        self._degradation.reset()
        logger.info("Stream rotated — new ID: %s", self._stream_id[:8])

    # ── Callbacks ───────────────────────────────────────────────────────────

    def _handle_stream_change(self, old_id: str, new_id: str, new_rtmp: str) -> None:
        if not new_id:
            logger.critical("StreamKeeper exhausted — stopping.")
            self._running = False
            return
        self._stream_id = new_id
        self._current_rtmp_url = new_rtmp

    def _handle_shutdown(self, signum, frame) -> None:
        logger.info("Shutdown signal received.")
        self._running = False

    async def _interruptible_sleep(self, seconds: float) -> None:
        for _ in range(int(seconds / 0.5)):
            if not self._running:
                return
            await asyncio.sleep(0.5)
        if self._running:
            remaining = seconds % 0.5
            if remaining > 0:
                await asyncio.sleep(remaining)

    # ── Teardown ────────────────────────────────────────────────────────────

    async def _teardown(self) -> None:
        logger.info("Shutting down...")
        if self._turn_count > 0:
            logger.info("Summary: %d turns | Block: %s | Recoveries: %d | Triggers: %s",
                         self._turn_count, self._schedule.current_block.value,
                         self._dead_air.recovery_count, self._triggers.active)

        await self._director.stop()
        self._dead_air.stop()
        self._webhook_server.stop()
        self._keeper.stop()

        if USE_DUAL_ANCHOR and hasattr(self._commentary, 'flush_memory'):
            self._commentary.flush_memory()
        elif hasattr(self._commentary, 'flush_memory'):
            self._commentary.flush_memory()

        self._memory.persistent.record_session(self._memory.session)
        self._memory.flush()

        if self._stream_id and self._anchor:
            try:
                self._bridge.update_livestream(self._stream_id, self._anchor, status="ended")
            except Exception:
                pass

        await self._media_mixer.stop()
        await self._scene_engine.stop()
        self._bridge.close()

        logger.info("=" * 70)
        logger.info("  Video show ended — %d turns", self._turn_count)
        logger.info("  Respawns: %d | Recoveries: %d", self._keeper.respawn_count, self._dead_air.recovery_count)
        logger.info("=" * 70)


# ── CLI ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Buzz AI Video Livestream — Enterprise Edition")
    parser.add_argument("--turn-interval", type=int, default=int(os.environ.get("TURN_INTERVAL_SECONDS", "30")))
    parser.add_argument("--rotation-interval", type=int, default=int(os.environ.get("SCENE_ROTATION_INTERVAL", "6")))
    parser.add_argument("--stream-title", default=os.environ.get("STREAM_TITLE", "Buzz News Live"))
    parser.add_argument("--stream-category", default=os.environ.get("STREAM_CATEGORY", "News"))
    parser.add_argument("--width", type=int, default=int(os.environ.get("SCENE_WIDTH", "1280")))
    parser.add_argument("--height", type=int, default=int(os.environ.get("SCENE_HEIGHT", "720")))
    parser.add_argument("--fps", type=int, default=int(os.environ.get("SCENE_FPS", "15")))
    parser.add_argument("--max-turns", type=int, default=0)
    parser.add_argument("--log-level", default=os.environ.get("LOG_LEVEL", "INFO"))
    args = parser.parse_args()

    setup_logging(args.log_level)
    runner = VideoRunner(
        turn_interval=args.turn_interval,
        rotation_interval=args.rotation_interval,
        stream_title=args.stream_title,
        stream_category=args.stream_category,
        max_turns=args.max_turns,
        width=args.width,
        height=args.height,
        fps=args.fps,
    )
    runner.run()


if __name__ == "__main__":
    main()
