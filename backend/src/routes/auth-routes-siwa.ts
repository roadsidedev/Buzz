// @ts-nocheck
/**
 * Authentication Routes (SIWA + Privy)
 *
 * Endpoints:
 * POST   /auth/connect-wallet     - Register new agent with wallet
 * POST   /auth/siwa/nonce         - Request signing challenge
 * POST   /auth/siwa/verify        - Verify signed message, issue receipt
 * POST   /auth/logout             - Revoke receipt
 * GET    /auth/profile            - Get authenticated agent profile
 */

import { Router, Request, Response } from "express";
import type {
  ConnectWalletRequest,
  ConnectWalletResponse,
  SIWANonceRequest,
  SIWANonceResponse,
  SIWAVerifyRequest,
  SIWAVerifyResponse,
  ReceiptVerifyResponse,
  AgentProfile,
} from "../types/auth";
import { asyncHandler, authLimiter } from "../middleware/index.js";
import { siwaAuthService } from "../services/index.js";
import { logger } from "../utils/logger.js";
import {
  InvalidSignatureError,
  NonceExpiredError,
  NonceUsedError,
  AgentAlreadyExistsError,
  AgentNotFoundError,
  ValidationError,
} from "../types/auth.js";

const router = Router();

/**
 * POST /auth/connect-wallet
 *
 * Register new agent with Ethereum wallet address and ERC-8004 agent ID
 *
 * Request body:
 * {
 *   "walletAddress": "0x1234...",
 *   "agentId": 42,
 *   "name": "Agent Alice",
 *   "avatar": "https://..."
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "agent": { id, name, walletAddress, erc8004AgentId, verified, ... }
 * }
 */
router.post(
  "/connect-wallet",
  authLimiter,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { walletAddress, agentId, name, avatar } =
      req.body as ConnectWalletRequest;

    // Validate inputs
    try {
      if (!walletAddress || !walletAddress.startsWith("0x")) {
        throw new ValidationError("Invalid wallet address format");
      }

      if (!agentId || typeof agentId !== "number" || agentId <= 0) {
        throw new ValidationError("Invalid ERC-8004 agent ID");
      }

      if (!name || name.length < 1 || name.length > 255) {
        throw new ValidationError("Agent name required (1-255 chars)");
      }
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: {
          code: err.code || "VALIDATION_ERROR",
          message: err.message,
          statusCode: 400,
        },
      });
      return;
    }

    try {
      // Register agent (will check for duplicates)
      const agentUuid = await siwaAuthService.registerAgent(
        walletAddress,
        agentId,
        name,
        avatar
      );

      // Fetch full agent profile
      const agentProfile = await siwaAuthService.getAgentProfile(agentUuid);

      logger.info("Agent connected wallet", {
        agentId: agentUuid,
        walletAddress,
        erc8004AgentId: agentId,
      });

      const response: ConnectWalletResponse = {
        success: true,
        agent: agentProfile,
      };

      res.status(201).json(response);
    } catch (err: any) {
      if (err instanceof AgentAlreadyExistsError) {
        res.status(409).json({
          success: false,
          error: {
            code: err.code,
            message: err.message,
            statusCode: 409,
          },
        });
      } else {
        logger.error("Wallet connection failed", { error: err });
        res.status(500).json({
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to connect wallet",
            statusCode: 500,
          },
        });
      }
    }
  })
);

/**
 * POST /auth/siwa/nonce
 *
 * Request a nonce for signing challenge
 *
 * Request body:
 * {
 *   "walletAddress": "0x1234...",
 *   "agentId": 42
 * }
 *
 * Response:
 * {
 *   "nonce": "a1b2c3d4e5f6g7h8i9j0",
 *   "issuedAt": "2026-02-16T10:30:00Z",
 *   "expiresAt": "2026-02-16T10:40:00Z"
 * }
 */
router.post(
  "/siwa/nonce",
  authLimiter,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { walletAddress, agentId } = req.body as SIWANonceRequest;

    try {
      const response = await siwaAuthService.requestNonce({
        walletAddress,
        agentId,
      });

      const result: SIWANonceResponse = response;

      res.json({
        success: true,
        data: result,
      });
    } catch (err: any) {
      logger.warn("Nonce request failed", { error: err.message });

      res.status(400).json({
        success: false,
        error: {
          code: "NONCE_REQUEST_FAILED",
          message: err.message || "Failed to generate nonce",
          statusCode: 400,
        },
      });
    }
  })
);

/**
 * POST /auth/siwa/verify
 *
 * Verify signed SIWA message and issue receipt
 *
 * Request body:
 * {
 *   "message": "example.com wants you to sign...",
 *   "signature": "0x1234...",
 *   "walletAddress": "0x1234...",
 *   "agentId": 42
 * }
 *
 * Response:
 * {
 *   "receipt": "eyJhbGc...",
 *   "agent": { id, name, walletAddress, ... },
 *   "expiresAt": "2026-02-17T10:30:00Z"
 * }
 */
router.post(
  "/siwa/verify",
  authLimiter,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { message, signature, walletAddress, agentId } =
      req.body as SIWAVerifyRequest;

    try {
      // Validate inputs
      if (!message || !signature || !walletAddress || !agentId) {
        throw new ValidationError(
          "Missing message, signature, walletAddress, or agentId"
        );
      }

      // Verify signature and issue receipt
      const response = await siwaAuthService.verifySIWA({
        message,
        signature,
        walletAddress,
        agentId,
      });

      // Set receipt in secure HTTP-only cookie (optional, also in response body)
      res.cookie("siwa_receipt", response.receipt, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      });

      logger.info("SIWA verification successful", {
        agentId: response.agent.id,
        walletAddress,
      });

      const result: SIWAVerifyResponse = response;

      res.json({
        success: true,
        data: result,
      });
    } catch (err: any) {
      if (
        err instanceof InvalidSignatureError ||
        err instanceof NonceExpiredError ||
        err instanceof NonceUsedError
      ) {
        res.status(err.statusCode).json({
          success: false,
          error: {
            code: err.code,
            message: err.message,
            statusCode: err.statusCode,
          },
        });
      } else {
        logger.error("SIWA verification failed", { error: err.message });
        res.status(401).json({
          success: false,
          error: {
            code: "VERIFICATION_FAILED",
            message: err.message || "Signature verification failed",
            statusCode: 401,
          },
        });
      }
    }
  })
);

/**
 * GET /auth/profile
 *
 * Get authenticated agent profile (requires receipt in Authorization header)
 *
 * Header:
 * Authorization: Bearer <receipt>
 *
 * Response:
 * {
 *   "agent": { id, name, walletAddress, erc8004AgentId, verified, ... }
 * }
 */
router.get(
  "/profile",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      // Extract receipt from Authorization header or cookie
      const authHeader = req.headers.authorization;
      const receipt =
        authHeader?.startsWith("Bearer ")
          ? authHeader.slice(7)
          : (req.cookies.siwa_receipt as string | undefined);

      if (!receipt) {
        res.status(401).json({
          success: false,
          error: {
            code: "NO_RECEIPT",
            message: "No authorization receipt provided",
            statusCode: 401,
          },
        });
        return;
      }

      // Verify receipt
      const decodedReceipt = await siwaAuthService.verifyReceipt(receipt);

      // Fetch agent profile
      const agentProfile = await siwaAuthService.getAgentByWallet(
        decodedReceipt.walletAddress
      );

      if (!agentProfile) {
        throw new AgentNotFoundError("wallet address");
      }

      const result: ReceiptVerifyResponse = {
        valid: true,
        agent: agentProfile,
      };

      res.json({
        success: true,
        data: result,
      });
    } catch (err: any) {
      logger.error("Profile fetch failed", { error: err.message });

      res.status(401).json({
        success: false,
        error: {
          code: err.code || "PROFILE_FETCH_FAILED",
          message: err.message || "Failed to fetch profile",
          statusCode: 401,
        },
      });
    }
  })
);

/**
 * POST /auth/logout
 *
 * Revoke the current receipt (logout)
 *
 * Header:
 * Authorization: Bearer <receipt>
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "Logged out successfully"
 * }
 */
router.post(
  "/logout",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      // Extract receipt from Authorization header or cookie
      const authHeader = req.headers.authorization;
      const receipt =
        authHeader?.startsWith("Bearer ")
          ? authHeader.slice(7)
          : (req.cookies.siwa_receipt as string | undefined);

      if (receipt) {
        // Revoke receipt
        await siwaAuthService.revokeReceipt(receipt);
      }

      // Clear cookie
      res.clearCookie("siwa_receipt");

      logger.info("Agent logged out");

      res.json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (err: any) {
      logger.error("Logout failed", { error: err });
      res.status(500).json({
        success: false,
        error: {
          code: "LOGOUT_FAILED",
          message: "Failed to logout",
          statusCode: 500,
        },
      });
    }
  })
);
/**
 * POST /auth/dev-token
 *
 * DEV ONLY: Generate a valid JWT for testing without SIWA on-chain verification.
 * Requires DEV_AUTH_BYPASS=true environment variable.
 *
 * Request body:
 * {
 *   "walletAddress": "0x...",
 *   "agentId": 42
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "token": "eyJ...",
 *   "expiresIn": 3600,
 *   "agent": { ... }
 * }
 */
router.post(
  "/dev-token",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // Only available in dev mode
    if (process.env.DEV_AUTH_BYPASS !== "true") {
      res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Endpoint not available",
          statusCode: 404,
        },
      });
      return;
    }

    const { walletAddress, agentId } = req.body;

    if (!walletAddress) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "walletAddress is required",
          statusCode: 400,
        },
      });
      return;
    }

    try {
      // Look up agent by wallet address or erc_8004_agent_id
      const { Pool } = await import("pg");
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });

      let agentRow;
      if (agentId) {
        const result = await pool.query(
          `SELECT id, name, wallet_address, erc_8004_agent_id, erc_8004_verified, email, username, role
           FROM agent WHERE wallet_address = $1 AND erc_8004_agent_id = $2`,
          [walletAddress, agentId]
        );
        agentRow = result.rows[0];
      } else {
        const result = await pool.query(
          `SELECT id, name, wallet_address, erc_8004_agent_id, erc_8004_verified, email, username, role
           FROM agent WHERE wallet_address = $1`,
          [walletAddress]
        );
        agentRow = result.rows[0];
      }

      if (!agentRow) {
        res.status(404).json({
          success: false,
          error: {
            code: "AGENT_NOT_FOUND",
            message: "Agent not found. Register first via POST /agents/register",
            statusCode: 404,
          },
        });
        await pool.end();
        return;
      }

      // Generate JWT using the same secret/format as AuthService
      const jwt = await import("jsonwebtoken");
      const jwtSecret = process.env.JWT_SECRET;

      if (!jwtSecret) {
        throw new Error("JWT_SECRET not configured");
      }

      const now = Math.floor(Date.now() / 1000);
      const expiresIn = 3600; // 1 hour

      const payload = {
        sub: agentRow.id,
        agentId: agentRow.id,
        email: agentRow.email || `${agentRow.name.toLowerCase().replace(/\s+/g, '')}@dev.clawzz.ai`,
        username: agentRow.username || agentRow.name,
        role: agentRow.role || "agent",
        aud: "clawzz",
        iat: now,
        exp: now + expiresIn,
      };

      const token = jwt.default.sign(payload, jwtSecret, { algorithm: "HS256" });

      logger.info("DEV TOKEN issued", {
        agentId: agentRow.id,
        walletAddress,
        name: agentRow.name,
      });

      res.json({
        success: true,
        token,
        expiresIn,
        agent: {
          id: agentRow.id,
          name: agentRow.name,
          walletAddress: agentRow.wallet_address,
          erc8004AgentId: agentRow.erc_8004_agent_id,
          verified: agentRow.erc_8004_verified,
        },
      });

      await pool.end();
    } catch (err: any) {
      logger.error("Dev token generation failed", { error: err.message });
      res.status(500).json({
        success: false,
        error: {
          code: "DEV_TOKEN_FAILED",
          message: err.message || "Failed to generate dev token",
          statusCode: 500,
        },
      });
    }
  })
);

export default router;
