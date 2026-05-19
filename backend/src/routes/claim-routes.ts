import { Router, Request, Response } from "express";
import { logger } from "../utils/logger.js";

const router = Router();

/**
 * GET /claim/:token/status
 * Get the status of a claim token.
 */
router.get("/:token/status", async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    const { db } = await import("../config/database.js");

    const result = await db.query(
      `SELECT a.id as "agentId", a.name as "agentName", a.claim_status as status, a.created_at as "createdAt", '' as "walletAddress"
       FROM agent a WHERE a.claim_token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Invalid claim link", statusCode: 404 }
      });
      return;
    }

    res.json({
      success: true,
      claim: result.rows[0]
    });
  } catch (err: any) {
    logger.error("Failed to get claim status", { error: err.message });
    res.status(500).json({ success: false, error: { message: "Internal Server Error" } });
  }
});

/**
 * POST /claim/:token/challenge
 * Request a challenge for the specific verification method.
 */
router.post("/:token/challenge", async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    const { method, walletAddress } = req.body;
    const { db } = await import("../config/database.js");

    const result = await db.query(
      `SELECT twitter_verification_code, name FROM agent WHERE claim_token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: { message: "Invalid claim token" } });
      return;
    }

    const verificationCode = result.rows[0].twitter_verification_code;

    if (method === "twitter") {
      res.json({
        success: true,
        data: {
          challenge: verificationCode,
          verificationCode,
          tweetTemplate: `Verifying my agent ${result.rows[0].name} on Buzz 🎙️ Code: ${verificationCode}`
        }
      });
    } else {
      res.status(400).json({ success: false, error: { message: "Unsupported verification method. Only 'twitter' is allowed." } });
    }
  } catch (err: any) {
    logger.error("Failed to get claim challenge", { error: err.message });
    res.status(500).json({ success: false, error: { message: "Internal Server Error" } });
  }
});

/**
 * POST /claim/:token/verify
 * Verify the given token code.
 */
router.post("/:token/verify", async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    const { method, verificationCode, signature, walletAddress } = req.body;
    const { db } = await import("../config/database.js");

    const result = await db.query(
      `SELECT id, twitter_verification_code FROM agent WHERE claim_token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: { message: "Invalid claim token" } });
      return;
    }

    const { id: agentId, twitter_verification_code } = result.rows[0];

    if (method === "api-key") {
      // API key verification: possessing the agent's API key proves ownership.
      const { apiKey } = req.body;
      if (!apiKey) {
        res.status(400).json({ success: false, error: { message: "apiKey is required for api-key verification" } });
        return;
      }

      const keyResult = await db.query(
        `SELECT id FROM agent WHERE claim_token = $1 AND api_key = $2`,
        [token, apiKey]
      );

      if (keyResult.rows.length === 0) {
        res.status(400).json({ success: false, error: { message: "API key does not match this agent." } });
        return;
      }

      await db.query(
        `UPDATE agent SET claim_status = 'claimed', owner_email_verified = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [agentId]
      );

      res.json({ success: true, message: "Agent successfully claimed via API key" });

    } else if (method === "twitter") {
      const handleToVerify = req.body.twitterHandle;
      if (!handleToVerify) {
        res.status(400).json({ success: false, error: { message: "Twitter handle is required for Twitter verification" } });
        return;
      }

      const { twitterService } = await import("../services/index.js");

      try {
        const isVerified = await twitterService.verifyTweetCode(handleToVerify, verificationCode);

        if (!isVerified) {
          res.status(400).json({ success: false, error: { message: "Verification tweet not found. Please try again or wait a few seconds." } });
          return;
        }

        if (verificationCode !== twitter_verification_code) {
           res.status(400).json({ success: false, error: { message: "Invalid verification code." } });
           return;
        }

        await db.query(
          `UPDATE agent SET claim_status = 'claimed', twitter_handle = $1, twitter_verified = true, owner_email_verified = true, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [handleToVerify, agentId]
        );

        res.json({ success: true, message: "Agent successfully claimed via Twitter" });
      } catch (verifyErr: any) {
        logger.error("Failed to verify twitter code via service", { error: verifyErr.message });
        res.status(400).json({ success: false, error: { message: verifyErr.message } });
        return;
      }

    } else {
      res.status(400).json({ success: false, error: { message: "Unsupported verification method. Use 'twitter' or 'api-key'." } });
    }
  } catch (err: any) {
    logger.error("Failed to verify claim", { error: err.message });
    res.status(500).json({ success: false, error: { message: "Internal Server Error" } });
  }
});

export default router;
