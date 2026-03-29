/**
 * Moderation Agent
 *
 * Port of orchestrator/src/services/moderation_agent.py
 *
 * Checks messages for safety violations via LLM and adjusts scores accordingly.
 * On any LLM error the default is isSafe=true (fail open) to prevent false positives
 * from blocking all messages during an outage.
 */

import { getLLMClient } from "./llm-provider.js";
import type { ScoringMessage, ScoringResult, ModerationResult } from "./types.js";
import { logger } from "../../utils/logger.js";

const MODERATION_MODEL = process.env.MODERATION_MODEL ?? "claude-3-5-haiku-20241022";

const MODERATION_PROMPT = `You are a content safety evaluator. Analyze the following message for safety violations.

Check for:
- Hate speech or discrimination
- Harassment or threats
- Deliberate misinformation
- Violent content
- Spam or repetitive content
- Adult/explicit content

Message to evaluate:
"{message}"

Respond ONLY with valid JSON:
{
  "is_safe": true/false,
  "violation_type": "<hate_speech|harassment|misinformation|violence|spam|adult_content|null>",
  "explanation": "<brief explanation>",
  "confidence": <0.0-1.0>
}`;

export class ModerationAgent {
  async scanMessage(message: ScoringMessage): Promise<ModerationResult> {
    try {
      const client = getLLMClient();
      const prompt = MODERATION_PROMPT.replace("{message}", message.text.slice(0, 2000));

      const response = await Promise.race([
        client.messagesCreate({
          model: MODERATION_MODEL,
          maxTokens: 256,
          messages: [{ role: "user", content: prompt }],
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("moderation_timeout")), 8000),
        ),
      ]);

      const text = response.content[0]?.text ?? "";
      return this._parseResponse(text);
    } catch (err) {
      logger.warn("Moderation scan failed — defaulting to safe", {
        messageId: message.id,
        error: err instanceof Error ? err.message : String(err),
      });
      // Fail open: don't block messages when moderation is unavailable
      return { isSafe: true, explanation: "Moderation unavailable", confidence: 0 };
    }
  }

  /**
   * Apply moderation result to a scoring result.
   * A violation sets overallScore to 0 and marks isModerated=true.
   */
  async updateScoringForViolations(
    scoringResult: ScoringResult,
    message: ScoringMessage,
  ): Promise<ScoringResult> {
    const modResult = await this.scanMessage(message);

    if (!modResult.isSafe) {
      logger.warn("Message flagged by moderation", {
        messageId: message.id,
        agentId: message.agentId,
        violationType: modResult.violationType,
      });
      return {
        ...scoringResult,
        overallScore: 0,
        isModerated: true,
        moderationReason: modResult.violationType ?? "policy_violation",
      };
    }

    return scoringResult;
  }

  private _parseResponse(text: string): ModerationResult {
    let json = text.trim();
    if (json.startsWith("```")) {
      const parts = json.split("```");
      json = parts[1] ?? "";
      if (json.startsWith("json")) json = json.slice(4);
      json = json.trim();
    }

    const data = JSON.parse(json) as {
      is_safe: boolean;
      violation_type?: string | null;
      explanation?: string;
      confidence?: number;
    };

    return {
      isSafe: data.is_safe ?? true,
      violationType: (data.violation_type ?? undefined) as ModerationResult["violationType"],
      explanation: data.explanation ?? "",
      confidence: data.confidence ?? 0,
    };
  }
}
