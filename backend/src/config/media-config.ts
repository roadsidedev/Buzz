/**
 * Media Services Configuration
 *
 * Configuration for Jam audio streaming and ElevenLabs TTS
 */

import { logger } from "../utils/logger.js";

/**
 * Jam configuration
 */
export const JAM_CONFIG = {
  apiUrl: process.env.JAM_URL || "http://localhost:3001",
  apiKey: process.env.JAM_API_KEY || "",
  webhookSecret: process.env.JAM_WEBHOOK_SECRET || "",
  enabled: process.env.ENABLE_AUDIO_STREAMING !== "false",
  healthCheckIntervalMs: parseInt(
    process.env.JAM_HEALTH_CHECK_INTERVAL_MS || "30000",
  ),
};

/**
 * TTS configuration
 */
export const TTS_CONFIG = {
  apiKey: process.env.ELEVENLABS_API_KEY || "",
  baseUrl: "https://api.elevenlabs.io/v1",
  defaultVoiceId: process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM",
  defaultModelId: process.env.ELEVENLABS_MODEL_ID || "eleven_turbo_v2_5",
  enabled: process.env.ENABLE_TTS !== "false",
  cacheEnabled: process.env.TTS_CACHE_ENABLED !== "false",
  maxCacheSize: parseInt(process.env.TTS_MAX_CACHE_SIZE || "1000"),
};

/**
 * Validate Jam configuration
 * Warns but doesn't fail if audio streaming is disabled
 */
export function validateJamConfig(): void {
  if (!JAM_CONFIG.enabled) {
    logger.warn("Jam audio streaming is disabled");
    return;
  }

  const warnings: string[] = [];

  if (!JAM_CONFIG.apiKey) {
    warnings.push("JAM_API_KEY is not set");
  }

  if (!JAM_CONFIG.webhookSecret) {
    warnings.push(
      "JAM_WEBHOOK_SECRET is not set (webhooks will not be verified)",
    );
  }

  if (warnings.length > 0) {
    logger.warn("Jam configuration warnings", { warnings });
  } else {
    logger.info("✅ Jam configuration validated", {
      apiUrl: JAM_CONFIG.apiUrl,
      enabled: JAM_CONFIG.enabled,
    });
  }
}

/**
 * Validate TTS configuration
 * Warns but doesn't fail if TTS is disabled
 */
export function validateTTSConfig(): void {
  if (!TTS_CONFIG.enabled) {
    logger.warn("TTS is disabled");
    return;
  }

  if (TTS_CONFIG.apiKey) {
    logger.info("ElevenLabs TTS configured", {
      defaultVoiceId: TTS_CONFIG.defaultVoiceId,
    });
  } else {
    logger.warn("No TTS API keys configured (set ELEVENLABS_API_KEY)");
  }
}

/**
 * Get media services health status
 * Reads env vars dynamically to reflect current runtime configuration
 */
export function getMediaServicesStatus(): {
  jam: { enabled: boolean; configured: boolean };
  tts: { enabled: boolean; configured: boolean; elevenlabs: boolean };
} {
  return {
    jam: {
      enabled: process.env.ENABLE_AUDIO_STREAMING !== "false",
      configured: !!(process.env.JAM_API_KEY && process.env.JAM_WEBHOOK_SECRET),
    },
    tts: {
      enabled: process.env.ENABLE_TTS !== "false",
      configured: !!process.env.ELEVENLABS_API_KEY,
      elevenlabs: !!process.env.ELEVENLABS_API_KEY,
    },
  };
}
