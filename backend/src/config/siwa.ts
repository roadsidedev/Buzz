/**
 * SIWA Configuration
 *
 * Uses @buildersgarden/siwa SDK with environment-based configuration
 * All values can be configured via environment variables for easy switching
 * between testnet/mainnet or different deployments
 */

import { createClientResolver } from "@buildersgarden/siwa/client-resolver";
import { createRedisSIWANonceStore } from "@buildersgarden/siwa/nonce-store";
import { createClient, http } from "viem";
import { baseSepolia, base } from "viem/chains";
import { getAddress } from "viem/utils";

// =============================================================================
// Environment Configuration - All switchable via env vars
// =============================================================================

/**
 * SIWA HMAC Secret for receipt signing
 * Required for production - must be at least 32 characters
 * Can be set via: SIWA_SECRET or SIWA_HMAC_SECRET (backward compatibility)
 */
export const SIWA_SECRET =
  process.env.SIWA_SECRET ||
  process.env.SIWA_HMAC_SECRET ||
  "dev-secret-change-in-production-min-32-chars";

/**
 * ERC-8004 Identity Registry Address
 * Format: 0x... (Ethereum address format)
 *
 * Testnet (Base Sepolia): 0x8004A818BFB912233c491871b3d84c89A494BD9e
 * Mainnet (Base): 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
 */
export const ERC8004_REGISTRY_ADDRESS =
  process.env.ERC8004_REGISTRY_ADDRESS ||
  "0x8004A818BFB912233c491871b3d84c89A494BD9e";

/**
 * Chain ID for SIWA verification
 * 84532 = Base Sepolia (testnet)
 * 8453 = Base (mainnet)
 */
export const SIWA_CHAIN_ID = parseInt(process.env.SIWA_CHAIN_ID || "84532", 10);

/**
 * Base RPC URL for onchain verification
 * Required for verifying ERC-8004 ownership
 */
export const RPC_URL =
  process.env.RPC_URL ||
  process.env.BASE_SEPOLIA_RPC ||
  "https://sepolia.base.org";

/**
 * SIWA Domain (for message signing)
 */
export const SIWA_DOMAIN = process.env.SIWA_DOMAIN || "api.clawzz.io";

/**
 * SIWA URI (origin)
 */
export const SIWA_URI = process.env.SIWA_URI || "https://api.clawzz.io";

// =============================================================================
// Chain Configuration
// =============================================================================

/**
 * Get the viem chain config based on chain ID
 */
export function getViemChain() {
  switch (SIWA_CHAIN_ID) {
    case 8453:
      return base;
    case 84532:
    default:
      return baseSepolia;
  }
}

/**
 * CAIP-10 format for agent registry
 * Format: eip155:{chainId}:{registryAddress}
 */
export function getAgentRegistryCAIP(): string {
  return `eip155:${SIWA_CHAIN_ID}:${ERC8004_REGISTRY_ADDRESS}`;
}

// =============================================================================
// Viem Client for Onchain Verification
// =============================================================================

/**
 * Create viem public client for ERC-8004 onchain verification
 */
export function createPublicClient() {
  return createClient({
    chain: getViemChain(),
    transport: http(RPC_URL),
  });
}

/**
 * Client resolver for multi-chain support (required by SIWA SDK)
 * Maps chain ID to RPC URL
 */
let clientResolverInstance: ReturnType<typeof createClientResolver> | null =
  null;

export function getClientResolver() {
  if (clientResolverInstance) return clientResolverInstance;

  // Build RPC URLs from environment
  const rpcUrls: Record<number, string> = {};

  if (process.env.BASE_SEPOLIA_RPC) {
    rpcUrls[84532] = process.env.BASE_SEPOLIA_RPC;
  }
  if (process.env.BASE_MAINNET_RPC) {
    rpcUrls[8453] = process.env.BASE_MAINNET_RPC;
  }

  // Default fallback
  if (!rpcUrls[84532]) {
    rpcUrls[84532] = "https://sepolia.base.org";
  }
  if (!rpcUrls[8453]) {
    rpcUrls[8453] = "https://mainnet.base.org";
  }

  clientResolverInstance = createClientResolver(rpcUrls);
  return clientResolverInstance;
}

// =============================================================================
// Nonce Store - Redis (production) / Memory (fallback)
// =============================================================================

let nonceStore: ReturnType<typeof createRedisSIWANonceStore> | null = null;
let memoryNonceStore: ReturnType<
  typeof import("@buildersgarden/siwa/nonce-store").createMemorySIWANonceStore
> | null = null;

/**
 * Get or create nonce store
 * Uses Redis if REDIS_URL is available, falls back to memory
 */
export async function getNonceStore() {
  if (nonceStore) return nonceStore;

  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    try {
      // Dynamic import redis to get the client
      const { createClient } = await import("redis");
      const redis = createClient({ url: redisUrl });
      await redis.connect();
      nonceStore = createRedisSIWANonceStore(redis as any);
      console.log("[SIWA] Using Redis for nonce store");
      return nonceStore;
    } catch (err) {
      console.warn(
        "[SIWA] Failed to create Redis nonce store, using memory:",
        err,
      );
    }
  }

  // Fallback to memory store
  const { createMemorySIWANonceStore } =
    await import("@buildersgarden/siwa/nonce-store");
  nonceStore = createMemorySIWANonceStore();
  console.log("[SIWA] Using in-memory nonce store (not persistent)");
  return nonceStore;
}

// =============================================================================
// Privy Configuration (optional - for wallet management)
// =============================================================================

// @ts-ignore - Optional dependency
let PrivyClient: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  PrivyClient = require("@privy-io/node").PrivyClient;
} catch {
  // Privy not installed - features disabled
}

let privyClient: any = null;

/**
 * Initialize Privy client for wallet management (optional)
 * Only initializes if @privy-io/node is installed and credentials are set
 */
export function getPrivyClient(): any {
  if (privyClient) return privyClient;

  if (!PrivyClient) {
    console.warn("@privy-io/node not installed - Privy features disabled");
    return null;
  }

  privyClient = new PrivyClient({
    apiKey: process.env.PRIVY_API_KEY || "",
    appId: process.env.PRIVY_APP_ID || "",
  });
  return privyClient;
}

// =============================================================================
// Timing Configuration
// =============================================================================

/**
 * Nonce expiry time in milliseconds (10 minutes - SIWA default)
 */
export const NONCE_EXPIRY_MS = 10 * 60 * 1000;

/**
 * Receipt expiry time in milliseconds (24 hours)
 */
export const RECEIPT_EXPIRY_MS = 24 * 60 * 60 * 1000;

// =============================================================================
// Validation
// =============================================================================

/**
 * Validate SIWA configuration on startup
 */
export function validateSIWAConfig() {
  const issues: string[] = [];

  if (!SIWA_SECRET || SIWA_SECRET.length < 32) {
    issues.push("SIWA_SECRET must be at least 32 characters");
  }

  try {
    getAddress(ERC8004_REGISTRY_ADDRESS);
  } catch {
    issues.push("ERC8004_REGISTRY_ADDRESS must be a valid Ethereum address");
  }

  if (![84532, 8453].includes(SIWA_CHAIN_ID)) {
    issues.push(
      "SIWA_CHAIN_ID must be 84532 (Base Sepolia) or 8453 (Base Mainnet)",
    );
  }

  if (!RPC_URL) {
    issues.push(
      "RPC_URL (or BASE_SEPOLIA_RPC) is required for onchain verification",
    );
  }

  if (issues.length > 0) {
    console.error("[SIWA] Configuration issues:", issues);
    if (process.env.NODE_ENV === "production") {
      throw new Error(`SIWA configuration invalid: ${issues.join(", ")}`);
    } else {
      console.warn("[SIWA] Running in development mode with config issues");
    }
  } else {
    console.log(
      `[SIWA] Initialized - Chain: ${SIWA_CHAIN_ID}, Registry: ${ERC8004_REGISTRY_ADDRESS}`,
    );
  }
}
