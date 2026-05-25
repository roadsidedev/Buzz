#!/usr/bin/env python3
"""Comprehensive tests for all new video-runner modules."""

import json
import os
import sys
import time
import pytest
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


class TestAnchorProfiles:
    def test_zara_profile(self):
        from anchor_profiles import get_primary, ZARA
        profile = get_primary()
        assert profile.name == "Zara"
        assert profile.is_primary
        assert "headlines" in profile.segment_ownership
        assert "breaking_news" in profile.segment_ownership

    def test_dex_profile(self):
        from anchor_profiles import get_secondary, DEX
        profile = get_secondary()
        assert profile.name == "Dex"
        assert not profile.is_primary
        assert "market_desk" in profile.segment_ownership

    def test_format_identity_prompt(self):
        from anchor_profiles import format_identity_prompt, ZARA
        prompt = format_identity_prompt(ZARA)
        assert "Zara" in prompt
        assert "Core Identity" in prompt
        assert "main anchor" in prompt.lower()


class TestDualCommentaryEngine:
    def test_scorer_heuristic(self):
        from dual_commentary_engine import OrchestrationScorer, LLMClient
        llm = LLMClient()
        scorer = OrchestrationScorer(llm)
        scores, total = scorer._heuristic_score(
            "Bitcoin just hit a new all-time high of $100,000.",
            "Dex",
            "Bitcoin hits $100K",
            ["Last turn was about tech stocks"],
        )
        assert isinstance(scores, dict)
        assert all(k in scores for k in ["relevance", "novelty", "coherence", "actionability", "engagement"])
        assert 0 <= total <= 100


class TestProgrammingSchedule:
    def test_block_detection(self):
        from programming_schedule import ProgrammingSchedule, TimeBlock
        sched = ProgrammingSchedule()
        assert isinstance(sched.current_block, TimeBlock)

    def test_segment_duration(self):
        from programming_schedule import ProgrammingSchedule
        sched = ProgrammingSchedule()
        dur = sched.get_segment_duration("headlines")
        assert isinstance(dur, int)
        assert dur > 0

    def test_hourly_schedule(self):
        from programming_schedule import ProgrammingSchedule
        sched = ProgrammingSchedule()
        slots = sched.get_segments_for_hour()
        assert len(slots) > 0
        assert all(s.segment_id for s in slots)
        assert all(s.duration_sec > 0 for s in slots)


class TestDeadAirMonitor:
    def test_ping_resets_timer(self):
        from dead_air_monitor import DeadAirMonitor
        monitor = DeadAirMonitor(silence_threshold=10)
        monitor.ping()
        assert monitor.silence_duration < 1.0

    def test_initial_state(self):
        from dead_air_monitor import DeadAirMonitor, BroadcastState
        monitor = DeadAirMonitor()
        assert monitor.state == BroadcastState.LIVE

    def test_recovery_sequence_defined(self):
        from dead_air_monitor import RECOVERY_SEQUENCE
        assert len(RECOVERY_SEQUENCE) > 0
        assert all(a.speaker for a in RECOVERY_SEQUENCE)


class TestGraphicsOverlay:
    def test_graphics_queue_priority(self):
        from graphics_overlay import GraphicsQueue, GraphicAsset, GraphicType
        q = GraphicsQueue()
        q.add(GraphicAsset("a", GraphicType.LOWER_THIRD, {"title": "test"}, priority=3))
        q.add(GraphicAsset("b", GraphicType.BREAKING_BANNER, {}, priority=1))
        next_asset = q.get_next("news_desk")
        assert next_asset is not None
        assert next_asset.graphic_id == "b"

    def test_active_count(self):
        from graphics_overlay import GraphicsQueue, GraphicAsset, GraphicType
        q = GraphicsQueue()
        assert q.active_count == 0


class TestEditorialPipeline:
    def test_researcher_transforms(self):
        from editorial_pipeline import NewsResearcher
        researcher = NewsResearcher()
        stories = researcher.transform([
            {"title": "Bitcoin hits $100K", "summary": "New all-time high for cryptocurrency.", "source": "Test"},
        ])
        assert len(stories) == 1
        assert stories[0].headline == "Bitcoin hits $100K"
        assert stories[0].score == 0.0  # unscored

    def test_producer_scoring(self):
        from editorial_pipeline import Producer, EditorialStory
        producer = Producer()
        story = EditorialStory(
            story_id="test1", headline="AI Breakthrough", anchor_copy="Big news.",
            source="Test", freshness_hours=0.2,
        )
        scored = producer.score(story)
        assert scored.score > 50

    def test_top_story_filter(self):
        from editorial_pipeline import Producer, EditorialStory
        producer = Producer()
        stories = []
        for i in range(5):
            s = EditorialStory(
                story_id=f"test{i}", headline=f"Tech Story {i}",
                anchor_copy="text.", source="T",
                category="technology", freshness_hours=0.1,
                is_breaking=(i == 0),
            )
            stories.append(s)
        producer.process(stories)
        top = producer.get_top_story()
        assert top is not None
        assert top.score > 0


class TestDirectorAgent:
    def test_initial_state(self):
        from director_agent import DirectorAgent
        director = DirectorAgent()
        assert director.current_scene == "news_desk"
        assert director.seconds_since_cut < 1.0

    def test_scene_selection(self):
        from director_agent import DirectorAgent
        director = DirectorAgent()
        scene = director.select_scene("market_desk", "prime")
        assert scene == "market_board"

    def test_breaking_protocol(self):
        from director_agent import DirectorAgent
        director = DirectorAgent()
        director._breaking_news_active = True
        cmds = director._execute_breaking_protocol()
        assert cmds is not None
        assert cmds.command == "SCENE_CUT"
        assert cmds.to_scene == "breaking_news"


class TestAudienceAwareness:
    def test_viewer_tracking(self):
        from audience_awareness import AudienceManager
        am = AudienceManager()
        profile = am.record_viewer({"id": "abc", "name": "Bob"})
        assert profile is not None
        assert profile.name == "Bob"
        assert am.viewer_count > 0

    def test_tip_recording(self):
        from audience_awareness import AudienceManager
        am = AudienceManager()
        tip = am.record_tip({"viewer_id": "abc", "viewer_name": "Bob", "amount": 5.0})
        assert tip is not None
        assert tip.amount == 5.0

    def test_vip_detection(self):
        from audience_awareness import AudienceManager
        am = AudienceManager()
        am.record_viewer({"id": "vip1", "name": "Alice"})
        for _ in range(5):
            am.record_tip({"viewer_id": "vip1", "viewer_name": "Alice", "amount": 5.0})
        assert am._viewers["vip1"].is_vip


class TestBroadcastMemory:
    def test_three_layers(self):
        from broadcast_memory import BroadcastMemory
        mem = BroadcastMemory()
        assert mem.rolling is not None
        assert mem.session is not None
        assert mem.persistent is not None

    def test_rolling_turns(self):
        from broadcast_memory import BroadcastMemory
        mem = BroadcastMemory()
        mem.rolling.record_turn("Zara", "Test commentary", "headlines")
        assert len(mem.rolling.anchor_transcript) == 1

    def test_llm_context(self):
        from broadcast_memory import BroadcastMemory
        mem = BroadcastMemory()
        ctx = mem.build_llm_context()
        assert isinstance(ctx, str)
        assert len(ctx) > 0


class TestSpecialTriggers:
    def test_breaking_detection(self):
        from special_triggers import SpecialTriggerManager, SpecialTrigger
        manager = SpecialTriggerManager()
        news = [{"title": "BREAKING: Major event happening now", "source": "Test"}]
        event = manager.check_news_for_breaking(news)
        assert event is not None
        assert event.trigger == SpecialTrigger.BREAKING_NEWS

    def test_night_mode(self):
        from special_triggers import SpecialTriggerManager
        from datetime import datetime, timezone
        manager = SpecialTriggerManager()
        hour = datetime.now(timezone.utc).hour
        event = manager.check_night_mode()
        if hour >= 22 or hour < 5:
            assert event is not None
        else:
            assert not manager.is_night_mode

    def test_crypto_surge(self):
        from special_triggers import SpecialTriggerManager
        manager = SpecialTriggerManager()
        prices = {"bitcoin": {"usd_24h_change": 12.5}}
        event = manager.check_crypto_for_surge(prices)
        assert event is not None
        assert event.trigger.value == "market_surge"


class TestGracefulDegradation:
    def test_news_stale_after_threshold(self):
        from graceful_degradation import GracefulDegradation
        gd = GracefulDegradation()
        gd.record_success("news")
        assert not gd.news_stale

    def test_fallback_topic(self):
        from graceful_degradation import GracefulDegradation
        gd = GracefulDegradation()
        topic = gd.get_fallback_topic()
        assert isinstance(topic, str)
        assert len(topic) > 0

    def test_tts_disabled(self):
        from graceful_degradation import GracefulDegradation
        gd = GracefulDegradation()
        for _ in range(5):
            gd.record_failure("tts")
        assert gd._status.tts_disabled

    def test_reset(self):
        from graceful_degradation import GracefulDegradation
        gd = GracefulDegradation()
        gd.record_failure("tts")
        gd.reset()
        assert not gd._status.tts_disabled


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
