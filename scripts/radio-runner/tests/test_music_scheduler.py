#!/usr/bin/env python3
"""
test_music_scheduler.py
Unit tests for the MusicScheduler module.
"""

import pytest

from music_scheduler import MusicScheduler


class TestMusicScheduler:
    """Tests for MusicScheduler turn-counting and break injection."""

    def test_should_not_inject_at_zero_turns(self) -> None:
        scheduler = MusicScheduler(break_interval=3)
        assert not scheduler.should_inject()

    def test_should_inject_at_interval(self) -> None:
        scheduler = MusicScheduler(break_interval=3)
        for _ in range(3):
            scheduler.record_turn()
        assert scheduler.should_inject()

    def test_should_not_inject_between_intervals(self) -> None:
        scheduler = MusicScheduler(break_interval=4)
        scheduler.record_turn()  # 1
        assert not scheduler.should_inject()
        scheduler.record_turn()  # 2
        assert not scheduler.should_inject()
        scheduler.record_turn()  # 3
        assert not scheduler.should_inject()
        scheduler.record_turn()  # 4
        assert scheduler.should_inject()

    def test_should_not_inject_during_break(self) -> None:
        scheduler = MusicScheduler(break_interval=2)
        scheduler.record_turn()
        scheduler.record_turn()
        assert scheduler.should_inject()

        scheduler.start_break()
        assert not scheduler.should_inject()  # in break

    def test_start_and_end_break(self) -> None:
        scheduler = MusicScheduler(break_interval=2, break_duration=60)
        scheduler.record_turn()
        scheduler.record_turn()

        music_break = scheduler.start_break()
        assert music_break.break_number == 1
        assert music_break.duration_seconds == 60
        assert scheduler.is_in_break

        scheduler.end_break()
        assert not scheduler.is_in_break

    def test_break_count_increments(self) -> None:
        scheduler = MusicScheduler(break_interval=1)

        scheduler.record_turn()
        scheduler.start_break()
        scheduler.end_break()
        assert scheduler.break_count == 1

        scheduler.record_turn()
        scheduler.start_break()
        scheduler.end_break()
        assert scheduler.break_count == 2

    def test_build_event_payload(self) -> None:
        scheduler = MusicScheduler(break_interval=2, break_duration=90)
        scheduler.record_turn()
        scheduler.record_turn()

        music_break = scheduler.start_break()
        payload = scheduler.build_event_payload(music_break)

        assert payload["breakNumber"] == 1
        assert payload["durationSeconds"] == 90
        assert payload["turnCount"] == 2
        assert "streamUrl" in payload

    def test_turn_count_property(self) -> None:
        scheduler = MusicScheduler(break_interval=5)
        assert scheduler.turn_count == 0
        scheduler.record_turn()
        scheduler.record_turn()
        assert scheduler.turn_count == 2

    def test_multiple_intervals(self) -> None:
        """should_inject() should fire at every multiple of break_interval."""
        scheduler = MusicScheduler(break_interval=3)
        results: list[bool] = []
        for i in range(9):
            scheduler.record_turn()
            results.append(scheduler.should_inject())
            if scheduler.should_inject():
                scheduler.start_break()
                scheduler.end_break()

        # Should inject at turns 3, 6, 9
        assert results == [False, False, True, False, False, True, False, False, True]
