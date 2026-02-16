/**
 * SIWA Configuration
 * 
 * Sets up Privy client and SIWA constants
 */

import { PrivyClient } from "@privy-io/node";

/**
 * Initialize Privy client for wallet management
 */
export const privy = new PrivyClient({
  apiKey: process.env.PRIVY_API_KEY || "",
  appId: process.env.PRIVY_APP_ID || "",
});

/**
 * ERC-8004 Registry contract address
 * Base Sepolia testnet
 */
export const ERC8004_REGISTRY = process.env.ERC8004_REGISTRY || 
  "eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e";

/**
 * Chain ID for SIWA verification
 * 84532 = Base Sepolia
 */
export const CHAIN_ID = parseInt(process.env.CHAIN_ID || "84532", 10);

/**
 * SIWA Domain
 */
export const SIWA_DOMAIN = process.env.SIWA_DOMAIN || "api.clawhouse.io";

/**
 * SIWA URI (origin)
 */
export const SIWA_URI = process.env.SIWA_URI || "https://api.clawhouse.io";

/**
 * HMAC Secret for receipt signing
 */
export const SIWA_HMAC_SECRET = process.env.SIWA_HMAC_SECRET!;

if (!SIWA_HMAC_SECRET || SIWA_HMAC_SECRET.length < 32) {
  throw new Error(
    "SIWA_HMAC_SECRET must be set in .env and at least 32 characters"
  );
}

/**
 * Nonce expiry time in milliseconds (10 minutes)
 */
export const NONCE_EXPIRY_MS = 10 * 60 * 1000;

/**
 * Receipt expiry time in milliseconds (24 hours)
 */
export const RECEIPT_EXPIRY_MS = 24 * 60 * 60 * 1000;
