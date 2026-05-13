"""5-dimensional message scoring engine powered by Claude with LLM safety features."""

import json
import logging
import asyncio
import time


from ..config.settings import settings
from .llm_provider import get_provider
from ..models.message import Message, ScoringContext, ScoringResult
from ..utils.prompt_sanitizer import sanitize_prompt, is_prompt_safe

logger = logging.getLogger(__name__)

# Scoring configuration
SCORING_TIMEOUT = 10  # seconds
SCORING_RETRY_ATTEMPTS = 3
SCORING_RETRY_DELAY = 1.0  # seconds

# Fallback score when LLM fails
FALLBACK_SCORE = 50


class ScoringEngine:
    """Evaluates candidate messages across 5 quality dimensions."""

    def __init__(self):
        """Initialize provider client via provider registry."""
        try:
            self.client = get_provider()
        except Exception as e:
            # If provider cannot be loaded, log and keep client as None -
            # the scoring functions will fallback gracefully.
            logger.error("LLM provider initialization failed: %s", e)
            self.client = None

        self.scoring_model = settings.SCORING_MODEL

    async def score_message(
        self,
        message: Message,
        context: ScoringContext,
    ) -> ScoringResult:
        """
        Score a single candidate message with safety features.

        Evaluation dimensions:
        - Relevance (35%): Directly addresses the room objective
        - Novelty (25%): Introduces new or useful information
        - Coherence (20%): Connects logically to prior discussion
        - Actionability (15%): Moves toward concrete outputs
        - Engagement (5%): Maintains viewer interest

        Safety Features:
        - Prompt injection prevention (sanitization)
        - Timeout protection (10s max)
        - Retry with exponential backoff
        - Fallback scoring (graceful degradation)
        - Request metrics logging

        Args:
            message: Candidate message to evaluate
            context: Room context and discussion history

        Returns:
            ScoringResult with breakdown and reasoning
        """
        start_time = time.time()
        
        # Layer 1: Sanitize user input to prevent prompt injection
        message_sanitization = sanitize_prompt(message.text)
        if not message_sanitization.is_safe:
            logger.warning(
                "Message contains safety violations",
                extra={
                    "message_id": message.id,
                    "violations": message_sanitization.violations,
                    "original_length": len(message.text),
                },
            )
        
        # Build prompt with sanitized message
        prompt = self._build_scoring_prompt(message, context)
        prompt_sanitization = sanitize_prompt(prompt)
        
        if not prompt_sanitization.is_safe:
            logger.warning(
                "Scoring prompt contains safety violations",
                extra={"violations": prompt_sanitization.violations},
            )

        # Layer 2: Score with timeout and retry logic
        score_data = await self._score_with_retry(prompt, message.id, context.room_id)
        
        duration_ms = (time.time() - start_time) * 1000

        # Log metrics
        logger.info(
            "Message scored",
            extra={
                "message_id": message.id,
                "agent_id": message.agent_id,
                "overall_score": score_data["overall_score"],
                "room_id": context.room_id,
                "duration_ms": int(duration_ms),
                "fallback_triggered": score_data.get("fallback_triggered", False),
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

    async def score_batch(
        self,
        messages: list[Message],
        context: ScoringContext,
    ) -> list[ScoringResult]:
        """
        Score multiple messages in parallel with concurrency control.
        Uses a semaphore to prevent overloading the LLM API.

        Args:
            messages: List of candidates
            context: Room context

        Returns:
            List of scoring results in same order as input
        """
        # Limit to 5 candidates per turn
        candidates = messages[: settings.MAX_CANDIDATES_PER_TURN]
        
        if not candidates:
            return []

        logger.info(
            "Starting parallel batch scoring",
            extra={
                "candidate_count": len(candidates),
                "room_id": context.room_id,
            },
        )

        # Control concurrency to respect rate limits (e.g., max 5 at once)
        semaphore = asyncio.Semaphore(5)

        async def _score_with_semaphore(msg):
            async with semaphore:
                return await self.score_message(msg, context)

        # Execute all scoring tasks in parallel
        tasks = [_score_with_semaphore(msg) for msg in candidates]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Process results and handle potential exceptions
        final_results = []
        for i, res in enumerate(results):
            if isinstance(res, Exception):
                logger.error(
                    "Error scoring candidate in batch",
                    extra={
                        "message_id": candidates[i].id,
                        "error": str(res),
                    },
                )
                # Fallback for failed individual scoring
                final_results.append(self._create_fallback_result(candidates[i]))
            else:
                final_results.append(res)

        return final_results

    def _create_fallback_result(self, message: Message) -> ScoringResult:
        """Create a default fallback result for a failed scoring attempt."""
        return ScoringResult(
            message_id=message.id,
            agent_id=message.agent_id,
            overall_score=FALLBACK_SCORE,
            relevance_score=FALLBACK_SCORE,
            novelty_score=FALLBACK_SCORE,
            coherence_score=FALLBACK_SCORE,
            actionability_score=FALLBACK_SCORE,
            engagement_score=FALLBACK_SCORE,
            reasoning="Fallback score due to batch error",
            strengths=[],
            weaknesses=[],
        )

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

    async def _score_with_retry(
        self, prompt: str, message_id: str, room_id: str
    ) -> dict:
        """
        Score message with timeout, retry, and fallback logic.

        Strategy:
        1. Try to get LLM score with 10s timeout
        2. Retry up to 3 times with exponential backoff
        3. Return fallback score if all attempts fail
        4. Log all metrics for monitoring

        Args:
            prompt: Scoring prompt
            message_id: Message ID for logging
            room_id: Room ID for logging

        Returns:
            Score dictionary with overall_score, dimension scores, reasoning
        """
        last_error = None

        for attempt in range(SCORING_RETRY_ATTEMPTS):
            try:
                # Attempt scoring with timeout
                if self.client is None:
                    raise RuntimeError("LLM provider not configured")

                # Use provider's `messages_create` to allow multiple SDKs.
                # H7: Always include a system prompt to enforce JSON-only output;
                # without it some models return freeform text that fails JSON parsing.
                response = await asyncio.wait_for(
                    asyncio.to_thread(
                        self.client.messages_create,
                        model=self.scoring_model,
                        max_tokens=1024,
                        system=(
                            "You are a precise message scoring engine. "
                            "You MUST respond ONLY with valid JSON matching the specified schema. "
                            "Do not include any preamble, explanation, or markdown — just the JSON object."
                        ),
                        messages=[{"role": "user", "content": prompt}],
                    ),
                    timeout=SCORING_TIMEOUT,
                )

                # Parse response
                score_data = self._parse_scoring_response(response.content[0].text)
                return score_data

            except asyncio.TimeoutError:
                last_error = "timeout"
                logger.warning(
                    "Scoring timeout",
                    extra={
                        "message_id": message_id,
                        "room_id": room_id,
                        "attempt": attempt + 1,
                        "timeout_seconds": SCORING_TIMEOUT,
                    },
                )

                # Exponential backoff before retry
                if attempt < SCORING_RETRY_ATTEMPTS - 1:
                    await asyncio.sleep(SCORING_RETRY_DELAY * (2 ** attempt))

            except json.JSONDecodeError as e:
                last_error = "json_parse_error"
                logger.warning(
                    "Scoring response parse error",
                    extra={
                        "message_id": message_id,
                        "error": str(e),
                        "attempt": attempt + 1,
                    },
                )

                if attempt < SCORING_RETRY_ATTEMPTS - 1:
                    await asyncio.sleep(SCORING_RETRY_DELAY * (2 ** attempt))

            except Exception as e:
                last_error = str(e)
                logger.error(
                    "Scoring error",
                    extra={
                        "message_id": message_id,
                        "room_id": room_id,
                        "error": str(e),
                        "attempt": attempt + 1,
                    },
                )

                if attempt < SCORING_RETRY_ATTEMPTS - 1:
                    await asyncio.sleep(SCORING_RETRY_DELAY * (2 ** attempt))

        # All retries exhausted - return fallback score
        logger.error(
            "Scoring failed after all retries - using fallback",
            extra={
                "message_id": message_id,
                "room_id": room_id,
                "last_error": last_error,
                "fallback_score": FALLBACK_SCORE,
            },
        )

        return {
            "relevance_score": FALLBACK_SCORE,
            "novelty_score": FALLBACK_SCORE,
            "coherence_score": FALLBACK_SCORE,
            "actionability_score": FALLBACK_SCORE,
            "engagement_score": FALLBACK_SCORE,
            "overall_score": FALLBACK_SCORE,
            "reasoning": "Fallback score due to LLM unavailability",
            "strengths": [],
            "weaknesses": [],
            "fallback_triggered": True,
        }

    def _parse_scoring_response(self, response_text: str) -> dict:
        """
        Parse Claude's JSON scoring response.

        Handles:
        - Markdown code blocks (```json ... ```)
        - Invalid JSON (raises JSONDecodeError for retry)
        - Missing fields (use defaults)

        Args:
            response_text: Raw response from Claude

        Returns:
            Parsed score dictionary

        Raises:
            JSONDecodeError: If JSON parsing fails (triggers retry)
        """
        # Extract JSON from response (handle markdown code blocks)
        json_str = response_text.strip()
        if json_str.startswith("```"):
            json_str = json_str.split("```")[1]
            if json_str.startswith("json"):
                json_str = json_str[4:]
            json_str = json_str.strip()

        data = json.loads(json_str)  # Raises JSONDecodeError on invalid JSON

        # M5: Use .get() with safe defaults for all score fields so that a
        # partially-formed LLM response does not raise an unhandled KeyError.
        # Missing numeric fields fall back to FALLBACK_SCORE; missing text fields
        # fall back to sensible empty values. Log whenever fields are absent so
        # the LLM prompt or provider can be investigated.
        _missing: list[str] = []

        def _score(key: str) -> float:
            val = data.get(key)
            if val is None:
                _missing.append(key)
                return float(FALLBACK_SCORE)
            try:
                return max(0.0, min(100.0, float(val)))
            except (TypeError, ValueError):
                _missing.append(key)
                return float(FALLBACK_SCORE)

        relevance = _score("relevance_score")
        novelty = _score("novelty_score")
        coherence = _score("coherence_score")
        actionability = _score("actionability_score")
        engagement = _score("engagement_score")

        if _missing:
            logger.warning(
                "Scoring response missing expected fields — fallback values used",
                extra={"missing_fields": _missing},
            )

        # Compute weighted overall score
        overall = (
            relevance * settings.SCORING_WEIGHT_RELEVANCE
            + novelty * settings.SCORING_WEIGHT_NOVELTY
            + coherence * settings.SCORING_WEIGHT_COHERENCE
            + actionability * settings.SCORING_WEIGHT_ACTIONABILITY
            + engagement * settings.SCORING_WEIGHT_ENGAGEMENT
        )

        return {
            "relevance_score": relevance,
            "novelty_score": novelty,
            "coherence_score": coherence,
            "actionability_score": actionability,
            "engagement_score": engagement,
            "overall_score": overall,
            "reasoning": data.get("reasoning", "No reasoning provided"),
            "strengths": data.get("strengths", []),
            "weaknesses": data.get("weaknesses", []),
        }
