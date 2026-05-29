// @ts-nocheck
/**
 * Text-to-Speech Service
 *
 * Integrates with MiMo TTS (primary) and ElevenLabs (fallback).
 * Google TTS has been removed (suspended API key).
 *
 * Features:
 * - Voice synthesis via Xiaomi MiMo V2.5 TTS (primary, currently free)
 * - Voice synthesis via ElevenLabs API (fallback)
 * - Automatic provider detection and fallback
 * - Voice mapping: Alex (male), Mira (female)
 *
 * Env vars:
 *   MIMO_API_KEY         - MiMo API key (primary TTS)
 *   MIMO_TTS_VOICE_A     - Voice for Alex (male, default: Dean)
 *   MIMO_TTS_VOICE_B     - Voice for Mira (female, default: Chloe)
 *   MIMO_BASE_URL        - MiMo API base URL (optional, defaults to global)
 *   ELEVENLABS_API_KEY   - ElevenLabs API key (fallback)
 *   ELEVENLABS_VOICE_A   - Voice ID for Alex (male)
 *   ELEVENLABS_VOICE_B   - Voice ID for Mira (female)
 */

import { ElevenLabsClient } from "elevenlabs";
import { logger } from "../utils/logger.js";
import { ValidationError, ServiceUnavailableError } from "../utils/errors.js";
import { getJam } from "./jam-service-factory.js";

// Buffer concatenation helper for ElevenLabs stream
async function streamToBuffer(stream: AsyncIterable<Buffer>): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export type VoiceGender = "male" | "female";

export interface TTSProvider {
  name: string;
  synthesize(text: string, voiceId?: string): Promise<{ audioBuffer: Buffer; durationMs: number }>;
}

export class TTSService {
  private elevenlabs: ElevenLabsClient | null = null;

  // MiMo TTS config
  private mimoApiKey: string = "";
  private mimoBaseUrl: string = "";
  private mimoVoiceMale: string;
  private mimoVoiceFemale: string;
  private isOpengateway: boolean = false;

  // Voice mappings
  private elevenLabsVoiceMale: string;
  private elevenLabsVoiceFemale: string;

  constructor() {
    // MiMo TTS configuration (primary)
    // Priority: OPENGATEWAY_API_KEY > MIMO_API_KEY
    this.mimoApiKey = process.env.OPENGATEWAY_API_KEY || process.env.MIMO_API_KEY || "";
    this.mimoBaseUrl = (process.env.OPENGATEWAY_BASE_URL || process.env.MIMO_BASE_URL || "https://token-plan-sgp.xiaomimimo.com/v1").replace(/\/+$/, "");
    this.isOpengateway = !!(process.env.OPENGATEWAY_API_KEY || (this.mimoBaseUrl.includes("opengateway")));
    this.mimoVoiceMale = process.env.MIMO_TTS_VOICE_A || "Dean";    // Alex (male)
    this.mimoVoiceFemale = process.env.MIMO_TTS_VOICE_B || "Chloe"; // Mira (female)

    if (this.mimoApiKey) {
      const provider = process.env.OPENGATEWAY_API_KEY ? "OpenGateway" : "MiMo";
      logger.info(`${provider} TTS Service initialized (primary)`, {
        baseUrl: this.mimoBaseUrl,
        voiceMale: this.mimoVoiceMale,
        voiceFemale: this.mimoVoiceFemale,
      });
    } else {
      logger.warn("MiMo TTS Service disabled: neither OPENGATEWAY_API_KEY nor MIMO_API_KEY set");
    }

    // ElevenLabs configuration (fallback)
    const elevenLabsKey = process.env.ELEVENLABS_API_KEY || "";
    this.elevenLabsVoiceMale = process.env.ELEVENLABS_VOICE_A || "pNInz6obpgDQGcFmaJcg"; // Adam (male)
    this.elevenLabsVoiceFemale = process.env.ELEVENLABS_VOICE_B || "EXAVITQu4vr4xnSDxMaL"; // Rachel (female)

    if (elevenLabsKey) {
      this.elevenlabs = new ElevenLabsClient({ apiKey: elevenLabsKey });
      logger.info("ElevenLabs TTS Service initialized (fallback)", {
        voiceMale: this.elevenLabsVoiceMale,
        voiceFemale: this.elevenLabsVoiceFemale,
      });
    } else {
      logger.warn("ElevenLabs TTS Service disabled: ELEVENLABS_API_KEY not found");
    }
  }

  isEnabled(): boolean {
    return this.mimoApiKey !== "" || this.elevenlabs !== null;
  }

  /**
   * Get voice ID for a given gender
   */
  getVoiceForGender(gender: VoiceGender, provider: "mimo" | "elevenlabs"): string {
    if (provider === "mimo") {
      return gender === "male" ? this.mimoVoiceMale : this.mimoVoiceFemale;
    }
    return gender === "male" ? this.elevenLabsVoiceMale : this.elevenLabsVoiceFemale;
  }

  /**
   * Detect if we should use male or female voice based on agent name
   */
  detectGender(agentName: string): VoiceGender {
    const name = (agentName || "").toLowerCase();
    // Mira is female, Alex is male by default
    if (name.includes("mira") || name.includes("female")) {
      return "female";
    }
    return "male";
  }

  /**
   * Synthesize text to speech using Xiaomi MiMo V2.5 TTS (primary)
   *
   * Uses the OpenAI-compatible chat/completions endpoint with audio output.
   * MiMo TTS currently free for a limited time.
   */
  async synthesizeWithMiMo(
    text: string,
    voiceId?: string
  ): Promise<{ audioBuffer: Buffer; durationMs: number }> {
    if (!this.mimoApiKey) {
      throw new ServiceUnavailableError("MiMo TTS not configured");
    }
    if (!text) {
      throw new ValidationError("Text is required");
    }

    const voice = voiceId || this.mimoVoiceMale;

    try {
      const authHeader = this.isOpengateway
        ? { "Authorization": `Bearer ${this.mimoApiKey}` }
        : { "api-key": this.mimoApiKey };

      const response = await fetch(`${this.mimoBaseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        body: JSON.stringify({
          model: "mimo-v2.5-tts",
          messages: [
            { role: "user", content: "" },
            { role: "assistant", content: text },
          ],
          audio: {
            format: "wav",
            voice: voice,
          },
        }),
      });

      if (!response.ok) {
        const errBody = await response.text().catch(() => "");
        throw new Error(`MiMo TTS HTTP ${response.status}: ${errBody.slice(0, 200)}`);
      }

      const data = await response.json();

      // Extract audio from response
      const audioData = data.choices?.[0]?.message?.audio?.data;
      if (!audioData) {
        throw new Error("No audio data in MiMo TTS response");
      }

      const audioBuffer = Buffer.from(audioData, "base64");
      const wordCount = text.split(/\s+/).length;
      const durationMs = Math.round((wordCount / 150) * 60 * 1000);

      logger.info("MiMo TTS synthesis successful", {
        voice,
        textLength: text.length,
        audioSize: audioBuffer.length,
        durationMs,
      });

      return { audioBuffer, durationMs };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error("MiMo TTS synthesis failed", { error: errorMsg });
      throw new Error(`MiMo TTS failed: ${errorMsg}`);
    }
  }

  /**
   * Synthesize text to speech using ElevenLabs (fallback)
   *
   * Uses the REST API directly for maximum compatibility.
   */
  async synthesizeWithElevenLabs(
    text: string,
    voiceId?: string
  ): Promise<{ audioBuffer: Buffer; durationMs: number }> {
    if (!this.elevenlabs) {
      throw new ServiceUnavailableError("ElevenLabs TTS not configured");
    }
    if (!text) {
      throw new ValidationError("Text is required");
    }

    const voice = voiceId || this.elevenLabsVoiceMale;

    try {
      const audioStream = await this.elevenlabs.textToSpeech.convert(voice, {
        text,
        model_id: process.env.ELEVENLABS_MODEL_ID || "eleven_turbo_v2_5",
        output_format: "mp3_44100_128",
      });

      const audioBuffer = await streamToBuffer(audioStream);
      const wordCount = text.split(/\s+/).length;
      const durationMs = Math.round((wordCount / 150) * 60 * 1000);

      logger.info("ElevenLabs synthesis successful", {
        voiceId: voice,
        textLength: text.length,
        audioSize: audioBuffer.length,
      });

      return { audioBuffer, durationMs };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error("ElevenLabs TTS synthesis failed", {
        error: errorMsg,
        voiceId: voice,
        apiKeySet: !!process.env.ELEVENLABS_API_KEY,
        apiKeyPrefix: (process.env.ELEVENLABS_API_KEY || "").slice(0, 4),
      });
      throw new Error(`ElevenLabs failed: ${errorMsg}`);
    }
  }

  /**
   * Synthesize text - tries MiMo first, falls back to ElevenLabs
   */
  async synthesize(request: { text: string; voiceId?: string; agentName?: string }): Promise<{ audioBuffer: Buffer; durationMs: number; format: string; provider: string }> {
    const { text, voiceId, agentName } = request;

    if (!text) {
      throw new ValidationError("Text is required");
    }

    // Detect gender based on agent name
    const gender = this.detectGender(agentName || "");

    // 1. Try MiMo TTS first (primary, currently free)
    if (this.mimoApiKey) {
      try {
        const voice = voiceId || this.getVoiceForGender(gender, "mimo");
        const result = await this.synthesizeWithMiMo(text, voice);
        return { ...result, format: "wav", provider: "mimo" };
      } catch (err) {
        logger.warn("MiMo TTS synthesis failed, attempting ElevenLabs fallback", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // 2. Fallback to ElevenLabs
    if (this.elevenlabs) {
      try {
        const voice = voiceId || this.getVoiceForGender(gender, "elevenlabs");
        const result = await this.synthesizeWithElevenLabs(text, voice);
        return { ...result, format: "mp3", provider: "elevenlabs" };
      } catch (err) {
        logger.warn("ElevenLabs synthesis failed — no more providers available", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    throw new ServiceUnavailableError("No TTS provider available");
  }

  /**
   * Synthesize and stream to Jam audio room.
   */
  async synthesizeAndStream(
    jamRoomId: string,
    text: string,
    messageId: string,
    voiceId?: string,
    agentName?: string
  ): Promise<{ audioBuffer: Buffer; durationMs: number; provider: string }> {
    // Generate audio with fallback
    const result = await this.synthesize({ text, voiceId, agentName });

    // Signal audio start/end via pantry Buzz routes
    try {
      const { getJam } = await import("./jam-service-factory.js");
      const jamService = getJam();

      jamService.sendToRoom(jamRoomId, "Buzz", "audio:start", {
        messageId,
        agentName,
        durationMs: result.durationMs,
      });

      if (result.durationMs > 0) {
        setTimeout(() => {
          jamService.sendToRoom(jamRoomId, "Buzz", "audio:end", {
            messageId,
          });
        }, result.durationMs);
      }
    } catch (err) {
      logger.warn("Failed to signal audio to Jam room (non-fatal)", {
        jamRoomId,
        messageId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    return {
      audioBuffer: result.audioBuffer,
      durationMs: result.durationMs,
      provider: result.provider,
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ mimo: boolean; elevenlabs: boolean }> {
    return {
      mimo: this.mimoApiKey !== "",
      elevenlabs: this.elevenlabs !== null,
    };
  }
}

// Singleton instance
let ttsServiceInstance: TTSService | null = null;
export function getTTSService(): TTSService {
  if (!ttsServiceInstance) {
    ttsServiceInstance = new TTSService();
  }
  return ttsServiceInstance;
}
