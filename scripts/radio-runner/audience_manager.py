#!/usr/bin/env python3
"""
audience_manager.py
Participant tracking, tip ceremony, greeting logic, and audience interaction.

Inspired by buzz-radio's audience awareness architecture.

Architecture placement: scripts/radio-runner/
Used by: radio_runner.py
"""

import logging
import time
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)

# Max 1 greeting per 180 seconds to prevent spam
GREETING_COOLDOWN_SECONDS = 180


@dataclass
class ListenerProfile:
    """Persistent profile for a known listener."""
    agent_id: str
    name: str
    first_seen: float = 0.0
    visit_count: int = 1
    total_tips: float = 0.0
    questions_asked: int = 0
    greeted: bool = False
    last_seen: float = 0.0
    is_vip: bool = False


@dataclass
class TipEvent:
    """A tip received from a listener."""
    name: str
    amount: float
    timestamp: float = field(default_factory=time.time)


@dataclass
class JoinEvent:
    """A listener joining the room."""
    agent_id: str
    name: str
    timestamp: float = field(default_factory=time.time)
    is_returning: bool = False
    is_vip: bool = False


class AudienceManager:
    """
    Tracks listeners, manages greeting cadence, and provides
    tip ceremony context for hosts.
    """

    def __init__(self) -> None:
        self._profiles: dict[str, ListenerProfile] = {}
        self._known_ids: set[str] = set()
        self._greeting_timestamps: list[float] = []
        self._pending_tips: list[TipEvent] = []
        self._pending_joins: list[JoinEvent] = []
        self._pending_questions: list[dict] = []

    @property
    def participant_count(self) -> int:
        return len(self._known_ids)

    def process_participants(self, participants: list[dict]) -> list[JoinEvent]:
        """
        Process a participant list from the API. Returns new join events.
        """
        current_ids = set()
        new_joins = []

        for p in participants:
            pid = p.get("id", p.get("agentId", ""))
            name = p.get("name", p.get("username", "Listener"))
            current_ids.add(pid)

            if pid not in self._known_ids:
                profile = self._profiles.get(pid)
                is_returning = profile is not None
                is_vip = profile.is_vip if profile else False

                if not profile:
                    self._profiles[pid] = ListenerProfile(
                        agent_id=pid, name=name, first_seen=time.time(), last_seen=time.time()
                    )
                else:
                    profile.visit_count += 1
                    profile.last_seen = time.time()

                join_event = JoinEvent(
                    agent_id=pid, name=name,
                    is_returning=is_returning, is_vip=is_vip,
                )
                new_joins.append(join_event)
                self._pending_joins.append(join_event)

        # Remove stale IDs
        self._known_ids = current_ids
        return new_joins

    def record_tip(self, name: str, amount: float) -> None:
        """Record a tip event for ceremony processing."""
        tip = TipEvent(name=name, amount=amount)
        self._pending_tips.append(tip)
        logger.info("Tip recorded: %s $%.2f", name, amount)

    def can_greet(self) -> bool:
        """Check if we're allowed to greet (rate limited)."""
        now = time.time()
        # Remove old timestamps
        self._greeting_timestamps = [t for t in self._greeting_timestamps if now - t < GREETING_COOLDOWN_SECONDS]
        if len(self._greeting_timestamps) >= 1:
            return False
        self._greeting_timestamps.append(now)
        return True

    def pop_pending_joins(self) -> list[JoinEvent]:
        """Get and clear pending join events."""
        joins = list(self._pending_joins)
        self._pending_joins = []
        return joins

    def pop_pending_tips(self) -> list[TipEvent]:
        """Get and clear pending tip events."""
        tips = list(self._pending_tips)
        self._pending_tips = []
        return tips

    def get_greeting_for(self, join_event: JoinEvent) -> Optional[str]:
        """Get an appropriate greeting for a join event."""
        if not self.can_greet():
            return None

        if join_event.is_vip:
            return f"Big {join_event.name} energy in the room right now."
        elif join_event.is_returning:
            return f"Oh — {join_event.name} is back. You never really leave do you."
        else:
            return f"{join_event.name} just joined. Welcome to the show."

    def get_tip_ceremony(self, tip: TipEvent) -> str:
        """Generate appropriate tip ceremony language based on amount."""
        if tip.amount >= 20:
            return (
                f"LISTEN. {tip.name} just dropped ${tip.amount:.0f} on The Wire. "
                f"That is FAITH in this show. We see you."
            )
        elif tip.amount >= 5:
            return (
                f"{tip.name} with ${tip.amount:.0f} — that's real support right there. "
                f"Appreciate you."
            )
        else:
            return f"{tip.name}, thank you for the ${tip.amount:.0f}. Every bit counts."

    def get_known_listeners_summary(self) -> str:
        """Generate a summary of known listeners for context prompts."""
        if not self._profiles:
            return "No known listeners in the room."
        vips = [p.name for p in self._profiles.values() if p.is_vip]
        regulars = [p.name for p in self._profiles.values() if p.visit_count > 3 and not p.is_vip]
        parts = []
        if vips:
            parts.append(f"VIPs: {', '.join(vips)}")
        if regulars:
            parts.append(f"Regulars: {', '.join(regulars)}")
        parts.append(f"Total participants: {self.participant_count}")
        return " | ".join(parts)
