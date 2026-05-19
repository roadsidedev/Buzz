#!/usr/bin/env python3
"""
video_runner.py
Top-level daemon that wires all video-livestream-runner modules into a 24/7
video broadcast loop.

Main loop (every ~30s):
  1. LivestreamBridge manages livestream lifecycle (create, heartbeat, respawn)
  2. CommentaryEngine generates AI anchor commentary from news/data
  3. SceneEngine renders HTML scene → PNG frames at 15fps
  4. MediaMixer pipes frames + TTS audio → FFmpeg → H.264+AAC → RTMP
  5. StreamKeeper watchdog monitors FFmpeg + backend health
  6. SceneScheduler rotates between visual scene types

Architecture placement: scripts/video-livestream-runner/
Used by: CLI / systemd / Docker

Usage:
  python video_runner.py
  python video_runner.py --turn-interval 30
  python video_runner.py --max-turns 10  (testing)
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

from commentary_engine import CommentaryEngine
from event_listener import EventQueue, WebhookServer
from livestream_bridge import LivestreamBridge, RegisteredAgent
from media_mixer import MediaMixer
from scene_engine import SceneEngine
from scene_scheduler import SceneScheduler
from stream_keeper import StreamKeeper

LOG_FORMAT = "[%(asctime)s] [%(name)-18s] [%(levelname)-5s] %(message)s"


def setup_logging(level: str = "INFO") -> None:
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format=LOG_FORMAT,
        datefmt="%H:%M:%S",
        stream=sys.stdout,
    )


logger = logging.getLogger("video_runner")

BACKEND_URL = os.environ.get("LIVESTREAM_BACKEND_URL", "https://clawzz-backend-live.up.railway.app")
NEWS_POLL_INTERVAL = int(os.environ.get("NEWS_POLL_INTERVAL_SECONDS", "180"))


class VideoRunner:
    """
    Orchestrates the 24/7 video livestream: data → commentary → scene → RTMP.

    Wires together LivestreamBridge, CommentaryEngine, SceneEngine,
    MediaMixer, SceneScheduler, and StreamKeeper.
    """

    def __init__(
        self,
        turn_interval: int = 30,
        rotation_interval: int = 6,
        scene_duration: int = 180,
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

        self._bridge = LivestreamBridge(backend_url=BACKEND_URL)
        self._commentary = CommentaryEngine()
        self._scene_engine = SceneEngine(width=width, height=height, fps=fps)
        self._media_mixer = MediaMixer(width=width, height=height, fps=fps)
        self._scheduler = SceneScheduler(rotation_interval=rotation_interval)
        self._event_queue = EventQueue()
        self._webhook_server = WebhookServer(
            port=int(os.environ.get("WEBHOOK_PORT", "8081")),
            event_queue=self._event_queue,
        )

        self._anchor: Optional[RegisteredAgent] = None
        self._stream_id: str = ""
        self._keeper = StreamKeeper(
            bridge=self._bridge,
            on_stream_changed=self._handle_stream_change,
        )

    # ── Lifecycle ────────────────────────────────────────────────────────────

    def run(self) -> None:
        """Start the video broadcast. Blocks until stopped."""
        self._running = True

        signal.signal(signal.SIGINT, self._handle_shutdown)
        signal.signal(signal.SIGTERM, self._handle_shutdown)

        try:
            asyncio.run(self._async_run())
        except KeyboardInterrupt:
            pass
        finally:
            pass

    async def _async_run(self) -> None:
        """Async setup + main loop."""
        try:
            await self._setup()
            await self._main_loop()
        except KeyboardInterrupt:
            pass
        except Exception as exc:
            logger.critical("Fatal error: %s", exc, exc_info=True)
        finally:
            await self._teardown()

    def _async_shutdown(self) -> None:
        """Callback for signal handlers to stop the asyncio loop."""
        self._running = False

    # ── Setup ─────────────────────────────────────────────────────────────────

    async def _setup(self) -> None:
        agent_suffix = os.environ.get("LIVESTREAM_AGENT_SUFFIX", "01")

        logger.info("=" * 60)
        logger.info("  Buzz Video Livestream Runner — Starting up")
        logger.info(f"  Backend      : {BACKEND_URL}")
        logger.info(f"  Turn interval: {self._turn_interval}s")
        logger.info(f"  Resolution   : {self._width}x{self._height} @ {self._fps}fps")
        logger.info(f"  Stream title : {self._stream_title}")
        logger.info(f"  Max turns    : {self._max_turns or 'unlimited'}")
        logger.info("=" * 60)

        # ── Dependency checks — fail fast if critical tools are missing ──────
        if not shutil.which("ffmpeg"):
            raise RuntimeError(
                "ffmpeg not found on PATH. Install: https://ffmpeg.org/download.html"
            )
        logger.info("FFmpeg found: %s", shutil.which("ffmpeg"))

        try:
            from playwright.async_api import async_playwright
            logger.info("Playwright module available")
        except ImportError:
            raise RuntimeError(
                "Playwright not installed. Run: pip install playwright && playwright install chromium"
            )

        # 0. Wait for backend
        logger.info("Waiting for backend health check...")
        self._bridge.wait_for_backend()

        # 1. Register anchor agent
        logger.info("Registering anchor agent...")
        self._anchor = self._bridge.register_or_reuse_agent(
            name=f"News Anchor ({agent_suffix})",
            username=f"video_anchor_{agent_suffix}",
            pre_auth_key=os.environ.get("LIVESTREAM_AGENT_API_KEY"),
        )

        # 2. Create initial livestream
        logger.info("Creating livestream...")
        stream = self._bridge.create_livestream(
            agent=self._anchor,
            title=self._stream_title,
            category=self._stream_category,
        )
        self._stream_id = stream.id
        self._current_rtmp_url = self._bridge.build_rtmp_url(stream)

        # 3. Start SceneEngine (Playwright headless browser)
        logger.info("Starting scene engine...")
        await self._scene_engine.start("live_news")

        # 4. Start MediaMixer (FFmpeg pipeline to RTMP)
        logger.info("Starting media mixer...")
        await self._media_mixer.start(
            rtmp_url=self._current_rtmp_url,
            frame_queue=self._scene_engine.frame_queue,
        )

        # 5. Send initial heartbeat
        if self._anchor:
            self._bridge.send_heartbeat(self._stream_id, self._anchor)

        # 6. Start StreamKeeper watchdog
        self._keeper.start(
            stream_id=self._stream_id,
            rtmp_url=self._current_rtmp_url,
            agent=self._anchor,
            title=self._stream_title,
            category=self._stream_category,
        )

        logger.info(f"Livestream ready — ID: {self._stream_id[:8]}...")
        logger.info(f"RTMP URL: {self._current_rtmp_url}")

        # 7. Start Webhook server for external events
        self._webhook_server.start()

    # ── Main Loop ─────────────────────────────────────────────────────────────

    async def _main_loop(self) -> None:
        """Core turn loop: generate commentary → update scene → repeat."""
        while self._running:
            try:
                # Check stream keeper health
                if self._keeper.failed:
                    logger.critical("Stream keeper permanently failed — stopping.")
                    self._running = False
                    break

                # Check FFmpeg process health
                if not self._media_mixer.is_running:
                    rc = self._media_mixer.ffmpeg_returncode
                    logger.critical("FFmpeg process died (exit code %s) — stopping.", rc)
                    self._running = False
                    break

                # 1. Generate commentary
                logger.info(f"Turn {self._turn_count + 1} — generating commentary...")
                commentary = self._generate_commentary()

                logger.info(f"  Topic: {commentary.topic[:50]}...")
                logger.info(f"  Cue:   {commentary.visual_cue}")
                logger.info(f"  Text:  {commentary.text[:80]}...")

                # 2. Update the visual scene
                await self._scene_engine.update_topic(
                    headline=commentary.topic,
                    commentary=commentary.text,
                    visual_cue=commentary.visual_cue,
                )

                # 3. Synthesize commentary to audio and queue it
                if self._anchor:
                    audio = self._bridge.synthesize_speech(
                        text=commentary.text,
                        agent=self._anchor,
                        voice_name=self._anchor.name,
                        stream_id=self._stream_id,
                    )
                    if audio:
                        await self._media_mixer.queue_audio(audio)
                        logger.info("  Audio queued: %d bytes", len(audio))
                    else:
                        logger.warning("  No audio synthesized (TTS returned None)")

                # 4. Send heartbeat
                if self._anchor:
                    self._bridge.send_heartbeat(self._stream_id, self._anchor)

                self._turn_count += 1
                self._scheduler.record_turn()
                self._first_turn_done = True

                logger.info(f"  Turn {self._turn_count} complete")

                # 5. Check scene rotation
                if self._scheduler.should_rotate():
                    rotation = self._scheduler.next_scene()
                    await self._scene_engine.switch_scene(rotation.scene_name)

                # 6. Check max turns
                if self._max_turns and self._turn_count >= self._max_turns:
                    logger.info(f"Max turns ({self._max_turns}) reached — stopping.")
                    self._running = False
                    break

                # 7. Wait for next turn
                logger.debug(f"Sleeping {self._turn_interval}s until next turn...")
                await self._interruptible_sleep(self._turn_interval)

            except Exception as exc:
                logger.error(f"Turn loop error: {exc}", exc_info=True)
                await self._interruptible_sleep(5)

    # ── Commentary Generation ─────────────────────────────────────────────────

    def _generate_commentary(self):
        """Generate one turn of anchor commentary."""
        import feedparser
        import random

        incoming_events = self._event_queue.pop_all()
        event_text = None
        if incoming_events:
            event_text = str(incoming_events[0].payload)

        try:
            feed = feedparser.parse("https://feeds.bbci.co.uk/news/technology/rss.xml")
            entries = feed.get("entries", [])
            if entries:
                top = entries[0]
                topic = top.get("title", "Technology News")
                context = top.get("summary", "")[:200]
            else:
                topic = "Technology News"
                context = "Latest developments in AI and technology"
        except Exception:
            topic = "Technology News"
            context = "Latest developments in AI and technology"

        return self._commentary.generate(
            topic=topic,
            context=context,
            incoming_event=event_text,
        )

    # ── Callbacks ─────────────────────────────────────────────────────────────

    def _handle_stream_change(self, old_id: str, new_id: str, new_rtmp: str) -> None:
        """Callback from StreamKeeper when a stream respawn occurs."""
        if not new_id:
            logger.critical("StreamKeeper exhausted all attempts — stopping.")
            self._running = False
            return
        logger.info("Stream respawned: %s → %s", old_id[:8], new_id[:8])
        self._stream_id = new_id
        self._current_rtmp_url = new_rtmp

    def _handle_shutdown(self, signum, frame) -> None:
        """Handle SIGINT/SIGTERM."""
        logger.info("Shutdown signal received — finishing current turn...")
        self._running = False

    async def _interruptible_sleep(self, seconds: float) -> None:
        """Sleep that can be interrupted by setting self._running = False."""
        for _ in range(int(seconds / 0.5)):
            if not self._running:
                return
            await asyncio.sleep(0.5)
        if self._running:
            remaining = seconds % 0.5
            if remaining > 0:
                await asyncio.sleep(remaining)

    # ── Teardown ──────────────────────────────────────────────────────────────

    async def _teardown(self) -> None:
        """Clean shutdown: stop stream, FFmpeg, Playwright, flush memory."""
        logger.info("Video livestream runner shutting down...")

        self._webhook_server.stop()
        self._keeper.stop()

        self._commentary.flush_memory()

        if self._stream_id and self._anchor:
            try:
                self._bridge.update_livestream(
                    self._stream_id, self._anchor, status="ended",
                )
                logger.info("Livestream %s marked as ended", self._stream_id[:8])
            except Exception as exc:
                logger.warning("Could not update livestream status: %s", exc)

        await self._media_mixer.stop()
        await self._scene_engine.stop()
        self._bridge.close()

        logger.info("=" * 60)
        logger.info(f"  Video show ended after {self._turn_count} turns")
        logger.info(f"  Stream respawns: {self._keeper.respawn_count}")
        logger.info("=" * 60)


# ── CLI ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Buzz AI Video Livestream — 24/7 AI news broadcast"
    )
    parser.add_argument(
        "--turn-interval",
        type=int,
        default=int(os.environ.get("TURN_INTERVAL_SECONDS", "30")),
        help="Seconds between commentary turns (default: 30)",
    )
    parser.add_argument(
        "--rotation-interval",
        type=int,
        default=int(os.environ.get("SCENE_ROTATION_INTERVAL", "6")),
        help="Turns between scene rotations (default: 6)",
    )
    parser.add_argument(
        "--stream-title",
        default=os.environ.get("STREAM_TITLE", "Buzz News Live"),
        help="Livestream title (default: Buzz News Live)",
    )
    parser.add_argument(
        "--stream-category",
        default=os.environ.get("STREAM_CATEGORY", "News"),
        help="Livestream category (default: News)",
    )
    parser.add_argument(
        "--width",
        type=int,
        default=int(os.environ.get("SCENE_WIDTH", "1280")),
        help="Stream width (default: 1280)",
    )
    parser.add_argument(
        "--height",
        type=int,
        default=int(os.environ.get("SCENE_HEIGHT", "720")),
        help="Stream height (default: 720)",
    )
    parser.add_argument(
        "--fps",
        type=int,
        default=int(os.environ.get("SCENE_FPS", "15")),
        help="Capture framerate (default: 15)",
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
