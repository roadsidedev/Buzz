/**
 * Text-to-Speech Service
 *
 * Uses ElevenLabs for all TTS. MiMo TTS has been removed.
 *
 * Env vars:
 *   ELEVENLABS_API_KEY   - ElevenLabs API key
 *   ELEVENLABS_VOICE_A   - Voice ID for Alex (male, default: pNInz6obpgDQGcFmaJcg)
 *   ELEVENLABS_VOICE_B   - Voice ID for Mira (female, default: EXAVITQu4vr4xnSDxMaL)
 *   ELEVENLABS_MODEL_ID  - Model ID (default: eleven_turbo_v2_5)
 *   ELEVENLABS_OUTPUT_FORMAT - Output format (default: mp3_44100_128)
 */

import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { logger } from "../utils/logger.js";
import { ValidationError, ServiceUnavailableError } from "../utils/errors.js";
import { getJam } from "./jam-service-factory.js";

export type VoiceGender = "male" | "female";

export class TTSService {
  private elevenlabs: ElevenLabsClient | null = null;

  private elevenLabsVoiceMale: string;
  private elevenLabsVoiceFemale: string;

  constructor() {
    const elevenLabsKey = process.env.ELEVENLABS_API_KEY || "";
    this.elevenLabsVoiceMale = process.env.ELEVENLABS_VOICE_A || "pNInz6obpgDQGcFmaJcg";
    this.elevenLabsVoiceFemale = process.env.ELEVENLABS_VOICE_B || "EXAVITQu4vr4xnSDxMaL";

    if (elevenLabsKey) {
      this.elevenlabs = new ElevenLabsClient({ apiKey: elevenLabsKey });
      logger.info("ElevenLabs TTS Service initialized", {
        voiceMale: this.elevenLabsVoiceMale,
        voiceFemale: this.elevenLabsVoiceFemale,
      });
    } else {
      logger.warn("ElevenLabs TTS Service disabled: ELEVENLABS_API_KEY not found");
    }
  }

  isEnabled(): boolean {
    return this.elevenlabs !== null;
  }

  getVoiceForGender(gender: VoiceGender): string {
    return gender === "male" ? this.elevenLabsVoiceMale : this.elevenLabsVoiceFemale;
  }

  detectGender(agentName: string): VoiceGender {
    const name = (agentName || "").toLowerCase();
    if (name.includes("mira") || name.includes("female")) {
      return "female";
    }
    return "male";
  }

  async synthesize(request: { text: string; voiceId?: string; agentName?: string }): Promise<{ audioBuffer: Buffer; durationMs: number; format: string; provider: string }> {
    const { text, voiceId, agentName } = request;

    if (!text) {
      throw new ValidationError("Text is required");
    }

    const gender = this.detectGender(agentName || "");

    if (!this.elevenlabs) {
      throw new ServiceUnavailableError("ElevenLabs TTS not configured");
    }

    try {
      const voice = voiceId || this.getVoiceForGender(gender);
      const result = await this._synthesizeWithElevenLabs(text, voice);
      return { ...result, format: "mp3", provider: "elevenlabs" };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error("ElevenLabs TTS synthesis failed", {
        error: errorMsg,
      });
      throw new ServiceUnavailableError("No TTS provider available");
    }
  }

  private async _synthesizeWithElevenLabs(
    text: string,
    voice: string,
  ): Promise<{ audioBuffer: Buffer; durationMs: number }> {
    if (!this.elevenlabs) {
      throw new ServiceUnavailableError("ElevenLabs TTS not configured");
    }
    if (!text) {
      throw new ValidationError("Text is required");
    }

    try {
      const { audioBuffer, durationMs } = await this._synthesizeWithElevenLabsSDK(voice, text);
      logger.info("ElevenLabs synthesis successful", {
        voiceId: voice,
        textLength: text.length,
        audioSize: audioBuffer.length,
      });
      return { audioBuffer, durationMs };
    } catch (sdkErr) {
      const sdkMsg = sdkErr instanceof Error ? sdkErr.message : String(sdkErr);
      logger.warn("ElevenLabs SDK failed, trying direct REST API", {
        error: sdkMsg,
      });

      try {
        return await this._synthesizeWithElevenLabsREST(text, voice);
      } catch (restErr) {
        const restMsg = restErr instanceof Error ? restErr.message : String(restErr);
        logger.error("ElevenLabs TTS synthesis failed", {
          error: restMsg,
          voiceId: voice,
          apiKeySet: !!process.env.ELEVENLABS_API_KEY,
          apiKeyPrefix: (process.env.ELEVENLABS_API_KEY || "").slice(0, 4),
        });
        throw new Error(`ElevenLabs failed: ${restMsg}`);
      }
    }
  }

  private async _synthesizeWithElevenLabsSDK(
    voice: string,
    text: string,
  ): Promise<{ audioBuffer: Buffer; durationMs: number }> {
    const modelId = process.env.ELEVENLABS_MODEL_ID || "eleven_turbo_v2_5";

    const result = await this.elevenlabs!.textToSpeech.convert(voice, {
      text,
      modelId,
    });

    let audioBuffer: Buffer;

    if (typeof result === "object" && result !== null) {
      if (typeof (result as any).arrayBuffer === "function") {
        const ab = await (result as any).arrayBuffer();
        audioBuffer = Buffer.from(ab);
      } else if ((result as any).body) {
        const reader = (result as any).body.getReader();
        const chunks: Uint8Array[] = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        const totalLen = chunks.reduce((a, c) => a + c.length, 0);
        audioBuffer = Buffer.concat(chunks.map(c => Buffer.from(c)), totalLen);
      } else if (typeof (result as any).pipe === "function") {
        const chunks: Buffer[] = [];
        for await (const chunk of result as any) {
          chunks.push(Buffer.from(chunk));
        }
        audioBuffer = Buffer.concat(chunks);
      } else {
        audioBuffer = Buffer.from(result as any);
      }
    } else {
      audioBuffer = Buffer.from(result as any);
    }

    const wordCount = text.split(/\s+/).length;
    const durationMs = Math.round((wordCount / 150) * 60 * 1000);

    logger.info("ElevenLabs SDK v2 synthesis successful", {
      voiceId: voice,
      modelId,
      textLength: text.length,
      audioSize: audioBuffer.length,
    });

    return { audioBuffer, durationMs };
  }

  private async _synthesizeWithElevenLabsREST(
    text: string,
    voice: string,
  ): Promise<{ audioBuffer: Buffer; durationMs: number }> {
    const apiKey = process.env.ELEVENLABS_API_KEY || "";
    const modelId = process.env.ELEVENLABS_MODEL_ID || "eleven_turbo_v2_5";

    // Try different auth header formats
    const authConfigs = [
      { name: "xi-api-key", headers: { "xi-api-key": apiKey } },
      { name: "Bearer", headers: { "Authorization": `Bearer ${apiKey}` } },
    ];

    for (const auth of authConfigs) {
      try {
        const response = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${voice}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "audio/mpeg",
              ...auth.headers,
            },
            body: JSON.stringify({ text, model_id: modelId }),
          },
        );

        if (!response.ok) {
          const errBody = await response.text().catch(() => "");
          logger.warn(`ElevenLabs REST (${auth.name}) failed`, {
            status: response.status,
            body: errBody.slice(0, 200),
          });
          continue;
        }

        const audioBuffer = Buffer.from(await response.arrayBuffer());
        const wordCount = text.split(/\s+/).length;
        const durationMs = Math.round((wordCount / 150) * 60 * 1000);

        logger.info("ElevenLabs REST synthesis successful", {
          voiceId: voice,
          authMethod: auth.name,
          textLength: text.length,
          audioSize: audioBuffer.length,
        });

        return { audioBuffer, durationMs };
      } catch (fetchErr) {
        logger.warn(`ElevenLabs REST (${auth.name}) fetch error`, {
          error: fetchErr instanceof Error ? fetchErr.message : String(fetchErr),
        });
      }
    }

    throw new Error(`ElevenLabs REST failed after all auth attempts for voice ${voice}`);
  }

  async synthesizeAndStream(
    jamRoomId: string,
    text: string,
    messageId: string,
    voiceId?: string,
    agentName?: string
  ): Promise<{ audioBuffer: Buffer; durationMs: number; provider: string }> {
    const result = await this.synthesize({ text, voiceId, agentName });

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

  async healthCheck(): Promise<{ elevenlabs: boolean }> {
    return {
      elevenlabs: this.elevenlabs !== null,
    };
  }
}

let ttsServiceInstance: TTSService | null = null;
export function getTTSService(): TTSService {
  if (!ttsServiceInstance) {
    ttsServiceInstance = new TTSService();
  }
  return ttsServiceInstance;
}
