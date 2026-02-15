"""5-dimensional message scoring engine powered by Claude."""

import json
import logging
from typing import Optional

import httpx
from anthropic import Anthropic

from ..config.settings import settings
from ..models.message import Message, ScoringContext, ScoringResult

logger = logging.getLogger(__name__)


class ScoringEngine:
    """Evaluates candidate messages across 5 quality dimensions."""

    def __init__(self):
        """Initialize Anthropic client."""
        self.client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        self.scoring_model = settings.SCORING_MODEL

    async def score_message(
        self,
        message: Message,
        context: ScoringContext,
    ) -> ScoringResult:
        """
        Score a single candidate message.

        Evaluation dimensions:
        - Relevance (35%): Directly addresses the room objective
        - Novelty (25%): Introduces new or useful information
        - Coherence (20%): Connects logically to prior discussion
        - Actionability (15%): Moves toward concrete outputs
        - Engagement (5%): Maintains viewer interest

        Args:
            message: Candidate message to evaluate
            context: Room context and discussion history

        Returns:
            ScoringResult with breakdown and reasoning
        """
        prompt = self._build_scoring_prompt(message, context)

        try:
            response = self.client.messages.create(
                model=self.scoring_model,
                max_tokens=1024,
                messages=[{"role": "user", "content": prompt}],
            )

            # Parse LLM response
            score_data = self._parse_scoring_response(response.content[0].text)

            logger.info(
                "Message scored",
                extra={
                    "message_id": message.id,
                    "agent_id": message.agent_id,
                    "overall_score": score_data["overall_score"],
                    "room_id": context.room_id,
                },
            )

            return ScoringResult(
                message_id=message.id,
                agent_id=message.agent_id,
                overall_score=score_data["overall_score"],
                relevance_score=score_data["relevance_score"],
                novelty_score=score_data["novelty_score"],
                coherence_score=score_data["coherence_score"],
                actionability_score=score_data["actionability_score"],
                engagement_score=score_data["engagement_score"],
                reasoning=score_data["reasoning"],
                strengths=score_data.get("strengths", []),
                weaknesses=score_data.get("weaknesses", []),
            )

        except Exception as e:
            logger.error(
                "Scoring failed",
                extra={
                    "message_id": message.id,
                    "error": str(e),
                    "room_id": context.room_id,
                },
            )
            raise

    async def score_batch(
        self,
        messages: list[Message],
        context: ScoringContext,
    ) -> list[ScoringResult]:
        """
        Score multiple messages in parallel (3-5 at a time for efficiency).

        Args:
            messages: List of candidates
            context: Room context

        Returns:
            List of scoring results in same order as input
        """
        # TODO: Implement batch processing with concurrent API calls
        results = []
        for message in messages[: settings.MAX_CANDIDATES_PER_TURN]:
            result = await self.score_message(message, context)
            results.append(result)
        return results

    def _build_scoring_prompt(self, message: Message, context: ScoringContext) -> str:
        """Build the scoring prompt for Claude."""
        transcript_str = "\n".join(
            [f"- {t['agent_id']}: {t['text']}" for t in context.transcript_history[-5:]]  # Last 5
        )

        prompt = f"""You are an evaluator for AI agent conversations. Score this message on 5 dimensions.

ROOM CONTEXT:
- Type: {context.room_type}
- Objective: {context.room_objective}

TRANSCRIPT (last 5 messages):
{transcript_str or "(empty)"}

CANDIDATE MESSAGE:
Agent: {message.agent_id}
Text: {message.text}

SCORING TASK:
Evaluate this message on these dimensions (0-100 each):

1. **Relevance (35% weight)**: Does it directly address the room objective?
2. **Novelty (25% weight)**: Does it introduce new or useful information?
3. **Coherence (20% weight)**: Does it connect logically to the discussion?
4. **Actionability (15% weight)**: Does it move toward concrete outputs?
5. **Engagement (5% weight)**: Does it maintain viewer interest?

RESPONSE FORMAT (JSON):
{{
  "relevance_score": <0-100>,
  "novelty_score": <0-100>,
  "coherence_score": <0-100>,
  "actionability_score": <0-100>,
  "engagement_score": <0-100>,
  "overall_score": <0-100>,
  "reasoning": "<brief explanation>",
  "strengths": ["<strength1>", "<strength2>"],
  "weaknesses": ["<weakness1>"]
}}

Respond ONLY with valid JSON."""

        return prompt

    def _parse_scoring_response(self, response_text: str) -> dict:
        """Parse Claude's JSON scoring response."""
        # Extract JSON from response (handle markdown code blocks)
        json_str = response_text.strip()
        if json_str.startswith("```"):
            json_str = json_str.split("```")[1]
            if json_str.startswith("json"):
                json_str = json_str[4:]
            json_str = json_str.strip()

        data = json.loads(json_str)

        # Compute weighted overall score
        overall = (
            data["relevance_score"] * settings.SCORING_WEIGHT_RELEVANCE
            + data["novelty_score"] * settings.SCORING_WEIGHT_NOVELTY
            + data["coherence_score"] * settings.SCORING_WEIGHT_COHERENCE
            + data["actionability_score"] * settings.SCORING_WEIGHT_ACTIONABILITY
            + data["engagement_score"] * settings.SCORING_WEIGHT_ENGAGEMENT
        )

        return {
            "relevance_score": data["relevance_score"],
            "novelty_score": data["novelty_score"],
            "coherence_score": data["coherence_score"],
            "actionability_score": data["actionability_score"],
            "engagement_score": data["engagement_score"],
            "overall_score": overall,
            "reasoning": data["reasoning"],
            "strengths": data.get("strengths", []),
            "weaknesses": data.get("weaknesses", []),
        }
