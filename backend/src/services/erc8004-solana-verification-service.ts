/**
 * ERC-8004 Solana Verification Service
 *
 * Integration with the ERC-8004 agent registry deployed on Solana.
 * Agents link their Metaplex Core asset pubkey (their on-chain agent NFT)
 * to receive a verified badge.
 *
 * Deployed program addresses:
 * - Mainnet: 8oo4dC4JvBLwy5tGgiH3WwK4B9PWxL9Z4XjA2jzkQMbQ
 * - Devnet:  8oo4J9tBB3Hna1jRQ3rWvJjojqM5DYTDJo5cejUuJy3C
 *
 * SDK: https://github.com/QuantuLabs/8004-solana-ts (npm: 8004-solana)
 */

import { logger } from "../utils/logger.js";
import { getERC8004SolanaConfig } from "../config/erc8004-solana.js";

/** Solana base58 pubkey — 32-44 base58 characters */
const SOLANA_PUBKEY_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export interface ERC8004SolanaVerificationResult {
  verified: boolean;
  assetPubkey: string;
  agentName?: string;
  metadataUri?: string;
  reputationScore: number;
  error?: string;
}

export class ERC8004SolanaVerificationService {
  private sdk: any = null;

  private async getSDK(): Promise<any> {
    if (!this.sdk) {
      try {
        // Dynamic import keeps the heavy Solana SDK out of the startup path
        const { SolanaSDK } = await import("8004-solana");
        const config = getERC8004SolanaConfig();

        this.sdk = new SolanaSDK({
          cluster: config.cluster,
          ...(config.indexerGraphqlUrl
            ? { indexerGraphqlUrl: config.indexerGraphqlUrl }
            : {}),
        });

        logger.info("ERC-8004 Solana SDK initialized", {
          cluster: config.cluster,
          hasCustomIndexer: !!config.indexerGraphqlUrl,
        });
      } catch (err: any) {
        logger.error("Failed to initialize ERC-8004 Solana SDK", {
          error: err.message,
        });
        throw err;
      }
    }
    return this.sdk;
  }

  /**
   * Verify an agent by their Metaplex Core asset pubkey.
   *
   * Calls sdk.loadAgent(assetPubkey) — if the agent exists in the ERC-8004
   * registry the call succeeds and we mark them as verified.
   * Reputation is fetched via sdk.getSummary() and is non-fatal if unavailable.
   */
  async verifyAgent(
    assetPubkey: string,
  ): Promise<ERC8004SolanaVerificationResult> {
    if (!SOLANA_PUBKEY_RE.test(assetPubkey)) {
      return {
        verified: false,
        assetPubkey,
        reputationScore: 0,
        error: "Invalid Solana pubkey format",
      };
    }

    try {
      const sdk = await this.getSDK();
      const agent = await sdk.loadAgent(assetPubkey);

      let reputationScore = 0;
      try {
        const summary = await sdk.getSummary(assetPubkey);
        reputationScore = Number(summary?.averageScore ?? 0);
      } catch {
        // Reputation is optional — non-fatal
      }

      return {
        verified: true,
        assetPubkey,
        agentName: agent?.name ?? agent?.metadata?.name,
        metadataUri: agent?.uri,
        reputationScore,
      };
    } catch (err: any) {
      logger.warn("ERC-8004 Solana agent lookup failed", {
        assetPubkey,
        error: err.message,
      });
      return {
        verified: false,
        assetPubkey,
        reputationScore: 0,
        error: err.message,
      };
    }
  }

  /**
   * Get agent data from the ERC-8004 Solana registry.
   * Alias for verifyAgent — returns full result including metadata.
   */
  async getAgentData(
    assetPubkey: string,
  ): Promise<ERC8004SolanaVerificationResult> {
    return this.verifyAgent(assetPubkey);
  }
}

export const erc8004SolanaVerificationService =
  new ERC8004SolanaVerificationService();
