/**
 * Badge Routes — Multi-chain verification badge management
 *
 * POST /agents/me/verify/erc8004         — Link ERC-8004 badge (Base/Ethereum)
 * POST /agents/me/verify/erc8004-solana  — Link ERC-8004 Solana registry badge
 * GET  /agents/:id/badges                — Get agent badges (public)
 */

import { Router, Request, Response } from "express";
import { logger } from "../utils/logger.js";
import { requireApiKey } from "../middleware/api-key-auth.js";
import { erc8004SolanaVerificationService } from "../services/erc8004-solana-verification-service.js";
import { db } from "../config/database.js";
import { v4 as uuidv4 } from "uuid";

const router = Router();

/**
 * POST /agents/me/verify/erc8004
 *
 * Link ERC-8004 identity for a verified agent badge.
 * Body: { wallet_address: string, agent_id_onchain: number }
 */
router.post(
  "/agents/me/verify/erc8004",
  requireApiKey,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { wallet_address, agent_id_onchain } = req.body;

      if (!wallet_address || !agent_id_onchain) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "wallet_address and agent_id_onchain are required",
            statusCode: 400,
          },
        });
        return;
      }

      // Validate Ethereum address format
      if (!/^0x[a-fA-F0-9]{40}$/.test(wallet_address)) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid Ethereum address format",
            statusCode: 400,
          },
        });
        return;
      }

      // Check for existing badge
      const existing = await db.query(
        `SELECT id FROM verification_badge 
         WHERE agent_id = $1 AND provider = 'erc8004'`,
        [req.agent!.id],
      );

      if (existing.rows.length > 0) {
        // Update existing
        await db.query(
          `UPDATE verification_badge SET
            provider_wallet = $1,
            provider_agent_id = $2,
            verified = FALSE,
            updated_at = CURRENT_TIMESTAMP
           WHERE agent_id = $3 AND provider = 'erc8004'`,
          [wallet_address, String(agent_id_onchain), req.agent!.id],
        );
      } else {
        // Create new
        await db.query(
          `INSERT INTO verification_badge (id, agent_id, provider, provider_wallet, provider_agent_id, verified, created_at, updated_at)
           VALUES ($1, $2, 'erc8004', $3, $4, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [uuidv4(), req.agent!.id, wallet_address, String(agent_id_onchain)],
        );
      }

      // Attempt on-chain verification
      try {
        const { getERC8004Service } = await import(
          "../services/erc8004-verification-service.js"
        );
        const erc8004Service = getERC8004Service();
        const verificationResult = await erc8004Service.verifyAgentOwnership({
          agentId: req.agent!.id,
          walletAddress: wallet_address,
          proof: "",
          signature: "",
        });

        if (verificationResult.verified) {
          await db.query(
            `UPDATE verification_badge SET
              verified = TRUE,
              reputation_score = $1,
              verified_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
             WHERE agent_id = $2 AND provider = 'erc8004'`,
            [0, req.agent!.id],
          );
        }

        res.json({
          success: true,
          data: {
            provider: "erc8004",
            wallet: wallet_address,
            verified: verificationResult.verified,
            message: verificationResult.verified
              ? "ERC-8004 identity verified! Badge awarded. 🏆"
              : "ERC-8004 badge linked but verification pending. On-chain check required.",
          },
        });
      } catch (verifyErr: any) {
        logger.warn("ERC-8004 on-chain verification skipped", {
          error: verifyErr.message,
        });

        res.json({
          success: true,
          data: {
            provider: "erc8004",
            wallet: wallet_address,
            verified: false,
            message:
              "ERC-8004 badge linked. On-chain verification will be completed when the registry is available.",
          },
        });
      }
    } catch (err: any) {
      logger.error("ERC-8004 badge linking failed", { error: err.message });
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Badge linking failed",
          statusCode: 500,
        },
      });
    }
  },
);

/**
 * POST /agents/me/verify/erc8004-solana
 *
 * Link ERC-8004 Solana registry identity for a verification badge.
 * Body: { asset_pubkey: string }  — Metaplex Core asset pubkey from the 8004 registry
 *
 * The asset_pubkey is the on-chain NFT pubkey that represents the agent in the
 * ERC-8004 Solana registry (not the agent's wallet address).
 */
router.post(
  "/agents/me/verify/erc8004-solana",
  requireApiKey,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { asset_pubkey } = req.body;

      if (!asset_pubkey) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "asset_pubkey is required",
            statusCode: 400,
          },
        });
        return;
      }

      // Call ERC-8004 Solana registry
      const result =
        await erc8004SolanaVerificationService.verifyAgent(asset_pubkey);

      // Check for existing badge
      const existing = await db.query(
        `SELECT id FROM verification_badge
         WHERE agent_id = $1 AND provider = 'erc8004_solana'`,
        [req.agent!.id],
      );

      if (existing.rows.length > 0) {
        await db.query(
          `UPDATE verification_badge SET
            provider_wallet = $1,
            verified = $2,
            reputation_score = $3,
            verified_at = $4,
            last_checked_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
           WHERE agent_id = $5 AND provider = 'erc8004_solana'`,
          [
            asset_pubkey,
            result.verified,
            result.reputationScore,
            result.verified ? new Date() : null,
            req.agent!.id,
          ],
        );
      } else {
        await db.query(
          `INSERT INTO verification_badge (id, agent_id, provider, provider_wallet, verified, reputation_score, verified_at, last_checked_at, created_at, updated_at)
           VALUES ($1, $2, 'erc8004_solana', $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [
            uuidv4(),
            req.agent!.id,
            asset_pubkey,
            result.verified,
            result.reputationScore,
            result.verified ? new Date() : null,
          ],
        );
      }

      res.json({
        success: true,
        data: {
          provider: "erc8004_solana",
          asset_pubkey,
          verified: result.verified,
          reputation_score: result.reputationScore,
          message: result.verified
            ? "ERC-8004 Solana identity verified! Badge awarded."
            : result.error
              ? `Verification failed: ${result.error}`
              : "ERC-8004 Solana badge linked but agent not found in the registry.",
        },
      });
    } catch (err: any) {
      logger.error("ERC-8004 Solana badge linking failed", {
        error: err.message,
      });
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Badge linking failed",
          statusCode: 500,
        },
      });
    }
  },
);

export default router;
