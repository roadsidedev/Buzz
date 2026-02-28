/**
 * Wallet Utilities
 *
 * Multi-chain wallet address detection and validation.
 * Supports Base (EVM) and Solana chains.
 */

import { logger } from "./logger.js";

// ============================================
// Chain Type
// ============================================

export type ChainType = "base" | "solana";

// ============================================
// Detection
// ============================================

/**
 * Detect chain from wallet address format.
 *
 * - EVM (Base): starts with "0x", 42 chars total (0x + 40 hex)
 * - Solana: Base58 encoded, 32–44 chars, no "0x" prefix
 *
 * @returns detected chain or null if unrecognised
 */
export function detectChain(address: string): ChainType | null {
  if (!address || typeof address !== "string") return null;

  // EVM / Base
  if (address.startsWith("0x") && /^0x[0-9a-fA-F]{40}$/.test(address)) {
    return "base";
  }

  // Solana — Base58 alphabet (no 0, O, I, l)
  if (
    !address.startsWith("0x") &&
    address.length >= 32 &&
    address.length <= 44 &&
    /^[1-9A-HJ-NP-Za-km-z]+$/.test(address)
  ) {
    return "solana";
  }

  return null;
}

// ============================================
// Validation
// ============================================

/** Validate an EVM (Base) address */
export function isValidEvmAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address);
}

/** Validate a Solana address (Base58, 32-44 chars) */
export function isValidSolanaAddress(address: string): boolean {
  return (
    address.length >= 32 &&
    address.length <= 44 &&
    /^[1-9A-HJ-NP-Za-km-z]+$/.test(address)
  );
}

/**
 * Validate a wallet address for a given chain.
 * If chain is omitted, auto-detect from address format.
 */
export function isValidWallet(
  address: string,
  chain?: ChainType,
): boolean {
  const effectiveChain = chain ?? detectChain(address);
  if (!effectiveChain) return false;

  switch (effectiveChain) {
    case "base":
      return isValidEvmAddress(address);
    case "solana":
      return isValidSolanaAddress(address);
    default:
      return false;
  }
}

// ============================================
// Display helpers
// ============================================

/** Shorten a wallet address for logging (chain-aware) */
export function shortenWallet(address: string): string {
  if (!address) return "unknown";
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Generate a mock transaction hash for a given chain.
 * Used in mock/dev mode only.
 */
export function mockTxHash(chain: ChainType): string {
  if (chain === "solana") {
    // Solana tx signatures are Base58, ~88 chars
    const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    return Array.from({ length: 88 }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length)),
    ).join("");
  }

  // EVM: 0x + 64 hex chars
  return `0x${Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join("")}`;
}
