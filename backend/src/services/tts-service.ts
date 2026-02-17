/**
 * TTS Service
 * 
 * Text-to-speech integration with ElevenLabs for orchestrator-selected messages
 * Handles:
 * - Message text synthesis
 * - Voice selection based on agent preferences
 * - Audio file storage and retrieval
 * - Duration calculation
 * 
 * Part of Day 7: Orchestrator Integration
 */

import { logger } from "../utils/logger.js";
import { ValidationError } from "../utils/errors.js";

// ===================================================================
// Configuration
// ===================================================================

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || "";
const ELEVENLABS_BASE_URL = process.env.ELEVENLABS_BASE_URL || "https://api.elevenlabs.io/v1";
const DEFAULT_VOICE_ID = process.env.DEFAULT_ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";

// ===================================================================
// Type Definitions
// ===================================================================

export interface TTSSynthesizeRequest {
  messageId: string;
  text: string;
  agentId?: string;
  voiceId?: string;
  stability?: number; // 0-1, lower = more expressive
  similarityBoost?: number; // 0-1
  style?: number; // 0-1
  useSpeakerBoost?: boolean;
}

export interface TTSSynthesizeResponse {
  messageId: string;
  audioUrl: string;
  audioBuffer: Buffer;
  duration: number; // seconds
  voiceId: string;
  wordCount: number;
  characters: number;
}

export interface AgentVoiceProfile {
  agentId: string;
  voiceId: string;
  voiceName: string;
  settings: {
    stability: number;
    similarityBoost: number;
    style: number;
    useSpeakerBoost: boolean;
  };
}

// ===================================================================
// TTS Service
// ===================================================================

export class TTSService {
  private agentVoices = new Map<string, AgentVoiceProfile>();

  /**
   * Synthesize text to audio using ElevenLabs
   *
   * @param request - TTS request
   * @returns Audio URL and metadata
   */
  async synthesize(request: TTSSynthesizeRequest): Promise<TTSSynthesizeResponse> {
    if (!request.text || request.text.trim().length === 0) {
      throw new ValidationError("Text cannot be empty", {
        field: "text",
        code: "EMPTY_TEXT",
      });
    }

    if (!ELEVENLABS_API_KEY) {
      logger.warn("ElevenLabs API key not configured, using mock TTS");
      return this._mockTTS(request);
    }

    try {
      // Get voice configuration
      const voiceConfig = await this._getVoiceConfiguration(request);

      logger.info("Synthesizing message to audio", {
        messageId: request.messageId,
        textLength: request.text.length,
        voiceId: voiceConfig.voiceId,
      });

      // Call ElevenLabs API
      const audioBuffer = await this._callElevenLabsAPI(
        request.text,
        voiceConfig.voiceId,
        voiceConfig.settings,
      );

      // Calculate duration (rough estimate: ~150 words per minute)
      const wordCount = request.text.split(/\s+/).length;
      const estimatedDuration = (wordCount / 150) * 60;

      // TODO: Upload to S3 and get public URL
      const audioUrl = `https://storage.clawzz.com/audio/${request.messageId}.mp3`;

      logger.info("TTS synthesis completed", {
        messageId: request.messageId,
        duration: estimatedDuration,
        wordCount,
        voiceId: voiceConfig.voiceId,
      });

      return {
        messageId: request.messageId,
        audioUrl,
        audioBuffer,
        duration: estimatedDuration,
        voiceId: voiceConfig.voiceId,
        wordCount,
        characters: request.text.length,
      };
    } catch (err) {
      logger.error("TTS synthesis failed", {
        messageId: request.messageId,
        error: err instanceof Error ? err.message : String(err),
      });

      // Fallback to mock TTS
      return this._mockTTS(request);
    }
  }

  /**
   * Register agent voice profile
   *
   * @param profile - Voice configuration for agent
   */
  setAgentVoice(profile: AgentVoiceProfile): void {
    this.agentVoices.set(profile.agentId, profile);
    logger.info("Agent voice profile registered", {
      agentId: profile.agentId,
      voiceId: profile.voiceId,
    });
  }

  /**
   * Get agent voice configuration
   *
   * @param agentId - Agent ID
   * @returns Voice profile or default
   */
  getAgentVoice(agentId: string): AgentVoiceProfile | null {
    return this.agentVoices.get(agentId) || null;
  }

  /**
   * Validate voice ID with ElevenLabs
   *
   * @param voiceId - Voice ID to validate
   * @returns true if voice exists
   */
  async validateVoice(voiceId: string): Promise<boolean> {
    if (!ELEVENLABS_API_KEY) {
      return true; // Mock mode
    }

    try {
      const response = await fetch(`${ELEVENLABS_BASE_URL}/voices`, {
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
        },
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      const voices = data.voices || [];
      
      return voices.some((v: { voice_id: string }) => v.voice_id === voiceId);
    } catch (err) {
      logger.warn("Voice validation failed", {
        voiceId,
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }

  /**
   * Get available voices from ElevenLabs
   *
   * @returns Array of voice options
   */
  async getVoices(): Promise<Array<{ voice_id: string; name: string }>> {
    if (!ELEVENLABS_API_KEY) {
      return [
        { voice_id: DEFAULT_VOICE_ID, name: "Rachel (Default)" },
      ];
    }

    try {
      const response = await fetch(`${ELEVENLABS_BASE_URL}/voices`, {
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
        },
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status}`);
      }

      const data = await response.json();
      return (data.voices || []).map((v: { voice_id: string; name: string }) => ({
        voice_id: v.voice_id,
        name: v.name,
      }));
    } catch (err) {
      logger.warn("Failed to fetch voices", {
        error: err instanceof Error ? err.message : String(err),
      });
      return [{ voice_id: DEFAULT_VOICE_ID, name: "Rachel (Default)" }];
    }
  }

  /**
   * Get voice configuration for request
   */
  private async _getVoiceConfiguration(request: TTSSynthesizeRequest) {
    const agentVoice = request.agentId ? this.agentVoices.get(request.agentId) : null;
    const voiceId = request.voiceId || agentVoice?.voiceId || DEFAULT_VOICE_ID;
    
    const settings = {
      stability: request.stability ?? agentVoice?.settings.stability ?? 0.5,
      similarityBoost: request.similarityBoost ?? agentVoice?.settings.similarityBoost ?? 0.8,
      style: request.style ?? agentVoice?.settings.style ?? 0.5,
      useSpeakerBoost: request.useSpeakerBoost ?? agentVoice?.settings.useSpeakerBoost ?? true,
    };

    return { voiceId, settings };
  }

  /**
   * Call ElevenLabs TTS API
   */
  private async _callElevenLabsAPI(
    text: string,
    voiceId: string,
    settings: {
      stability: number;
      similarityBoost: number;
      style: number;
      useSpeakerBoost: boolean;
    },
  ): Promise<Buffer> {
    const response = await fetch(
      `${ELEVENLABS_BASE_URL}/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "Accept": "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_monolingual_v1",
          voice_settings: settings,
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs TTS failed: ${response.status} - ${errorText}`);
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    return audioBuffer;
  }

  /**
   * Mock TTS for development/testing
   */
  private _mockTTS(request: TTSSynthesizeRequest): TTSSynthesizeResponse {
    const wordCount = request.text.split(/\s+/).length;
    const estimatedDuration = (wordCount / 150) * 60;

    logger.warn("Using mock TTS (no ElevenLabs API key)", {
      messageId: request.messageId,
      textLength: request.text.length,
    });

    return {
      messageId: request.messageId,
      audioUrl: `https://mock-audio.clawzz.com/${request.messageId}.mp3`,
      audioBuffer: Buffer.alloc(0), // Empty buffer in mock mode
      duration: estimatedDuration,
      voiceId: "mock-voice",
      wordCount,
      characters: request.text.length,
    };
  }
}

/**
 * Singleton instance
 */
export const ttsService = new TTSService();