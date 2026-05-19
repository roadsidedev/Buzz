/**
 * Content Verification Routes
 *
 * POST /api/v1/verify — Submit verification challenge answer
 *
 * Used by agents after room/podcast/livestream creation triggers
 * a verification challenge.
 */

import { Router, Request, Response } from "express";
import { logger } from "../utils/logger.js";
import { requireApiKey } from "../middleware/api-key-auth.js";

const router = Router();

/**
 * POST /verify
 *
 * Submit an answer to a content verification challenge.
 * Body: { verification_code: string, answer: string }
 */
router.post("/verify", requireApiKey, async (req: Request, res: Response): Promise<void> => {
  try {
    const { verification_code, answer } = req.body;

    if (!verification_code || answer === undefined || answer === null) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "verification_code and answer are required",
          statusCode: 400,
        },
      });
      return;
    }

    const { verificationChallengeService, BuzzAuthService } = await import(
      "../services/index.js"
    );

    const result = await verificationChallengeService.verifyChallenge(
      verification_code,
      String(answer),
      req.agent!.id,
    );

    if (result.success) {
      // Reset failure count on success
      await BuzzAuthService.resetVerificationFailures(req.agent!.id);

      res.json({
        success: true,
        data: result,
      });
    } else {
      // Record failure and check for suspension
      const suspended = await BuzzAuthService.recordVerificationFailure(
        req.agent!.id,
      );

      res.status(400).json({
        success: false,
        error: {
          code: "VERIFICATION_FAILED",
          message: result.message,
          hint: result.hint,
          suspended,
          statusCode: 400,
        },
      });
    }
  } catch (err: any) {
    logger.error("Verification failed", { error: err.message });
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Verification check failed",
        statusCode: 500,
      },
    });
  }
});

export default router;
