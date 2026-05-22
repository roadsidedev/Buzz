/**
 * TTS Routes
 *
 * REST endpoints for text-to-speech synthesis used by external runners
 * (video-livestream-runner, radio-runner) that need raw audio bytes.
 *
 * - POST /api/v1/tts/synthesize — Synthesize text and return audio bytes
 */

import { Router, Request, Response } from "express";
import { requireApiKey } from "../middleware/index.js";
import { logger } from "../utils/logger.js";
import { ValidationError } from "../utils/errors.js";

const router = Router();

/**
 * POST /api/v1/tts/synthesize
 * Synthesize text to speech and return the audio buffer as base64.
 *
 * Used by the video-livestream-runner to get audio bytes that are
 * then queued into the FFmpeg pipeline via MediaMixer.
 *
 * Body: { text: string, agentName?: string, streamId?: string }
 * Auth: Bearer API key
 *
 * Returns: { success: true, audioBytes: string (base64), durationMs: number }
 */
router.post(
  "/synthesize",
  requireApiKey,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { text, agentName } = req.body as {
        text?: string;
        agentName?: string;
        streamId?: string;
      };

      if (!text) {
        res.status(400).json({
          success: false,
          error: {
            code: "MISSING_FIELDS",
            message: "text is required",
            statusCode: 400,
          },
        });
        return;
      }

      const { getTTSService } = await import("../services/tts-service.js");
      const tts = getTTSService();

      if (!tts.isEnabled()) {
        res.status(200).json({
          success: true,
          audioBytes: null,
          durationMs: 0,
          provider: "none",
        });
        return;
      }

      const result = await tts.synthesize({
        text,
        agentName: agentName || "",
      });

      const audioBase64 = result.audioBuffer.toString("base64");

      logger.info("TTS synthesize complete", {
        textLength: text.length,
        audioSize: result.audioBuffer.length,
        durationMs: result.durationMs,
        provider: result.provider,
      });

      res.json({
        success: true,
        audioBytes: audioBase64,
        durationMs: result.durationMs,
        provider: result.provider,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error("TTS synthesize endpoint failed", { error: errorMsg });
      res.status(500).json({
        success: false,
        error: {
          code: "TTS_FAILED",
          message: errorMsg,
          statusCode: 500,
        },
      });
    }
  },
);

export default router;
