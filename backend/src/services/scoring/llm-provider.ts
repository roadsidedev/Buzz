/**
 * LLM Provider
 *
 * Provider-agnostic LLM client for message scoring and moderation.
 * Supports Anthropic (primary), OpenAI-compatible providers (OpenAI, NVIDIA NIM,
 * Kimi, OpenRouter), and Bankr gateway fallback.
 *
 * Configuration (3 env vars, all you need):
 *   LLM_PROVIDER=anthropic|openai|nvidia|kimi|openrouter|none  (default: anthropic)
 *   LLM_API_KEY=<your provider key>
 *   LLM_BASE_URL=<base URL for OpenAI-compat providers, optional>
 *
 * Optional Bankr fallback:
 *   BANKR_API_KEY=<bankr key>
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

    return {
      content: response.content.map((block) => ({
        text: block.type === "text" ? block.text : "",
      })),
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

    return {
      content: [{ text: data.choices[0]?.message?.content ?? "" }],
    };
  }
}

// ─── Bankr gateway wrapper ────────────────────────────────────────────────────

const BANKR_DEFAULT_URL = "https://llm.bankr.bot";

class BankrClient implements LLMClient {
  private inner: LLMClient;
  private bankrKey: string;
  private bankrUrl: string;

  constructor(inner: LLMClient, bankrKey: string, bankrUrl: string = BANKR_DEFAULT_URL) {
    this.inner = inner;
    this.bankrKey = bankrKey;
    this.bankrUrl = bankrUrl;
  }

  async messagesCreate(params: LLMCreateParams): Promise<LLMMessage> {
    try {
      return await this.inner.messagesCreate(params);
    } catch (primaryErr) {
      logger.warn("Primary LLM failed, falling back to Bankr gateway", {
        error: primaryErr instanceof Error ? primaryErr.message : String(primaryErr),
      });
      const bankr = new OpenAICompatClient(this.bankrUrl, this.bankrKey);
      return bankr.messagesCreate(params);
    }
  }
}

// ─── Singleton factory ────────────────────────────────────────────────────────

let _client: LLMClient | null = null;

function _buildClient(): LLMClient {
  const provider = (process.env.LLM_PROVIDER ?? "anthropic").toLowerCase();
  const apiKey   = process.env.LLM_API_KEY ?? "";
  const baseUrl  = process.env.LLM_BASE_URL ?? "";
  const bankrKey = process.env.BANKR_API_KEY ?? "";
  const bankrUrl = process.env.BANKR_BASE_URL ?? BANKR_DEFAULT_URL;

  let primary: LLMClient;

  if (provider === "anthropic") {
    // Fall back to common Anthropic key names if LLM_API_KEY is not set
    const key = apiKey || process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || "";
    if (!key) {
      logger.warn("No API key found for Anthropic provider. Set LLM_API_KEY. Scoring will use fallback scores.");
    }
    primary = new AnthropicClient(key);
  } else if (provider === "none") {
    logger.warn("LLM_PROVIDER=none — all scoring calls will use fallback scores.");
    primary = {
      async messagesCreate(): Promise<LLMMessage> {
        throw new Error("LLM provider disabled (LLM_PROVIDER=none)");
      },
    };
  } else {
    // OpenAI-compat: openai, nvidia, kimi, openrouter, or any custom provider
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

    primary = new OpenAICompatClient(effectiveUrl, effectiveKey);
  }

  // Wrap with Bankr fallback if a Bankr key is configured
  if (bankrKey) {
    return new BankrClient(primary, bankrKey, bankrUrl);
  }

  return primary;
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

export const SCORING_MODEL = process.env.SCORING_MODEL ?? "claude-3-5-sonnet-20241022";

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
