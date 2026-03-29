/**
 * LLM Provider
 *
 * Provider-agnostic LLM client for message scoring and moderation.
 * Supports Anthropic (primary), OpenAI-compatible providers (OpenAI, NVIDIA NIM,
 * Kimi, OpenRouter), and Bankr gateway fallback — mirroring llm_provider.py.
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

const BANKR_BASE_URL = "https://llm.bankr.bot";

class BankrClient implements LLMClient {
  private inner: LLMClient;
  private bankrKey: string;
  private bankrUrl: string;

  constructor(inner: LLMClient, bankrKey: string, bankrUrl: string = BANKR_BASE_URL) {
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

      // Bankr exposes an OpenAI-compat endpoint
      const bankr = new OpenAICompatClient(this.bankrUrl, this.bankrKey);
      return bankr.messagesCreate(params);
    }
  }
}

// ─── Singleton factory ────────────────────────────────────────────────────────

let _client: LLMClient | null = null;

function _buildClient(): LLMClient {
  const provider = (process.env.SCORING_LLM_PROVIDER ?? "anthropic").toLowerCase();
  const apiKey = process.env.SCORING_LLM_API_KEY ?? "";
  const baseUrl = process.env.SCORING_LLM_BASE_URL ?? "";
  const bankrKey = process.env.BANKR_API_KEY ?? "";
  const bankrUrl = process.env.BANKR_BASE_URL ?? BANKR_BASE_URL;
  const activeGateway = process.env.ACTIVE_LLM_GATEWAY ?? "primary";

  let primary: LLMClient;

  if (provider === "anthropic") {
    const key = apiKey || process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || "";
    if (!key) {
      logger.warn("No Anthropic API key found (ANTHROPIC_API_KEY / CLAUDE_API_KEY / SCORING_LLM_API_KEY). Scoring will use fallback scores.");
    }
    primary = new AnthropicClient(key);
  } else if (provider === "none") {
    // Degraded mode — no LLM available
    logger.warn("SCORING_LLM_PROVIDER=none — all scoring calls will use fallback scores.");
    primary = {
      async messagesCreate(): Promise<LLMMessage> {
        throw new Error("LLM provider disabled (SCORING_LLM_PROVIDER=none)");
      },
    };
  } else {
    // OpenAI-compat: openai, nvidia, kimi, openrouter
    const effectiveKey = apiKey ||
      (provider === "nvidia" ? process.env.NVIDIA_API_KEY ?? "" : "") ||
      (provider === "openai" ? process.env.OPENAI_API_KEY ?? "" : "");

    const effectiveUrl = baseUrl ||
      (provider === "nvidia" ? "https://integrate.api.nvidia.com/v1" : "") ||
      (provider === "kimi" ? "https://api.moonshot.cn/v1" : "") ||
      (provider === "openrouter" ? "https://openrouter.ai/api/v1" : "") ||
      "https://api.openai.com/v1";

    primary = new OpenAICompatClient(effectiveUrl, effectiveKey);
  }

  // Wrap with Bankr fallback if configured
  if (bankrKey && activeGateway === "bankr") {
    return new BankrClient(primary, bankrKey, bankrUrl);
  }
  if (bankrKey) {
    // bankrKey set but gateway is "primary" — Bankr acts as secondary fallback only
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
