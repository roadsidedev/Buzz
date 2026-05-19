#!/usr/bin/env python3
"""
scene_engine.py
Playwright-based headless browser that renders HTML scenes and captures
them as PNG frames for the FFmpeg media pipeline.

Manages a live HTML page that can be dynamically updated via JavaScript
injection, then screenshotted at configurable FPS.

Architecture placement: scripts/video-livestream-runner/
Depends on: playwright (pip), scenes/*.html
Used by: video_runner.py
"""

import asyncio
import json
import logging
import os
import pathlib
import time

logger = logging.getLogger(__name__)

SCENE_DIR = pathlib.Path(__file__).parent / "scenes"
FRAME_QUEUE_MAX = 10


class SceneEngine:
    """
    Renders HTML scene templates via Playwright and captures PNG frames.

    Usage:
        engine = SceneEngine(width=1280, height=720, fps=15)
        await engine.start("live_news")
        await engine.update_topic("Bitcoin hits $100K", "Great news!", "positive")
        # ... MediaMixer reads from engine.frame_queue ...
        await engine.stop()
    """

    def __init__(
        self,
        width: int = 1280,
        height: int = 720,
        fps: int = 15,
    ) -> None:
        self._width = width
        self._height = height
        self._frame_interval = 1.0 / fps
        self._fps = fps

        self._browser = None
        self._page = None
        self._capture_task: Optional[asyncio.Task] = None
        self._running = False

        # Frame queue — consumed by MediaMixer
        self.frame_queue: asyncio.Queue = asyncio.Queue(maxsize=FRAME_QUEUE_MAX)
        self._stop_event = asyncio.Event()

    # ── Lifecycle ────────────────────────────────────────────────────────────

    async def start(self, scene_name: str = "live_news") -> None:
        """
        Launch headless Chromium and open the scene HTML file.
        """
        from playwright.async_api import async_playwright

        scene_path = SCENE_DIR / f"{scene_name}.html"
        if not scene_path.exists():
            logger.warning("Scene '%s' not found, falling back to live_news", scene_name)
            scene_path = SCENE_DIR / "live_news.html"

        url = scene_path.as_uri()
        logger.info("SceneEngine starting — %s at %dx%d %dfps", url, self._width, self._height, self._fps)

        pw = await async_playwright().start()
        self._browser = await pw.chromium.launch(headless=True)
        context = await self._browser.new_context(
            viewport={"width": self._width, "height": self._height},
            device_scale_factor=1,
        )
        self._page = await context.new_page()

        await self._page.goto(url, wait_until="networkidle", timeout=15000)
        logger.info("Scene page loaded")

        self._running = True
        self._stop_event.clear()
        self._capture_task = asyncio.create_task(self._capture_loop())

    async def stop(self) -> None:
        """Stop capture loop and close browser."""
        self._running = False
        self._stop_event.set()
        if self._capture_task:
            self._capture_task.cancel()
            try:
                await self._capture_task
            except asyncio.CancelledError:
                pass
        if self._browser:
            await self._browser.close()
        logger.info("SceneEngine stopped")

    # ── Scene Updates ────────────────────────────────────────────────────────

    async def update_topic(self, headline: str, commentary: str, visual_cue: str) -> None:
        """
        Update the live scene with new content via JS injection.

        The scene HTML exposes window.updateContent(headline, commentary, cue)
        for dynamic updates.
        """
        if not self._page:
            return
        cue = visual_cue or "neutral"
        escaped_headline = headline.replace("'", "\\'")
        escaped_commentary = commentary.replace("'", "\\'")
        js = f"window.updateContent('{escaped_headline}', '{escaped_commentary}', '{cue}')"
        try:
            await self._page.evaluate(js)
            logger.debug("Scene updated — topic='%s' cue=%s", headline[:40], cue)
        except Exception as exc:
            logger.warning("Scene update failed: %s", exc)

    async def update_ticker(self, headlines: list[str]) -> None:
        """Update the scrolling news ticker with fresh headlines."""
        if not self._page or not headlines:
            return
        js_headlines = json.dumps(headlines)
        try:
            await self._page.evaluate(f"window.updateTicker({js_headlines})")
        except Exception as exc:
            logger.warning("Ticker update failed: %s", exc)

    async def switch_scene(self, scene_name: str) -> None:
        """Hot-swap to a different scene template."""
        scene_path = SCENE_DIR / f"{scene_name}.html"
        if not scene_path.exists():
            logger.warning("Cannot switch to scene '%s' — not found", scene_name)
            return
        if self._page:
            try:
                await self._page.goto(scene_path.as_uri(), wait_until="networkidle", timeout=10000)
                logger.info("Switched to scene: %s", scene_name)
            except Exception as exc:
                logger.warning("Scene switch failed: %s", exc)

    # ── Capture Loop ─────────────────────────────────────────────────────────

    async def _capture_loop(self) -> None:
        """Continuously screenshot the page at the configured FPS."""
        frame_count = 0
        last_stat = time.monotonic()

        while self._running and not self._stop_event.is_set():
            t0 = time.monotonic()
            try:
                png_bytes = await self._page.screenshot(
                    type="png",
                    clip={"x": 0, "y": 0, "width": self._width, "height": self._height},
                )
                if not self.frame_queue.full():
                    await self.frame_queue.put(png_bytes)
                frame_count += 1

                now = time.monotonic()
                if now - last_stat >= 10:
                    logger.debug(
                        "Capture: %d frames  queue: %d/%d",
                        frame_count, self.frame_queue.qsize(), FRAME_QUEUE_MAX,
                    )
                    frame_count = 0
                    last_stat = now
            except Exception as exc:
                logger.warning("Capture error: %s", exc)
                await asyncio.sleep(1)

            elapsed = time.monotonic() - t0
            sleep_for = max(0.0, self._frame_interval - elapsed)
            if sleep_for > 0:
                await asyncio.sleep(sleep_for)
