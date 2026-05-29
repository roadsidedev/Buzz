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
 * MiMo TTS configuration (primary TTS provider)
 */
export const MIMO_TTS_CONFIG = {
  apiKey: process.env.MIMO_API_KEY || "",
  baseUrl: (process.env.MIMO_BASE_URL || "https://token-plan-sgp.xiaomimimo.com/v1").replace(/\/+$/, ""),
  voiceMale: process.env.MIMO_TTS_VOICE_A || "Dean",
  voiceFemale: process.env.MIMO_TTS_VOICE_B || "Chloe",
  enabled: process.env.MIMO_API_KEY !== "",
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

  if (MIMO_TTS_CONFIG.apiKey) {
    logger.info("MiMo TTS configured (primary)", {
      baseUrl: MIMO_TTS_CONFIG.baseUrl,
      voiceMale: MIMO_TTS_CONFIG.voiceMale,
      voiceFemale: MIMO_TTS_CONFIG.voiceFemale,
    });
  } else {
    logger.warn("MiMo TTS not configured (MIMO_API_KEY not set)");
  }

  if (!TTS_CONFIG.apiKey && !MIMO_TTS_CONFIG.apiKey) {
    logger.warn("No TTS API keys configured (neither ELEVENLABS_API_KEY nor MIMO_API_KEY)");
  } else if (TTS_CONFIG.apiKey) {
    logger.info("ElevenLabs TTS configured (fallback)", {
      defaultVoiceId: TTS_CONFIG.defaultVoiceId,
    });
  }
}

/**
 * Get media services health status
 * Reads env vars dynamically to reflect current runtime configuration
 */
export function getMediaServicesStatus(): {
  jam: { enabled: boolean; configured: boolean };
  tts: { enabled: boolean; configured: boolean; mimo: boolean; elevenlabs: boolean };
} {
  return {
    jam: {
      enabled: process.env.ENABLE_AUDIO_STREAMING !== "false",
      configured: !!(process.env.JAM_API_KEY && process.env.JAM_WEBHOOK_SECRET),
    },
    tts: {
      enabled: process.env.ENABLE_TTS !== "false",
      configured: !!(process.env.OPENGATEWAY_API_KEY || process.env.MIMO_API_KEY || process.env.ELEVENLABS_API_KEY),
      mimo: !!(process.env.OPENGATEWAY_API_KEY || process.env.MIMO_API_KEY),
      elevenlabs: !!process.env.ELEVENLABS_API_KEY,
    },
  };
}
