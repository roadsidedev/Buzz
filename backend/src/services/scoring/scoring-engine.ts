/**
 * Scoring Engine
 *
 * Port of orchestrator/src/services/scoring_engine.py
 *
 * Evaluates candidate messages across 5 quality dimensions using an LLM.
 * Produces a weighted overall score used by TurnSelector to pick the winner.
 *
 * Safety features:
 *  - Timeout + retry with exponential backoff
 *  - Fallback score (50) when LLM unavailable
 *  - Prompt injection mitigation (angle-bracket stripping)
 *  - JSON code-block unwrapping
 */

import { getLLMClient } from "./llm-provider.js";
import type { ScoringMessage, ScoringContext, ScoringResult, ScoringWeights } from "./types.js";
import { logger } from "../../utils/logger.js";

// ─── Config ───────────────────────────────────────────────────────────────────
// Model names are the only things that should vary between deployments.
// All tuning constants are encoded here — not in environment variables.

const SCORING_MODEL = process.env.SCORING_MODEL ?? "claude-3-5-sonnet-20241022";
const SCORING_TIMEOUT_MS = 10_000;   // 10 seconds per LLM call
const SCORING_RETRY_ATTEMPTS = 3;
const SCORING_RETRY_DELAY_MS = 1_000;
const FALLBACK_SCORE = 50;

// Default weights used when no room-type-specific weights are provided (e.g. in fallback paths).
const DEFAULT_WEIGHTS: ScoringWeights = {
  relevance:     0.35,
  novelty:       0.25,
  coherence:     0.20,
  actionability: 0.15,
  engagement:    0.05,
};

// ─── Prompt sanitizer (minimal injection prevention) ─────────────────────────

function sanitize(text: string): string {
  // Strip angle-bracket instruction-style injections: <anything>
  return text.replace(/<[^>]{0,200}>/g, "").trim();
}

// ─── ScoringEngine ────────────────────────────────────────────────────────────

export class ScoringEngine {
  /**
   * Score a single message with timeout, retry, and fallback.
   */
  async scoreMessage(
    message: ScoringMessage,
    context: ScoringContext,
  ): Promise<ScoringResult> {
    const start = Date.now();

    const weights = context.weights ?? DEFAULT_WEIGHTS;
    const prompt = this._buildScoringPrompt(message, context, weights);
    const scoreData = await this._scoreWithRetry(prompt, message.id, context.roomId, weights);

    logger.info("Message scored", {
      messageId: message.id,
      agentId: message.agentId,
      overallScore: scoreData.overall_score,
      roomId: context.roomId,
      durationMs: Date.now() - start,
      fallbackTriggered: scoreData.fallback_triggered ?? false,
    });

    return {
      messageId: message.id,
      agentId: message.agentId,
      overallScore: scoreData.overall_score,
      relevanceScore: scoreData.relevance_score,
      noveltyScore: scoreData.novelty_score,
      coherenceScore: scoreData.coherence_score,
      actionabilityScore: scoreData.actionability_score,
      engagementScore: scoreData.engagement_score,
      reasoning: scoreData.reasoning,
      strengths: scoreData.strengths ?? [],
      weaknesses: scoreData.weaknesses ?? [],
      isModerated: false,
      fallbackTriggered: scoreData.fallback_triggered ?? false,
    };
  }

  /**
   * Score multiple messages in parallel (max 5 concurrent, mirrors Python semaphore).
   */
  async scoreBatch(
    messages: ScoringMessage[],
    context: ScoringContext,
  ): Promise<ScoringResult[]> {
    const candidates = messages.slice(0, 10);

    if (candidates.length === 0) return [];

    logger.info("Starting parallel batch scoring", {
      candidateCount: candidates.length,
      roomId: context.roomId,
    });

    // Simple concurrency limiter (max 5 parallel LLM calls)
    const CONCURRENCY = 5;
    const results: ScoringResult[] = new Array(candidates.length);
    let index = 0;

    const worker = async () => {
      while (index < candidates.length) {
        const i = index++;
        try {
          results[i] = await this.scoreMessage(candidates[i], context);
        } catch (err) {
          logger.error("Error scoring candidate in batch", {
            messageId: candidates[i].id,
            error: err instanceof Error ? err.message : String(err),
          });
          results[i] = this._createFallbackResult(candidates[i]);
        }
      }
    };

    const workers = Array.from({ length: Math.min(CONCURRENCY, candidates.length) }, worker);
    await Promise.all(workers);

    return results;
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private _buildScoringPrompt(
    message: ScoringMessage,
    context: ScoringContext,
    weights: ScoringWeights,
  ): string {
    const transcriptStr = context.transcriptHistory
      .slice(-5)
      .map((t) => `- ${t.agentId}: ${t.text}`)
      .join("\n");

    const safeMsgText = sanitize(message.text);

    const pct = (w: number) => `${Math.round(w * 100)}%`;

    return `You are an evaluator for AI agent conversations. Score this message on 5 dimensions.

ROOM CONTEXT:
- Type: ${context.roomType}
- Objective: ${context.roomObjective}

TRANSCRIPT (last 5 messages):
${transcriptStr || "(empty)"}

CANDIDATE MESSAGE:
Agent: ${message.agentId}
Text: ${safeMsgText}

SCORING TASK:
Evaluate this message on these dimensions (0-100 each):

1. **Relevance (${pct(weights.relevance)} weight)**: Does it directly address the room objective?
2. **Novelty (${pct(weights.novelty)} weight)**: Does it introduce new or useful information?
3. **Coherence (${pct(weights.coherence)} weight)**: Does it connect logically to the discussion?
4. **Actionability (${pct(weights.actionability)} weight)**: Does it move toward concrete outputs?
5. **Engagement (${pct(weights.engagement)} weight)**: Does it maintain viewer interest?

RESPONSE FORMAT (JSON):
{
  "relevance_score": <0-100>,
  "novelty_score": <0-100>,
  "coherence_score": <0-100>,
  "actionability_score": <0-100>,
  "engagement_score": <0-100>,
  "overall_score": <0-100>,
  "reasoning": "<brief explanation>",
  "strengths": ["<strength1>", "<strength2>"],
  "weaknesses": ["<weakness1>"]
}

Respond ONLY with valid JSON.`;
  }

  private async _scoreWithRetry(
    prompt: string,
    messageId: string,
    roomId: string,
    weights: ScoringWeights,
  ): Promise<Record<string, unknown>> {
    let lastError: string = "";

    for (let attempt = 0; attempt < SCORING_RETRY_ATTEMPTS; attempt++) {
      try {
        const client = getLLMClient();

        const responseText = await Promise.race([
          client
            .messagesCreate({
              model: SCORING_MODEL,
              maxTokens: 1024,
              system:
                "You are a precise message scoring engine. " +
                "You MUST respond ONLY with valid JSON matching the specified schema. " +
                "Do not include any preamble, explanation, or markdown — just the JSON object.",
              messages: [{ role: "user", content: prompt }],
            })
            .then((r) => r.content[0]?.text ?? ""),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("scoring_timeout")), SCORING_TIMEOUT_MS),
          ),
        ]);

        return this._parseScoringResponse(responseText, messageId, weights);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        lastError = errMsg;

        if (errMsg === "scoring_timeout") {
          logger.warn("Scoring timeout", { messageId, roomId, attempt: attempt + 1, timeoutMs: SCORING_TIMEOUT_MS });
        } else {
          logger.error("Scoring error", { messageId, roomId, error: errMsg, attempt: attempt + 1 });
        }

        if (attempt < SCORING_RETRY_ATTEMPTS - 1) {
          await _sleep(SCORING_RETRY_DELAY_MS * Math.pow(2, attempt));
        }
      }
    }

    // All retries exhausted
    logger.error("Scoring failed after all retries — using fallback", {
      messageId,
      roomId,
      lastError,
      fallbackScore: FALLBACK_SCORE,
    });

    return _fallbackScoreData();
  }

  private _parseScoringResponse(
    responseText: string,
    messageId: string,
    weights: ScoringWeights,
  ): Record<string, unknown> {
    let json = responseText.trim();

    // Unwrap markdown code blocks: ```json ... ``` or ``` ... ```
    if (json.startsWith("```")) {
      const parts = json.split("```");
      json = parts[1] ?? "";
      if (json.startsWith("json")) json = json.slice(4);
      json = json.trim();
    }

    const data = JSON.parse(json) as Record<string, unknown>; // throws on invalid JSON → triggers retry

    const w = weights;
    const missing: string[] = [];

    const score = (key: string): number => {
      const val = data[key];
      if (val === undefined || val === null) {
        missing.push(key);
        return FALLBACK_SCORE;
      }
      const n = parseFloat(String(val));
      if (isNaN(n)) {
        missing.push(key);
        return FALLBACK_SCORE;
      }
      return Math.max(0, Math.min(100, n));
    };

    const relevance = score("relevance_score");
    const novelty = score("novelty_score");
    const coherence = score("coherence_score");
    const actionability = score("actionability_score");
    const engagement = score("engagement_score");

    if (missing.length > 0) {
      logger.warn("Scoring response missing expected fields — fallback values used", {
        messageId,
        missingFields: missing,
      });
    }

    const overall =
      relevance * w.relevance +
      novelty * w.novelty +
      coherence * w.coherence +
      actionability * w.actionability +
      engagement * w.engagement;

    return {
      relevance_score: relevance,
      novelty_score: novelty,
      coherence_score: coherence,
      actionability_score: actionability,
      engagement_score: engagement,
      overall_score: overall,
      reasoning: (data.reasoning as string) ?? "No reasoning provided",
      strengths: (data.strengths as string[]) ?? [],
      weaknesses: (data.weaknesses as string[]) ?? [],
    };
  }

  private _createFallbackResult(message: ScoringMessage): ScoringResult {
    return {
      messageId: message.id,
      agentId: message.agentId,
      overallScore: FALLBACK_SCORE,
      relevanceScore: FALLBACK_SCORE,
      noveltyScore: FALLBACK_SCORE,
      coherenceScore: FALLBACK_SCORE,
      actionabilityScore: FALLBACK_SCORE,
      engagementScore: FALLBACK_SCORE,
      reasoning: "Fallback score due to batch error",
      strengths: [],
      weaknesses: [],
      isModerated: false,
      fallbackTriggered: true,
    };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function _fallbackScoreData(): Record<string, unknown> {
  return {
    relevance_score: FALLBACK_SCORE,
    novelty_score: FALLBACK_SCORE,
    coherence_score: FALLBACK_SCORE,
    actionability_score: FALLBACK_SCORE,
    engagement_score: FALLBACK_SCORE,
    overall_score: FALLBACK_SCORE,
    reasoning: "Fallback score due to LLM unavailability",
    strengths: [],
    weaknesses: [],
    fallback_triggered: true,
  };
}
