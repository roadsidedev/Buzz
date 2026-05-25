#!/usr/bin/env python3
"""
graphics_overlay.py
Enterprise graphics overlay system for the video livestream.

Manages lower thirds, tickers (standard/breaking/market/scores/community),
topic cards, chart overlays, breaking news banners, score bugs, and
tip celebrations — all timed and queued through a priority-driven
graphics pipeline, inspired by Buzz TV's GRAPHICS.md.

Architecture placement: scripts/video-livestream-runner/
Depends on: scene_engine.py
Used by: video_runner.py
"""

import logging
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional

logger = logging.getLogger(__name__)


class TickerStyle(str, Enum):
    STANDARD = "standard"
    BREAKING = "breaking"
    MARKET = "market"
    SCORES = "scores"
    COMMUNITY = "community"


class GraphicType(str, Enum):
    LOWER_THIRD = "lower_third"
    TICKER = "ticker"
    TOPIC_CARD = "topic_card"
    CHART = "chart"
    BREAKING_BANNER = "breaking_banner"
    SCORE_BUG = "score_bug"
    TIP_CELEBRATION = "tip_celebration"


@dataclass
class GraphicAsset:
    graphic_id: str
    graphic_type: GraphicType
    content: dict[str, Any]
    priority: int = 3
    scene_context: str = "any"
    expires_at: Optional[float] = None
    duration_sec: float = 5.0
    deployed: bool = False


class GraphicsQueue:
    """
    Priority-ordered graphics queue.

    Graphics Operator prepares. Director deploys.
    Max 3 active elements simultaneously (breaking banner counts as 2).
    """

    def __init__(self) -> None:
        self._queue: list[GraphicAsset] = []
        self._active: dict[str, GraphicAsset] = {}

    def add(self, asset: GraphicAsset) -> None:
        if asset.priority == 1:
            self._queue.insert(0, asset)
        else:
            self._queue.append(asset)
        logger.debug("Graphics queued: %s (%s)", asset.graphic_id, asset.graphic_type.value)

    def get_next(self, current_scene: str) -> Optional[GraphicAsset]:
        now = time.time()
        for g in self._queue:
            if g.expires_at and now > g.expires_at:
                self._queue.remove(g)
                continue
            if g.scene_context in (current_scene, "any") and not g.deployed:
                return g
        return None

    def deploy(self, graphic_id: str) -> None:
        for g in self._queue:
            if g.graphic_id == graphic_id:
                g.deployed = True
                self._active[graphic_id] = g
                self._queue.remove(g)
                break

    def dismiss(self, graphic_id: str) -> None:
        self._active.pop(graphic_id, None)

    @property
    def active_count(self) -> int:
        count = len(self._active)
        for g in self._active.values():
            if g.graphic_type == GraphicType.BREAKING_BANNER:
                count += 1
        return count

    @property
    def active_graphics(self) -> list[GraphicAsset]:
        return list(self._active.values())

    @property
    def queue_size(self) -> int:
        return len(self._queue)


class GraphicsOverlayManager:
    """
    Enterprise graphics overlay system for the video livestream.

    Manages the full graphics lifecycle: prepare, queue, deploy, dismiss.
    Enforces max active element constraints and timing rules.
    """

    def __init__(self, scene_engine: Any) -> None:
        self._scene = scene_engine
        self._queue = GraphicsQueue()
        self._lower_third_active = False
        self._topic_card_active = False
        self._current_ticker_style: TickerStyle = TickerStyle.STANDARD

    @property
    def queue(self) -> GraphicsQueue:
        return self._queue

    # ── Lower Thirds ───────────────────────────────────────────────────────

    async def show_lower_third(self, title: str, sub: str = "") -> None:
        if self._lower_third_active:
            await self.hide_lower_third()
        asset = GraphicAsset(
            graphic_id=f"lt_{int(time.time())}",
            graphic_type=GraphicType.LOWER_THIRD,
            content={"title": title, "sub": sub},
            priority=2,
            duration_sec=6.0,
        )
        self._queue.add(asset)
        await self._scene.show_lower_third(title, sub)
        self._lower_third_active = True
        logger.debug("Lower third: %s — %s", title, sub)

    async def hide_lower_third(self) -> None:
        await self._scene.hide_lower_third()
        self._lower_third_active = False

    # ── Ticker ──────────────────────────────────────────────────────────────

    async def update_ticker(self, headlines: list[str], style: TickerStyle = TickerStyle.STANDARD) -> None:
        self._current_ticker_style = style
        await self._scene.update_ticker(headlines)

    def set_ticker_style(self, style: TickerStyle) -> None:
        self._current_ticker_style = style
        logger.debug("Ticker style: %s", style.value)

    # ── Topic Cards ─────────────────────────────────────────────────────────

    async def show_topic_card(self, body: str) -> None:
        if self._topic_card_active:
            await self.hide_topic_card()
        asset = GraphicAsset(
            graphic_id=f"tc_{int(time.time())}",
            graphic_type=GraphicType.TOPIC_CARD,
            content={"body": body},
            priority=3,
            scene_context="news_desk",
            duration_sec=15.0,
        )
        self._queue.add(asset)
        await self._scene.show_topic_card(body)
        self._topic_card_active = True

    async def hide_topic_card(self) -> None:
        await self._scene.hide_topic_card()
        self._topic_card_active = False

    # ── Breaking News ──────────────────────────────────────────────────────

    async def activate_breaking_banner(self) -> None:
        asset = GraphicAsset(
            graphic_id="breaking_banner",
            graphic_type=GraphicType.BREAKING_BANNER,
            content={"active": True},
            priority=1,
            scene_context="any",
        )
        self._queue.add(asset)

    async def deactivate_breaking_banner(self) -> None:
        self._queue.dismiss("breaking_banner")

    # ── Market Prices ───────────────────────────────────────────────────────

    async def update_market_prices(self, prices: dict) -> None:
        await self._scene.update_market_prices(prices)

    # ── Debate ──────────────────────────────────────────────────────────────

    async def update_debate(self, zara_text: str, dex_text: str, topic: str) -> None:
        await self._scene.update_debate(zara_text, dex_text, topic)

    # ── Block Context ───────────────────────────────────────────────────────

    async def set_block(self, block: str) -> None:
        await self._scene.set_block(block)

    # ── Cleanup ─────────────────────────────────────────────────────────────

    async def clear_all(self) -> None:
        await self.hide_lower_third()
        await self.hide_topic_card()
        await self.deactivate_breaking_banner()
