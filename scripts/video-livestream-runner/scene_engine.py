#!/usr/bin/env python3
"""
scene_engine.py
Enterprise-grade Playwright-based headless browser scene renderer.

Supports dynamic scene switching, lower thirds, ticker updates,
topic cards, and multi-scene template library (news_desk, market_board,
chill_lounge, debate_split, music_break, breaking_news).

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
from typing import Optional

logger = logging.getLogger(__name__)

SCENE_DIR = pathlib.Path(__file__).parent / "scenes"
FRAME_QUEUE_MAX = 10

SCENE_TEMPLATES = {
    "news_desk": "news_desk.html",
    "market_board": "market_board.html",
    "chill_lounge": "chill_lounge.html",
    "debate_split": "debate_split.html",
    "music_break": "music_break.html",
    "breaking_news": "breaking_news.html",
    "live_news": "news_desk.html",
    "data_card": "data_card.html",
    "break_card": "break_card.html",
}


class SceneEngine:
    """
    Renders HTML scene templates via Playwright and captures PNG frames.

    Supports dynamic scene switching, overlay injection, and
    multi-ticker/breaking-banner/lower-third control.

    Usage:
        engine = SceneEngine(width=1280, height=720, fps=15)
        await engine.start("news_desk")
        await engine.update_topic("Headline", "Commentary", "neutral", "Zara")
        await engine.update_ticker(["Headline 1", "Headline 2"])
        await engine.show_lower_third("Title", "Subtitle")
        await engine.switch_scene("market_board")
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
        self._current_scene: str = ""

        self.frame_queue: asyncio.Queue = asyncio.Queue(maxsize=FRAME_QUEUE_MAX)
        self._stop_event = asyncio.Event()

    # ── Lifecycle ────────────────────────────────────────────────────────────

    async def start(self, scene_name: str = "news_desk") -> None:
        from playwright.async_api import async_playwright

        scene_file = SCENE_TEMPLATES.get(scene_name, "news_desk.html")
        scene_path = SCENE_DIR / scene_file

        if not scene_path.exists():
            logger.warning("Scene '%s' not found, falling back to news_desk", scene_name)
            scene_path = SCENE_DIR / "news_desk.html"

        url = scene_path.as_uri()
        logger.info(
            "SceneEngine starting — %s (%s) at %dx%d %dfps",
            scene_name, scene_file, self._width, self._height, self._fps,
        )

        pw = await async_playwright().start()
        self._browser = await pw.chromium.launch(headless=True)
        context = await self._browser.new_context(
            viewport={"width": self._width, "height": self._height},
            device_scale_factor=1,
        )
        self._page = await context.new_page()
        await self._page.goto(url, wait_until="networkidle", timeout=15000)
        logger.info("Scene page loaded: %s", scene_name)

        self._current_scene = scene_name
        self._running = True
        self._stop_event.clear()
        self._capture_task = asyncio.create_task(self._capture_loop())

    async def stop(self) -> None:
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

    async def update_topic(
        self,
        headline: str,
        commentary: str,
        visual_cue: str = "neutral",
        speaker: Optional[str] = None,
    ) -> None:
        if not self._page:
            return
        escaped_headline = headline.replace("'", "\\'")
        escaped_commentary = commentary.replace("'", "\\'")
        escaped_speaker = (speaker or "").replace("'", "\\'")
        cue = visual_cue or "neutral"

        js = (
            f"window.updateContent("
            f"'{escaped_headline}', '{escaped_commentary}', '{cue}', '{escaped_speaker}')"
        )
        try:
            await self._page.evaluate(js)
        except Exception as exc:
            logger.warning("Scene update failed: %s", exc)

    async def update_ticker(self, headlines: list[str]) -> None:
        if not self._page or not headlines:
            return
        try:
            js_headlines = json.dumps(headlines)
            await self._page.evaluate(f"window.updateTicker({js_headlines})")
        except Exception as exc:
            logger.warning("Ticker update failed: %s", exc)

    async def show_lower_third(self, title: str, sub: str) -> None:
        if not self._page:
            return
        escaped_title = title.replace("'", "\\'")
        escaped_sub = sub.replace("'", "\\'")
        try:
            await self._page.evaluate(
                f"window.showLowerThird('{escaped_title}', '{escaped_sub}')"
            )
        except Exception as exc:
            logger.warning("Lower third failed: %s", exc)

    async def hide_lower_third(self) -> None:
        if not self._page:
            return
        try:
            await self._page.evaluate("window.hideLowerThird()")
        except Exception:
            pass

    async def show_topic_card(self, body: str) -> None:
        if not self._page:
            return
        escaped = body.replace("'", "\\'")
        try:
            await self._page.evaluate(f"window.showTopicCard('{escaped}')")
        except Exception as exc:
            logger.warning("Topic card failed: %s", exc)

    async def hide_topic_card(self) -> None:
        if not self._page:
            return
        try:
            await self._page.evaluate("window.hideTopicCard()")
        except Exception:
            pass

    async def set_block(self, block: str) -> None:
        if not self._page:
            return
        try:
            await self._page.evaluate(f"window.setBlock('{block}')")
        except Exception:
            pass

    async def update_market_prices(self, prices: dict) -> None:
        if not self._page:
            return
        try:
            await self._page.evaluate(f"window.updateMarketPrices({json.dumps(prices)})")
        except Exception as exc:
            logger.warning("Market prices update failed: %s", exc)

    async def update_debate(self, zara_text: str, dex_text: str, topic: str) -> None:
        if not self._page:
            return
        escaped_zara = zara_text.replace("'", "\\'")
        escaped_dex = dex_text.replace("'", "\\'")
        escaped_topic = topic.replace("'", "\\'")
        try:
            await self._page.evaluate(
                f"window.updateDebate('{escaped_zara}', '{escaped_dex}', '{escaped_topic}')"
            )
        except Exception as exc:
            logger.warning("Debate update failed: %s", exc)

    async def show_community_comment(self, comment: str) -> None:
        if not self._page:
            return
        escaped = comment.replace("'", "\\'")
        try:
            await self._page.evaluate(f"window.showCommunityComment('{escaped}')")
        except Exception:
            pass

    async def update_music_timer(self, seconds: int) -> None:
        if not self._page:
            return
        try:
            await self._page.evaluate(f"window.updateTimer({seconds})")
        except Exception:
            pass

    async def switch_scene(self, scene_name: str) -> None:
        scene_file = SCENE_TEMPLATES.get(scene_name)
        if not scene_file:
            logger.warning("Unknown scene '%s'", scene_name)
            return
        scene_path = SCENE_DIR / scene_file
        if not scene_path.exists():
            logger.warning("Scene '%s' file not found", scene_file)
            return
        if self._page:
            try:
                await self._page.goto(
                    scene_path.as_uri(),
                    wait_until="networkidle",
                    timeout=10000,
                )
                self._current_scene = scene_name
                logger.info("Switched to scene: %s", scene_name)
            except Exception as exc:
                logger.warning("Scene switch failed: %s", exc)

    @property
    def current_scene(self) -> str:
        return self._current_scene

    # ── Capture Loop ─────────────────────────────────────────────────────────

    async def _capture_loop(self) -> None:
        frame_count = 0
        last_stat = time.monotonic()

        while self._running and not self._stop_event.is_set():
            t0 = time.monotonic()
            try:
                png_bytes = await self._page.screenshot(
                    type="png",
                    clip={
                        "x": 0, "y": 0,
                        "width": self._width, "height": self._height,
                    },
                )
                if not self.frame_queue.full():
                    await self.frame_queue.put(png_bytes)
                frame_count += 1

                now = time.monotonic()
                if now - last_stat >= 10:
                    logger.debug(
                        "Capture: %d frames  queue: %d/%d  scene: %s",
                        frame_count, self.frame_queue.qsize(),
                        FRAME_QUEUE_MAX, self._current_scene,
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
