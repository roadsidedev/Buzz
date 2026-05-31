/**
 * LLM Provider
 *
 * Provider-agnostic LLM client for message scoring and moderation.
 * Supports Anthropic and OpenAI-compatible providers (OpenAI, NVIDIA NIM,
 * Kimi, OpenRouter, OpenGateway, etc.).
 *
 * Configuration (3 env vars, all you need):
 *   LLM_PROVIDER=anthropic|openai|nvidia|kimi|openrouter|opengateway|none  (default: anthropic)
 *   LLM_API_KEY=<your provider key>
 *   LLM_BASE_URL=<base URL for OpenAI-compat providers, optional>
 *
 * Usage:
 *   const client = getLLMClient();
 *   const response = await client.messagesCreate({ model, maxTokens, system, messages });
 */

import Anthropic from "@anthropic-ai/sdk";
import { logger } from "../../utils/logger.js";

// ─── Unified response type ────────────────────────────────────────────────────

export interface LLMMessage {
  content: Array<{ text: string }>;
}

export interface LLMCreateParams {
  model: string;
  maxTokens: number;
  system?: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}

// ─── Provider interface ───────────────────────────────────────────────────────

export interface LLMClient {
  messagesCreate(params: LLMCreateParams): Promise<LLMMessage>;
}

// ─── Anthropic adapter ────────────────────────────────────────────────────────

class AnthropicClient implements LLMClient {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async messagesCreate(params: LLMCreateParams): Promise<LLMMessage> {
    const response = await this.client.messages.create({
      model: params.model,
      max_tokens: params.maxTokens,
      system: params.system,
      messages: params.messages,
    });

    const texts = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block.type === "text" ? block.text : ""));

    const combined = texts.join("").trim();
    if (combined.length === 0) {
      throw new Error("Anthropic returned empty content");
    }

    return {
      content: texts.map((text) => ({ text })),
    };
  }
}

// ─── OpenAI-compatible adapter (OpenAI, NVIDIA NIM, Kimi, OpenRouter) ────────

class OpenAICompatClient implements LLMClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
  }

  async messagesCreate(params: LLMCreateParams): Promise<LLMMessage> {
    const messages = params.system
      ? [{ role: "system" as const, content: params.system }, ...params.messages]
      : params.messages;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        "Accept-Encoding": "identity",
      },
      body: JSON.stringify({
        model: params.model,
        max_tokens: params.maxTokens,
        messages,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI-compat error ${response.status}: ${err}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = data.choices[0]?.message?.content;
    if (!content || content.trim().length === 0) {
      throw new Error(
        `OpenAI-compat returned empty content from ${this.baseUrl} (status ${response.status})`,
      );
    }

    return {
      content: [{ text: content }],
    };
  }
}

// ─── Singleton factory ────────────────────────────────────────────────────────

let _client: LLMClient | null = null;

function _buildClient(): LLMClient {
  const provider = (process.env.LLM_PROVIDER ?? "anthropic").toLowerCase();
  const apiKey   = process.env.LLM_API_KEY ?? "";
  const baseUrl  = process.env.LLM_BASE_URL ?? "";

  if (provider === "anthropic") {
    // Fall back to common Anthropic key names if LLM_API_KEY is not set
    const key = apiKey || process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || "";
    if (!key) {
      logger.warn("No API key found for Anthropic provider. Set LLM_API_KEY. Scoring will use fallback scores.");
    }
    return new AnthropicClient(key);
  }

  if (provider === "none") {
    logger.warn("LLM_PROVIDER=none — all scoring calls will use fallback scores.");
    return {
      async messagesCreate(): Promise<LLMMessage> {
        throw new Error("LLM provider disabled (LLM_PROVIDER=none)");
      },
    };
  }

  // OpenAI-compat: openai, nvidia, kimi, openrouter, opengateway, or any custom provider
  const effectiveKey = apiKey ||
    (provider === "opengateway" ? process.env.OPENGATEWAY_API_KEY ?? "" : "") ||
    (provider === "mimo"        ? process.env.MIMO_API_KEY ?? "" : "") ||
    (provider === "nvidia"      ? process.env.NVIDIA_API_KEY  ?? "" : "") ||
    (provider === "openai"      ? process.env.OPENAI_API_KEY  ?? "" : "");

  // Default base URLs for known providers; override with LLM_BASE_URL
  const defaultUrls: Record<string, string> = {
    openai:      "https://api.openai.com/v1",
    openaicompat:"https://api.openai.com/v1",
    nvidia:      "https://integrate.api.nvidia.com/v1",
    kimi:        "https://api.moonshot.cn/v1",
    openrouter:  "https://openrouter.ai/api/v1",
    opengateway: "https://opengateway.gitlawb.com/v1",
    mimo:        "https://token-plan-sgp.xiaomimimo.com/v1",
    groq:        "https://api.groq.com/openai/v1",
    together:    "https://api.together.xyz/v1",
    deepseek:    "https://api.deepseek.com/v1",
  };
  const effectiveUrl = baseUrl || defaultUrls[provider] || "https://api.openai.com/v1";

  return new OpenAICompatClient(effectiveUrl, effectiveKey);
}

export function getLLMClient(): LLMClient {
  if (!_client) {
    _client = _buildClient();
  }
  return _client;
}

/** Reset singleton — mainly for testing */
export function resetLLMClient(): void {
  _client = null;
}

// ─── Shared scoring config ────────────────────────────────────────────────────

if (!process.env.SCORING_MODEL) {
  logger.warn(
    "SCORING_MODEL env var is not set — scoring calls will fail. " +
    "Set SCORING_MODEL to a model your LLM provider supports.",
  );
}

export const SCORING_MODEL = process.env.SCORING_MODEL ?? "";

/**
 * Strip markdown code fences from LLM responses before JSON.parse.
 * Handles ` ```json ... ``` ` and ` ``` ... ``` `.
 */
export function stripMarkdownFences(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  const parts = trimmed.split("```");
  let inner = parts[1] ?? "";
  if (inner.startsWith("json")) inner = inner.slice(4);
  return inner.trim();
}
