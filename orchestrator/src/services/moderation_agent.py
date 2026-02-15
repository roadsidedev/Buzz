"""Content moderation agent powered by Claude."""

import logging
from enum import Enum

from anthropic import Anthropic

from ..config.settings import settings
from ..models.message import Message, ScoringResult

logger = logging.getLogger(__name__)


class ViolationType(str, Enum):
    """Content policy violation types."""

    HATE_SPEECH = "hate_speech"
    HARASSMENT = "harassment"
    MISINFORMATION = "misinformation"
    VIOLENCE = "violence"
    SPAM = "spam"
    ADULT_CONTENT = "adult_content"


class ModerationAgent:
    """Real-time content moderation for candidate messages."""

    def __init__(self):
        """Initialize moderation agent."""
        self.client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        self.moderation_model = settings.MODERATION_MODEL

    async def scan_message(self, message: Message) -> tuple[bool, Optional[ViolationType], str]:
        """
        Scan message for policy violations.

        Args:
            message: Message to evaluate

        Returns:
            Tuple of (is_safe, violation_type, explanation)
        """
        prompt = f"""You are a content safety moderator. Evaluate this message for violations.

MESSAGE:
{message.text}

POLICIES:
- Hate speech or slurs
- Harassment or threats
- Misinformation or false claims
- Violence or gore
- Spam or repetitive content
- Adult/explicit content

RESPONSE (JSON):
{{
  "is_safe": true/false,
  "violation_type": null or one of: "hate_speech", "harassment", "misinformation", "violence", "spam", "adult_content",
  "confidence": 0.0-1.0,
  "explanation": "<brief reason>"
}}

Respond ONLY with valid JSON."""

        try:
            response = self.client.messages.create(
                model=self.moderation_model,
                max_tokens=256,
                messages=[{"role": "user", "content": prompt}],
            )

            import json

            result = json.loads(response.content[0].text.strip())

            if not result["is_safe"]:
                logger.warning(
                    "Content flagged for moderation",
                    extra={
                        "message_id": message.id,
                        "violation_type": result["violation_type"],
                        "confidence": result["confidence"],
                    },
                )
                return False, result.get("violation_type"), result["explanation"]

            return True, None, ""

        except Exception as e:
            logger.error("Moderation check failed", extra={"message_id": message.id, "error": str(e)})
            # On error, default to safe (avoid over-filtering)
            return True, None, ""

    async def scan_batch(self, messages: list[Message]) -> dict[str, tuple[bool, Optional[str], str]]:
        """
        Scan multiple messages (returns flagged messages).

        Args:
            messages: List of messages to evaluate

        Returns:
            Dict mapping message_id -> (is_safe, violation_type, explanation)
        """
        results = {}
        for message in messages:
            is_safe, violation_type, explanation = await self.scan_message(message)
            if not is_safe:  # Only store flagged messages
                results[message.id] = (is_safe, violation_type, explanation)
        return results

    async def update_scoring_for_violations(
        self, score: ScoringResult, message: Message
    ) -> ScoringResult:
        """
        Adjust score if message violated policies.

        Args:
            score: Original scoring result
            message: Message being evaluated

        Returns:
            Updated score with moderation flag
        """
        is_safe, violation_type, explanation = await self.scan_message(message)

        if not is_safe:
            score.is_moderated = True
            score.moderation_reason = f"{violation_type}: {explanation}"
            # Reject automatically (score becomes 0)
            score.overall_score = 0.0

        return score
