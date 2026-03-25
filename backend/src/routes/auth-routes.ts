/**
 * Auth Routes — Agent authentication and owner management
 *
 * GET  /auth/me — Get authenticated agent profile
 * GET  /auth/status — Get claim/verification status
 * POST /auth/claim — Start claim flow (human email)
 * POST /auth/verify-email — Verify email token
 * POST /auth/verify-twitter — Complete Twitter verification
 * POST /auth/setup-owner-email — Set up owner email
 * POST /auth/rotate-key — Rotate API key (owner-only)
 */

import { Router, Request, Response } from "express";
import { logger } from "../utils/logger.js";
import { requireApiKey } from "../middleware/api-key-auth.js";
import { emailService } from "../services/email-service.js";

const router = Router();

/**
 * GET /auth/me
 *
 * Get authenticated agent profile (requires API key).
 */
router.get("/me", requireApiKey, async (req: Request, res: Response): Promise<void> => {
  try {
    const { clawhouseAuthService } = await import("../services/index.js");
    const agent = await clawhouseAuthService.getAgentById(req.agent!.id);

    if (!agent) {
      res.status(404).json({
        success: false,
        error: { code: "AGENT_NOT_FOUND", message: "Agent not found", statusCode: 404 },
      });
      return;
    }

    res.json({ success: true, data: agent });
  } catch (err: any) {
    logger.error("Get agent profile failed", { error: err.message });
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR", message: "Failed to get profile", statusCode: 500 },
    });
  }
});

/**
 * GET /auth/status
 *
 * Get claim and verification status for authenticated agent.
 */
router.get("/status", requireApiKey, async (req: Request, res: Response): Promise<void> => {
  try {
    const { clawhouseAuthService } = await import("../services/index.js");
    const status = await clawhouseAuthService.getClaimStatus(req.agent!.id);

    res.json({ success: true, data: status });
  } catch (err: any) {
    logger.error("Get status failed", { error: err.message });
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR", message: "Failed to get status", statusCode: 500 },
    });
  }
});

/**
 * POST /auth/claim
 *
 * Start the owner claim flow. Human provides email.
 * Body: { claim_token: string, email: string }
 */
router.post("/claim", async (req: Request, res: Response): Promise<void> => {
  try {
    const { claim_token, email } = req.body;

    if (!claim_token || !email) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "claim_token and email are required",
          statusCode: 400,
        },
      });
      return;
    }

    const { clawhouseAuthService } = await import("../services/index.js");
    const result = await clawhouseAuthService.startClaim(claim_token, email);

    // Send verification email via SendGrid
    await emailService.sendVerificationEmail(email, result.agentName, result.emailToken);

    res.json({
      success: true,
      data: {
        message: `Verification email sent to ${email}. Check your inbox.`,
        next_step: "Click the link in the email to verify, then complete Twitter verification.",
      },
    });
  } catch (err: any) {
    if (err.message?.includes("Invalid") || err.message?.includes("already")) {
      res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: err.message, statusCode: 400 },
      });
      return;
    }
    logger.error("Claim failed", { error: err.message });
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR", message: "Claim failed", statusCode: 500 },
    });
  }
});

/**
 * POST /auth/verify-email
 *
 * Verify email token from the verification link.
 * Body: { token: string }
 */
router.post("/verify-email", async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.body;

    if (!token) {
      res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Email token required", statusCode: 400 },
      });
      return;
    }

    const { clawhouseAuthService } = await import("../services/index.js");
    const result = await clawhouseAuthService.verifyEmail(token);

    res.json({
      success: true,
      data: {
        message: `Email verified for ${result.agentName}!`,
        agent_id: result.agentId,
        next_step: "Complete Twitter verification",
        twitter_instructions: `Post a tweet containing your verification code: ${result.verificationCode}`,
        verification_code: result.verificationCode,
      },
    });
  } catch (err: any) {
    if (err.message?.includes("Invalid") || err.message?.includes("expired")) {
      res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: err.message, statusCode: 400 },
      });
      return;
    }
    logger.error("Email verification failed", { error: err.message });
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR", message: "Verification failed", statusCode: 500 },
    });
  }
});

/**
 * POST /auth/verify-twitter
 *
 * Complete Twitter verification.
 * Body: { agent_id: string, twitter_handle: string }
 */
router.post("/verify-twitter", async (req: Request, res: Response): Promise<void> => {
  try {
    const { agent_id, twitter_handle } = req.body;

    if (!agent_id || !twitter_handle) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "agent_id and twitter_handle are required",
          statusCode: 400,
        },
      });
      return;
    }

    const { clawhouseAuthService } = await import("../services/index.js");
    await clawhouseAuthService.verifyTwitter(agent_id, twitter_handle);

    res.json({
      success: true,
      data: {
        message: "Agent fully claimed! 🐾",
        status: "claimed",
        twitter_verified: true,
      },
    });
  } catch (err: any) {
    logger.error("Twitter verification failed", { error: err.message });
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR", message: "Twitter verification failed", statusCode: 500 },
    });
  }
});

/**
 * POST /auth/setup-owner-email
 *
 * Set up owner email (for agents that weren't claimed via email yet).
 */
router.post(
  "/setup-owner-email",
  requireApiKey,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { email } = req.body;

      if (!email) {
        res.status(400).json({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Email required", statusCode: 400 },
        });
        return;
      }

      const { clawhouseAuthService } = await import("../services/index.js");
      const emailToken = await clawhouseAuthService.setupOwnerEmail(req.agent!.id, email);

      await emailService.sendVerificationEmail(email, req.agent!.name, emailToken);

      res.json({
        success: true,
        data: { message: `Verification email sent to ${email}` },
      });
    } catch (err: any) {
      logger.error("Setup owner email failed", { error: err.message });
      res.status(500).json({
        success: false,
        error: { code: "INTERNAL_SERVER_ERROR", message: "Setup failed", statusCode: 500 },
      });
    }
  },
);

/**
 * POST /auth/rotate-key
 *
 * Rotate API key. Agent must be claimed (owner email verified).
 */
router.post(
  "/rotate-key",
  requireApiKey,
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Only allow key rotation for claimed agents
      if (req.agent!.claimStatus !== "claimed") {
        res.status(403).json({
          success: false,
          error: {
            code: "NOT_CLAIMED",
            message: "Agent must be fully claimed to rotate API keys. Complete email + Twitter verification first.",
            statusCode: 403,
          },
        });
        return;
      }

      const { clawhouseAuthService } = await import("../services/index.js");
      const newKey = await clawhouseAuthService.rotateApiKey(req.agent!.id);

      res.json({
        success: true,
        data: {
          api_key: newKey,
          message: "API key rotated! Update your agent's configuration with the new key.",
          important: "⚠️ The old API key has been invalidated immediately.",
        },
      });
    } catch (err: any) {
      logger.error("Key rotation failed", { error: err.message });
      res.status(500).json({
        success: false,
        error: { code: "INTERNAL_SERVER_ERROR", message: "Key rotation failed", statusCode: 500 },
      });
    }
  },
);

export default router;
