/**
 * SAID Protocol Verification Service
 *
 * Integration with SAID Protocol for Solana-based agent identity verification.
 * Agents can optionally link their Solana wallet to get a "SAID verified" badge.
 *
 * API docs: https://www.saidprotocol.com/docs/integrate
 */

import { logger } from "../utils/logger.js";

const SAID_API_BASE = process.env.SAID_API_URL || "https://api.saidprotocol.com";

export interface SAIDVerificationResult {
  verified: boolean;
  wallet: string;
  agentName?: string;
  reputationScore: number;
  registeredAt?: string;
  error?: string;
}

export class SAIDVerificationService {
  /**
   * Verify a Solana wallet via SAID Protocol.
   */
  async verifyWallet(solanaWallet: string): Promise<SAIDVerificationResult> {
    try {
      const response = await fetch(
        `${SAID_API_BASE}/api/verify/${solanaWallet}`,
        {
          headers: {
            Accept: "application/json",
            ...(process.env.SAID_API_KEY
              ? { Authorization: `Bearer ${process.env.SAID_API_KEY}` }
              : {}),
          },
        },
      );

      if (!response.ok) {
        logger.warn("SAID verification failed", {
          wallet: solanaWallet,
          status: response.status,
        });
        return {
          verified: false,
          wallet: solanaWallet,
          reputationScore: 0,
          error: `SAID API returned ${response.status}`,
        };
      }

      const data: any = await response.json();

      return {
        verified: data.verified || false,
        wallet: solanaWallet,
        agentName: data.agent_name || data.name,
        reputationScore: data.reputation_score || data.score || 0,
        registeredAt: data.registered_at,
      };
    } catch (err: any) {
      logger.error("SAID verification error", {
        wallet: solanaWallet,
        error: err.message,
      });
      return {
        verified: false,
        wallet: solanaWallet,
        reputationScore: 0,
        error: err.message,
      };
    }
  }

  /**
   * Get agent data from SAID Protocol.
   */
  async getAgentData(solanaWallet: string): Promise<SAIDVerificationResult> {
    try {
      const response = await fetch(
        `${SAID_API_BASE}/api/agents/${solanaWallet}`,
        {
          headers: {
            Accept: "application/json",
            ...(process.env.SAID_API_KEY
              ? { Authorization: `Bearer ${process.env.SAID_API_KEY}` }
              : {}),
          },
        },
      );

      if (!response.ok) {
        return {
          verified: false,
          wallet: solanaWallet,
          reputationScore: 0,
          error: `SAID API returned ${response.status}`,
        };
      }

      const data: any = await response.json();

      return {
        verified: data.registered || data.verified || false,
        wallet: solanaWallet,
        agentName: data.name || data.agent_name,
        reputationScore: data.reputation_score || data.score || 0,
        registeredAt: data.registered_at || data.created_at,
      };
    } catch (err: any) {
      logger.error("SAID agent data fetch error", {
        wallet: solanaWallet,
        error: err.message,
      });
      return {
        verified: false,
        wallet: solanaWallet,
        reputationScore: 0,
        error: err.message,
      };
    }
  }
}

export const saidVerificationService = new SAIDVerificationService();
