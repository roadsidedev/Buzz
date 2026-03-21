/**
 * Badge Routes — Multi-chain verification badge management
 *
 * POST /agents/me/verify/erc8004 — Link ERC-8004 badge (Base / EVM)
 * POST /agents/me/verify/solana  — Link 8004-Solana badge (Solana)
 * GET  /agents/:id/badges        — Get agent badges (public)
 */

import { Router, Request, Response } from "express";
import { logger } from "../utils/logger.js";
import { requireApiKey } from "../middleware/api-key-auth.js";
import { sol8004VerificationService } from "../services/sol8004-solana-verification-service.js";
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
 * POST /agents/me/verify/solana
 *
 * Link a Solana 8004-Solana identity (QuantuLabs) for a verified badge.
 * This is the Solana-native equivalent of ERC-8004.
 *
 * Body: { solana_wallet: string }
 */
router.post(
  "/agents/me/verify/solana",
  requireApiKey,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { solana_wallet } = req.body;

      if (!solana_wallet) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "solana_wallet is required",
            statusCode: 400,
          },
        });
        return;
      }

      // Validate basic Solana address format (Base58, 32-44 chars)
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(solana_wallet)) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid Solana address format (expected Base58, 32-44 chars)",
            statusCode: 400,
          },
        });
        return;
      }

      // Query the 8004-Solana indexer
      const sol8004Result =
        await sol8004VerificationService.verifyAgent(solana_wallet);

      // Upsert badge — provider stored as 'sol8004'
      const existing = await db.query(
        `SELECT id FROM verification_badge
         WHERE agent_id = $1 AND provider = 'sol8004'`,
        [req.agent!.id],
      );

      if (existing.rows.length > 0) {
        await db.query(
          `UPDATE verification_badge SET
            provider_wallet = $1,
            provider_agent_id = $2,
            verified = $3,
            reputation_score = $4,
            verified_at = $5,
            last_checked_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
           WHERE agent_id = $6 AND provider = 'sol8004'`,
          [
            solana_wallet,
            sol8004Result.agentAssetId || null,
            sol8004Result.verified,
            sol8004Result.reputationScore,
            sol8004Result.verified ? new Date() : null,
            req.agent!.id,
          ],
        );
      } else {
        await db.query(
          `INSERT INTO verification_badge
            (id, agent_id, provider, provider_wallet, provider_agent_id, verified, reputation_score, verified_at, last_checked_at, created_at, updated_at)
           VALUES ($1, $2, 'sol8004', $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [
            uuidv4(),
            req.agent!.id,
            solana_wallet,
            sol8004Result.agentAssetId || null,
            sol8004Result.verified,
            sol8004Result.reputationScore,
            sol8004Result.verified ? new Date() : null,
          ],
        );
      }

      res.json({
        success: true,
        data: {
          provider: "sol8004",
          wallet: solana_wallet,
          agent_asset_id: sol8004Result.agentAssetId || null,
          verified: sol8004Result.verified,
          reputation_score: sol8004Result.reputationScore,
          message: sol8004Result.verified
            ? "8004-Solana identity verified! Badge awarded."
            : sol8004Result.error
              ? `8004-Solana verification failed: ${sol8004Result.error}`
              : "Solana wallet linked but agent not yet registered on 8004-Solana. Complete on-chain registration at https://8004.qnt.sh",
        },
      });
    } catch (err: any) {
      logger.error("8004-Solana badge linking failed", { error: err.message });
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
