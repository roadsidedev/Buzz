// @ts-nocheck
/**
 * Text-to-Speech Service
 *
 * Integrates with ElevenLabs API and Google Cloud TTS for voice synthesis.
 * Supports fallback: tries ElevenLabs first, falls back to Google TTS on failure.
 *
 * Features:
 * - Voice synthesis via ElevenLabs API (primary)
 * - Voice synthesis via Google Cloud TTS (fallback)
 * - Automatic provider detection and fallback
 * - Voice mapping: Alex (male), Mira (female)
 *
 * Env vars:
 *   ELEVENLABS_API_KEY   - ElevenLabs API key
 *   ELEVENLABS_VOICE_A   - Voice ID for Alex (male)
 *   ELEVENLABS_VOICE_B   - Voice ID for Mira (female)
 *   GOOGLE_TTS_API_KEY   - Google Cloud TTS API key (fallback)
 *   GOOGLE_TTS_VOICE     - Voice for male (Alex)
 *   GOOGLE_TTS_VOICE_B   - Voice for female (Mira)
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
  private googleTtsApiKey: string = "";
  
  // Voice mappings
  private elevenLabsVoiceMale: string;
  private elevenLabsVoiceFemale: string;
  private googleVoiceMale: string;
  private googleVoiceFemale: string;
  private googleLanguage: string;

  constructor() {
    // ElevenLabs configuration
    const elevenLabsKey = process.env.ELEVENLABS_API_KEY || "";
    this.elevenLabsVoiceMale = process.env.ELEVENLABS_VOICE_A || "pNInz6obpgDQGcFmaJcg"; // Adam (male)
    this.elevenLabsVoiceFemale = process.env.ELEVENLABS_VOICE_B || "EXAVITQu4vr4xnSDxMaL"; // Rachel (female)

    if (elevenLabsKey) {
      this.elevenlabs = new ElevenLabsClient({ apiKey: elevenLabsKey });
      logger.info("ElevenLabs TTS Service initialized", { 
        voiceMale: this.elevenLabsVoiceMale, 
        voiceFemale: this.elevenLabsVoiceFemale 
      });
    } else {
      logger.warn("ElevenLabs TTS Service disabled: ELEVENLABS_API_KEY not found");
    }

    // Google TTS configuration (fallback)
    this.googleTtsApiKey = process.env.GOOGLE_TTS_API_KEY || "";
    this.googleVoiceMale = process.env.GOOGLE_TTS_VOICE || "en-US-Neural2-D"; // Male voice
    this.googleVoiceFemale = process.env.GOOGLE_TTS_VOICE_B || "en-US-Neural2-F"; // Female voice
    this.googleLanguage = process.env.GOOGLE_TTS_LANGUAGE || "en-US";

    if (this.googleTtsApiKey) {
      logger.info("Google TTS fallback configured", {
        voiceMale: this.googleVoiceMale,
        voiceFemale: this.googleVoiceFemale,
      });
    } else {
      logger.warn("Google TTS fallback disabled: GOOGLE_TTS_API_KEY not found");
    }
  }

  isEnabled(): boolean {
    return this.elevenlabs !== null || this.googleTtsApiKey !== "";
  }

  /**
   * Get voice ID for a given gender
   */
  getVoiceForGender(gender: VoiceGender, provider: "elevenlabs" | "google"): string {
    if (provider === "elevenlabs") {
      return gender === "male" ? this.elevenLabsVoiceMale : this.elevenLabsVoiceFemale;
    }
    return gender === "male" ? this.googleVoiceMale : this.googleVoiceFemale;
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
   * Synthesize text to speech using ElevenLabs (primary)
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
        model_id: "eleven_turbo_v2",
        output_format: "mp3_44100_128",
      });

      const audioBuffer = await streamToBuffer(audioStream);
      const wordCount = text.split(/\s+/).length;
      const durationMs = Math.round((wordCount / 150) * 60 * 1000);

      logger.debug("ElevenLabs synthesis successful", {
        voiceId: voice,
        textLength: text.length,
        audioSize: audioBuffer.length,
      });

      return { audioBuffer, durationMs };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error("ElevenLabs TTS synthesis failed", { error: errorMsg });
      throw new Error(`ElevenLabs failed: ${errorMsg}`);
    }
  }

  /**
   * Synthesize text to speech using Google Cloud TTS (fallback)
   */
  async synthesizeWithGoogle(
    text: string,
    voiceName?: string
  ): Promise<{ audioBuffer: Buffer; durationMs: number }> {
    if (!this.googleTtsApiKey) {
      throw new ServiceUnavailableError("Google TTS not configured");
    }
    if (!text) {
      throw new ValidationError("Text is required");
    }

    const voice = voiceName || this.googleVoiceMale;

    try {
      const response = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${this.googleTtsApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input: { text },
            voice: { languageCode: this.googleLanguage, name: voice },
            audioConfig: { audioEncoding: "MP3" },
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || `Google TTS HTTP ${response.status}`);
      }

      if (!data.audioContent) {
        throw new Error("No audio content returned from Google TTS");
      }

      const audioBuffer = Buffer.from(data.audioContent, "base64");
      const wordCount = text.split(/\s+/).length;
      const durationMs = Math.round((wordCount / 150) * 60 * 1000);

      logger.debug("Google TTS synthesis successful", {
        voiceName: voice,
        textLength: text.length,
        audioSize: audioBuffer.length,
      });

      return { audioBuffer, durationMs };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error("Google TTS synthesis failed", { error: errorMsg });
      throw new Error(`Google TTS failed: ${errorMsg}`);
    }
  }

  /**
   * Synthesize text - tries ElevenLabs first, falls back to Google TTS
   */
  async synthesize(request: { text: string; voiceId?: string; agentName?: string }): Promise<{ audioBuffer: Buffer; durationMs: number; format: string; provider: string }> {
    const { text, voiceId, agentName } = request;
    
    if (!text) {
      throw new ValidationError("Text is required");
    }

    // Detect gender based on agent name
    const gender = this.detectGender(agentName || "");
    const usedGender = gender;

    // Try ElevenLabs first
    if (this.elevenlabs) {
      try {
        const voice = voiceId || this.getVoiceForGender(usedGender, "elevenlabs");
        const result = await this.synthesizeWithElevenLabs(text, voice);
        return { ...result, format: "mp3", provider: "elevenlabs" };
      } catch (err) {
        logger.warn("ElevenLabs synthesis failed, attempting Google TTS fallback", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Fallback to Google TTS
    if (this.googleTtsApiKey) {
      try {
        const voice = this.getVoiceForGender(usedGender, "google");
        const result = await this.synthesizeWithGoogle(text, voice);
        return { ...result, format: "mp3", provider: "google" };
      } catch (err) {
        logger.error("Google TTS fallback also failed", {
          error: err instanceof Error ? err.message : String(err),
        });
        throw new ServiceUnavailableError("All TTS providers failed");
      }
    }

    throw new ServiceUnavailableError("No TTS provider available");
  }

  /**
   * Synthesize and stream to Jam audio room.
   *
   * For self-hosted Jam (V2), audio is delivered via Socket.IO events to the
   * frontend, which then injects it into the WebRTC/SFU pipeline. The backend
   * does NOT directly stream audio to the SFU — that's the frontend's job.
   *
   * This method generates the audio buffer and signals the pantry that audio
   * is starting/stopping via the beely routes.
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

    // For self-hosted Jam (V2), signal audio start/end via pantry beely routes.
    // The actual audio data is delivered to listeners via Socket.IO tts:audio events
    // emitted by the TTS route handler, which the frontend injects into WebRTC.
    try {
      const { getJam } = await import("./jam-service-factory.js");
      const jamService = getJam();

      // Signal audio start to pantry (for beely orchestration tracking)
      jamService.sendToRoom(jamRoomId, "beely", "audio:start", {
        messageId,
        agentName,
        durationMs: result.durationMs,
      });

      // Signal audio end after duration
      if (result.durationMs > 0) {
        setTimeout(() => {
          jamService.sendToRoom(jamRoomId, "beely", "audio:end", {
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
  async healthCheck(): Promise<{ elevenlabs: boolean; google: boolean }> {
    return {
      elevenlabs: this.elevenlabs !== null,
      google: this.googleTtsApiKey !== "",
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
