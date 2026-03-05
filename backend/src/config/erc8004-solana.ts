/**
 * ERC-8004 Solana Configuration
 *
 * Agent identity registry on Solana via the 8004 protocol.
 *
 * Deployed program addresses:
 * - Mainnet: 8oo4dC4JvBLwy5tGgiH3WwK4B9PWxL9Z4XjA2jzkQMbQ
 * - Devnet:  8oo4J9tBB3Hna1jRQ3rWvJjojqM5DYTDJo5cejUuJy3C
 *
 * SDK: https://github.com/QuantuLabs/8004-solana-ts (npm: 8004-solana)
 */

export type SolanaCluster = "mainnet-beta" | "devnet";

export interface ERC8004SolanaConfig {
  cluster: SolanaCluster;
  indexerGraphqlUrl?: string;
}

/**
 * Load ERC-8004 Solana configuration from environment variables.
 *
 * Environment variables:
 * - ERC8004_SOLANA_CLUSTER   — "mainnet-beta" or "devnet" (default: devnet in dev, mainnet-beta in production)
 * - ERC8004_SOLANA_INDEXER_URL — optional custom indexer GraphQL endpoint
 */
export function getERC8004SolanaConfig(): ERC8004SolanaConfig {
  const clusterEnv = process.env.ERC8004_SOLANA_CLUSTER;
  const cluster: SolanaCluster =
    clusterEnv === "mainnet-beta" || clusterEnv === "devnet"
      ? clusterEnv
      : process.env.NODE_ENV === "production"
        ? "mainnet-beta"
        : "devnet";

  const indexerGraphqlUrl = process.env.ERC8004_SOLANA_INDEXER_URL;

  return {
    cluster,
    ...(indexerGraphqlUrl ? { indexerGraphqlUrl } : {}),
  };
}
