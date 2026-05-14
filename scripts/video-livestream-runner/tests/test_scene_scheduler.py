"""Tests for scene_scheduler.py"""

import pytest

from scene_scheduler import SceneScheduler, SceneRotation


class TestSceneScheduler:
    def test_default_state(self):
        s = SceneScheduler()
        assert s.turn_count == 0
        assert s.rotation_count == 0
        assert s.current_scene == "live_news"

    def test_record_turn(self):
        s = SceneScheduler()
        s.record_turn()
        assert s.turn_count == 1

    def test_should_not_rotate_on_turn_zero(self):
        s = SceneScheduler()
        assert s.should_rotate() is False

    def test_should_rotate_at_interval(self):
        s = SceneScheduler(rotation_interval=3)
        for _ in range(3):
            s.record_turn()
        assert s.should_rotate() is True

    def test_not_rotate_between_intervals(self):
        s = SceneScheduler(rotation_interval=3)
        s.record_turn()
        s.record_turn()
        assert s.should_rotate() is False

    def test_next_scene_returns_rotation(self):
        s = SceneScheduler(rotation_interval=3)
        for _ in range(3):
            s.record_turn()
        rotation = s.next_scene()
        assert isinstance(rotation, SceneRotation)
        assert rotation.rotation_number == 1
        assert rotation.scene_name in ("live_news", "data_card", "break_card")

    def test_next_scene_break_turn(self):
        s = SceneScheduler(rotation_interval=3, break_interval=6)
        for _ in range(6):
            s.record_turn()
        rotation = s.next_scene()
        assert rotation.scene_name == "break_card"
        assert rotation.rotation_number == 1

    def test_rotation_count_increments(self):
        s = SceneScheduler(rotation_interval=2, break_interval=10)
        for _ in range(2):
            s.record_turn()
        s.next_scene()
        assert s.rotation_count == 1
        for _ in range(2):
            s.record_turn()
        s.next_scene()
        assert s.rotation_count == 2

    def test_is_break_turn(self):
        s = SceneScheduler(rotation_interval=3, break_interval=6)
        for _ in range(6):
            s.record_turn()
        assert s.is_break_turn() is True

    def test_is_break_turn_false(self):
        s = SceneScheduler(rotation_interval=3, break_interval=6)
        for _ in range(3):
            s.record_turn()
        assert s.is_break_turn() is False

    def test_scene_alternation(self):
        s = SceneScheduler(rotation_interval=2, break_interval=10)
        scenes = []
        for i in range(4):
            for _ in range(2):
                s.record_turn()
            scenes.append(s.next_scene().scene_name)
        assert scenes[0] == "live_news"
        assert scenes[1] == "data_card"
        assert scenes[2] == "live_news"
        assert scenes[3] == "data_card"
