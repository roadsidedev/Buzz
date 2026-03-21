/**
 * 8004-Solana Verification Service
 *
 * Integration with the 8004-Solana standard by QuantuLabs — the Solana port of ERC-8004.
 * Provides on-chain agent identity and reputation via Metaplex Core NFTs and an
 * event-based indexer with cryptographic integrity (SEAL v1).
 *
 * On-chain programs:
 *   Devnet:  8oo4J9tBB3Hna1jRQ3rWvJjojqM5DYTDJo5cejUuJy3C
 *   Mainnet: 8oo4dC4JvBLwy5tGgiH3WwK4B9PWxL9Z4XjA2jzkQMbQ
 *
 * The indexer REST API aggregates on-chain events and exposes agent registration
 * and reputation data without requiring raw RPC calls.
 *
 * Docs: https://8004.qnt.sh
 * GitHub: https://github.com/QuantuLabs/8004-solana
 */

import { logger } from "../utils/logger.js";

const SOL8004_API_BASE =
  process.env.SOL8004_API_URL || "https://api.8004.qnt.sh";

export interface Sol8004VerificationResult {
  verified: boolean;
  wallet: string;
  /** Metaplex Core NFT asset ID (primary on-chain identifier) */
  agentAssetId?: string;
  agentName?: string;
  reputationScore: number;
  registeredAt?: string;
  error?: string;
}

export class Sol8004VerificationService {
  private headers(): Record<string, string> {
    return {
      Accept: "application/json",
      ...(process.env.SOL8004_API_KEY
        ? { Authorization: `Bearer ${process.env.SOL8004_API_KEY}` }
        : {}),
    };
  }

  /**
   * Verify a Solana agent via the 8004-Solana indexer.
   *
   * Looks up the agent by their Solana wallet address. The indexer resolves
   * the associated Metaplex Core asset ID and returns registration status plus
   * aggregated reputation score from on-chain feedback events.
   */
  async verifyAgent(solanaWallet: string): Promise<Sol8004VerificationResult> {
    try {
      const response = await fetch(
        `${SOL8004_API_BASE}/v1/agents/by-wallet/${solanaWallet}`,
        { headers: this.headers() },
      );

      if (response.status === 404) {
        // Wallet not registered on 8004-Solana
        return {
          verified: false,
          wallet: solanaWallet,
          reputationScore: 0,
          error: "Wallet not registered on 8004-Solana",
        };
      }

      if (!response.ok) {
        logger.warn("8004-Solana verification failed", {
          wallet: solanaWallet,
          status: response.status,
        });
        return {
          verified: false,
          wallet: solanaWallet,
          reputationScore: 0,
          error: `8004-Solana indexer returned ${response.status}`,
        };
      }

      const data: any = await response.json();

      // The indexer returns the Metaplex Core asset ID alongside agent metadata
      const assetId: string | undefined =
        data.asset_id || data.agentAssetId || data.agent_asset_id;

      let reputationScore: number =
        data.reputation_score ?? data.score ?? 0;

      // If a separate reputation endpoint exists, fetch it for accuracy
      if (assetId && reputationScore === 0) {
        reputationScore = await this.fetchReputation(assetId);
      }

      const verified =
        data.registered === true ||
        data.verified === true ||
        data.status === "active";

      return {
        verified,
        wallet: solanaWallet,
        agentAssetId: assetId,
        agentName: data.name || data.agent_name,
        reputationScore,
        registeredAt: data.registered_at || data.created_at,
      };
    } catch (err: any) {
      logger.error("8004-Solana verification error", {
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
   * Fetch aggregated reputation score from on-chain feedback events.
   * Returns 0 on failure (non-fatal).
   */
  private async fetchReputation(assetId: string): Promise<number> {
    try {
      const response = await fetch(
        `${SOL8004_API_BASE}/v1/agents/${assetId}/reputation`,
        { headers: this.headers() },
      );
      if (!response.ok) return 0;
      const data: any = await response.json();
      return data.average_score ?? data.reputation_score ?? data.score ?? 0;
    } catch {
      return 0;
    }
  }
}

export const sol8004VerificationService = new Sol8004VerificationService();
