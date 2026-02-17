/**
 * Text-to-Speech Service
 *
 * Integrates with ElevenLabs API for high-quality voice synthesis.
 * Manages audio streaming to Jam rooms for real-time playback.
 *
 * Features:
 * - Voice synthesis with ElevenLabs API
 * - Audio streaming to Jam rooms
 * - Voice caching for performance
 * - WebSocket audio delivery
 * - Error handling and retries
 */

import { logger } from "../utils/logger.js";
import { ValidationError, ServiceUnavailableError } from "../utils/errors.js";
import { getJamService } from "./jam-service.js";

// Voice configuration
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // ElevenLabs default voice
const DEFAULT_MODEL_ID = "eleven_monolingual_v1";

interface TTSConfig {
  apiKey: string;
  baseUrl: string;
  defaultVoiceId: string;
  defaultModelId: string;
}

interface SynthesisRequest {
  text: string;
  voiceId?: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
}

interface SynthesisResponse {
  audioBuffer: Buffer;
  durationMs: number;
  format: string;
}

/**
 * TTS Service for voice synthesis and streaming
 */
export class TTSService {
  private config: TTSConfig;
  private voiceCache = new Map<string, Buffer>();

  constructor() {
    this.config = {
      apiKey: process.env.ELEVENLABS_API_KEY || "",
      baseUrl: "https://api.elevenlabs.io/v1",
      defaultVoiceId: process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID,
      defaultModelId: DEFAULT_MODEL_ID,
    };

    if (!this.config.apiKey) {
      logger.warn("TTS Service initialized without ElevenLabs API key");
    }
  }

  /**
   * Synthesize text to speech
   *
   * @param request - Synthesis parameters
   * @returns Audio buffer and metadata
   */
  async synthesize(request: SynthesisRequest): Promise<SynthesisResponse> {
    const { text, voiceId, modelId, stability, similarityBoost } = request;

    // Validate input
    if (!text || text.trim().length === 0) {
      throw new ValidationError("Text is required for synthesis", {
        text: text?.substring(0, 50),
      });
    }

    if (text.length > 5000) {
      throw new ValidationError(
        "Text exceeds maximum length of 5000 characters",
        {
          length: text.length,
        },
      );
    }

    const effectiveVoiceId = voiceId || this.config.defaultVoiceId;
    const effectiveModelId = modelId || this.config.defaultModelId;

    // Check cache for short messages
    const cacheKey = `${effectiveVoiceId}-${text}`;
    if (text.length < 100 && this.voiceCache.has(cacheKey)) {
      logger.debug("TTS cache hit", { textLength: text.length });
      return {
        audioBuffer: this.voiceCache.get(cacheKey)!,
        durationMs: this.estimateDuration(text),
        format: "mp3",
      };
    }

    try {
      logger.info("Synthesizing speech", {
        textLength: text.length,
        voiceId: effectiveVoiceId,
        modelId: effectiveModelId,
      });

      const response = await fetch(
        `${this.config.baseUrl}/text-to-speech/${effectiveVoiceId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "xi-api-key": this.config.apiKey,
          },
          body: JSON.stringify({
            text,
            model_id: effectiveModelId,
            voice_settings: {
              stability: stability ?? 0.5,
              similarity_boost: similarityBoost ?? 0.75,
            },
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error("ElevenLabs API error", {
          status: response.status,
          error: errorText,
        });
        throw new ServiceUnavailableError("ElevenLabs TTS", {
          status: response.status,
          error: errorText,
        });
      }

      const audioBuffer = Buffer.from(await response.arrayBuffer());
      const durationMs = this.estimateDuration(text);

      // Cache short messages
      if (text.length < 100) {
        this.voiceCache.set(cacheKey, audioBuffer);
        // Limit cache size
        if (this.voiceCache.size > 1000) {
          const firstKey = this.voiceCache.keys().next().value;
          this.voiceCache.delete(firstKey);
        }
      }

      logger.info("Speech synthesized successfully", {
        textLength: text.length,
        audioSize: audioBuffer.length,
        durationMs,
      });

      return {
        audioBuffer,
        durationMs,
        format: "mp3",
      };
    } catch (err) {
      logger.error("TTS synthesis failed", {
        error: err instanceof Error ? err.message : String(err),
        textLength: text.length,
      });
      throw err;
    }
  }

  /**
   * Stream audio to a Jam room
   *
   * @param jamRoomId - Jam room ID
   * @param audioBuffer - Audio data
   * @param messageId - Message ID for tracking
   */
  async streamToJam(
    jamRoomId: string,
    audioBuffer: Buffer,
    messageId: string,
  ): Promise<void> {
    try {
      logger.info("Streaming audio to Jam", {
        jamRoomId,
        messageId,
        audioSize: audioBuffer.length,
      });

      const jamService = getJamService();
      await jamService.streamAudio(jamRoomId, audioBuffer, messageId);

      logger.info("Audio streamed successfully", {
        jamRoomId,
        messageId,
      });
    } catch (err) {
      logger.error("Failed to stream audio to Jam", {
        jamRoomId,
        messageId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  /**
   * Synthesize and stream in one operation
   *
   * @param jamRoomId - Jam room ID
   * @param text - Text to synthesize
   * @param messageId - Message ID
   * @param voiceId - Optional voice ID
   */
  async synthesizeAndStream(
    jamRoomId: string,
    text: string,
    messageId: string,
    voiceId?: string,
  ): Promise<{ durationMs: number }> {
    const synthesis = await this.synthesize({
      text,
      voiceId,
    });

    await this.streamToJam(jamRoomId, synthesis.audioBuffer, messageId);

    return { durationMs: synthesis.durationMs };
  }

  /**
   * Estimate audio duration from text
   * Rough estimate: ~150 words per minute
   *
   * @param text - Text to estimate
   * @returns Estimated duration in milliseconds
   */
  private estimateDuration(text: string): number {
    const wordCount = text.split(/\s+/).length;
    const wordsPerMinute = 150;
    const durationMs = (wordCount / wordsPerMinute) * 60 * 1000;
    return Math.round(durationMs);
  }

  /**
   * Health check
   *
   * @returns true if service is healthy
   */
  async healthCheck(): Promise<boolean> {
    if (!this.config.apiKey) {
      return false;
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/voices`, {
        headers: {
          "xi-api-key": this.config.apiKey,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
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
