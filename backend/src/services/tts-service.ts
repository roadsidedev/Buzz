// @ts-nocheck
/**
 * Text-to-Speech Service
 *
 * Integrates with ElevenLabs API for high-quality voice synthesis.
 * Uses the WebRTC Bot Service to inject audio streams directly into Jam rooms.
 *
 * Features:
 * - Voice synthesis via ElevenLabs API
 * - Audio streaming to Jam rooms via Headless WebRTC Bot
 * - Real-time conversational performance
 *
 * Env vars:
 *   ELEVENLABS_API_KEY   - ElevenLabs API key (required)
 *   ELEVENLABS_VOICE_A   - Voice ID for Alex
 *   ELEVENLABS_VOICE_B   - Voice ID for Mira
 */

import { ElevenLabsClient } from "elevenlabs";
import { logger } from "../utils/logger.js";
import { ValidationError, ServiceUnavailableError } from "../utils/errors.js";
import { getBotService } from "./bot-service.js";
import { TTS_CONFIG } from "../config/media-config.js";

// Buffer concatenation helper for ElevenLabs stream
async function streamToBuffer(stream: AsyncIterable<Buffer>): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export class TTSService {
  private elevenlabs: ElevenLabsClient | null = null;
  private defaultVoiceA: string;
  private defaultVoiceB: string;

  constructor() {
    const apiKey = process.env.ELEVENLABS_API_KEY || "";
    this.defaultVoiceA = process.env.ELEVENLABS_VOICE_A || "pNInz6obpgDQGcFmaJcg"; // Adam
    this.defaultVoiceB = process.env.ELEVENLABS_VOICE_B || "EXAVITQu4vr4xnSDxMaL"; // Rachel

    if (apiKey) {
      this.elevenlabs = new ElevenLabsClient({ apiKey });
      logger.info("ElevenLabs TTS Service initialized");
    } else {
      logger.warn("ElevenLabs TTS Service disabled: ELEVENLABS_API_KEY not found");
    }
  }

  isEnabled(): boolean {
    return TTS_CONFIG.enabled && this.elevenlabs !== null;
  }

  /**
   * Synthesize text to speech
   */
  async synthesize(request: { text: string; voiceId?: string }): Promise<{ audioBuffer: Buffer; durationMs: number; format: string }> {
    if (!this.elevenlabs) throw new ServiceUnavailableError("ElevenLabs TTS not configured");
    if (!request.text) throw new ValidationError("Text is required");

    const voiceId = request.voiceId || this.defaultVoiceA;

    try {
      const audioStream = await this.elevenlabs.textToSpeech.convert(voiceId, {
        text: request.text,
        model_id: "eleven_turbo_v2", // Fast latency conversational model
        output_format: "mp3_44100_128",
      });

      const audioBuffer = await streamToBuffer(audioStream);
      
      // Rough duration estimate if actual duration not provided
      const wordCount = request.text.split(/\s+/).length;
      const wpm = 150;
      const durationMs = Math.round((wordCount / wpm) * 60 * 1000);

      return { audioBuffer, durationMs, format: "mp3" };
    } catch (err) {
      logger.error("ElevenLabs TTS synthesis failed", { error: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  }

  /**
   * Synthesize and immediately pipe into the Headless WebRTC Bot for the given room
   */
  async synthesizeAndStream(
    jamRoomId: string,
    text: string,
    messageId: string,
    voiceId?: string,
  ): Promise<{ audioBuffer: Buffer; durationMs: number }> {
    const { audioBuffer } = await this.synthesize({ text, voiceId });

    const botService = getBotService();
    // Play the audio via the bot without blocking the current return
    botService.streamAudioBuffer(jamRoomId, audioBuffer).catch(e => {
        logger.error("Error playing audio stream via bot", { jamRoomId, error: e });
    });

    const wordCount = text.split(/\s+/).length;
    let durationMs = Math.round((wordCount / 150) * 60 * 1000);
    // Real duration might be longer, but we return estimate for quick API response
    // The bot service handles actual playing sequence sequentially.
    
    return { audioBuffer, durationMs };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    return this.elevenlabs !== null;
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
