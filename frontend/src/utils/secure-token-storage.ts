/**
 * Secure Token Storage Utility
 *
 * Handles secure storage and retrieval of authentication tokens
 * to prevent XSS attacks and token theft.
 *
 * Approaches:
 * 1. httpOnly cookies (primary - XSS-proof)
 * 2. sessionStorage (secondary - cleared on tab close)
 * 3. Memory variable (fallback - lost on page reload)
 *
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
 */

/**
 * Token storage strategy
 *
 * PREFERRED: httpOnly cookies (recommended)
 * - JavaScript cannot access (XSS protection)
 * - Sent automatically with requests
 * - Server can clear on logout
 *
 * FALLBACK: sessionStorage
 * - Cleared when browser tab closes
 * - Only available in same tab
 * - Vulnerable to XSS but better than localStorage
 *
 * AVOID: localStorage
 * - Persists across browser closes
 * - Accessible to XSS attacks
 * - Only use if tokens are short-lived
 */

type StorageType = "cookie" | "sessionStorage" | "memory";

interface TokenConfig {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType?: string;
}

/**
 * In-memory token storage (as fallback)
 * Cleared on page reload but prevents localStorage XSS exposure
 */
let memoryTokens: Partial<TokenConfig> = {};

/**
 * Determine if httpOnly cookies are available
 *
 * In a proper setup with httpOnly cookies:
 * - Tokens are NOT accessible from JavaScript
 * - But they ARE automatically sent with requests
 * - So we don't need to read them here
 */
export function canUseHttpOnlyCookies(): boolean {
  // Check if we're in a browser environment with cookie support
  return typeof document !== "undefined" && navigator.cookieEnabled;
}

/**
 * Save tokens to sessionStorage (cleared on tab close)
 *
 * @param tokens - Token configuration
 *
 * IMPORTANT: Only use for short-lived tokens
 * Session storage is safer than localStorage but still vulnerable to XSS
 */
export function saveTokensToSessionStorage(tokens: TokenConfig): void {
  try {
    sessionStorage.setItem(
      "auth_tokens",
      JSON.stringify({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
        tokenType: tokens.tokenType || "Bearer",
        savedAt: Date.now(),
      })
    );

    console.debug("✅ Tokens saved to sessionStorage");
  } catch (error) {
    console.error("Failed to save tokens to sessionStorage", error);
  }
}

/**
 * Get tokens from sessionStorage
 *
 * @returns Token configuration or null if not found
 */
export function getTokensFromSessionStorage(): Partial<TokenConfig> | null {
  try {
    const stored = sessionStorage.getItem("auth_tokens");
    if (!stored) {
      return null;
    }

    const tokens = JSON.parse(stored);

    // Check if tokens have expired
    const age = Date.now() - tokens.savedAt;
    const expiryMs = tokens.expiresIn * 1000;

    if (age > expiryMs) {
      console.warn("⚠️ Stored tokens expired, clearing");
      clearSessionStorageTokens();
      return null;
    }

    return tokens;
  } catch (error) {
    console.error("Failed to read tokens from sessionStorage", error);
    return null;
  }
}

/**
 * Clear tokens from sessionStorage
 */
export function clearSessionStorageTokens(): void {
  try {
    sessionStorage.removeItem("auth_tokens");
    console.debug("✅ SessionStorage tokens cleared");
  } catch (error) {
    console.error("Failed to clear sessionStorage tokens", error);
  }
}

/**
 * Save tokens to memory (volatile, cleared on page reload)
 *
 * This is the MOST SECURE option for browser storage:
 * - Not persisted to disk
 * - Not sent to indexedDB, localStorage, or sessionStorage
 * - Lost on page reload (user must re-authenticate)
 * - Protected from localStorage XSS attacks
 *
 * @param tokens - Token configuration
 */
export function saveTokensToMemory(tokens: TokenConfig): void {
  memoryTokens = {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresIn: tokens.expiresIn,
    tokenType: tokens.tokenType || "Bearer",
  };

  console.debug("✅ Tokens saved to memory (volatile storage)");
}

/**
 * Get tokens from memory
 *
 * @returns Token configuration or empty object
 */
export function getTokensFromMemory(): Partial<TokenConfig> {
  return { ...memoryTokens };
}

/**
 * Clear tokens from memory
 */
export function clearMemoryTokens(): void {
  memoryTokens = {};
  console.debug("✅ Memory tokens cleared");
}

/**
 * Extract access token from Authorization header format
 */
export function getAccessToken(
  storage: StorageType = "memory"
): string | null {
  let tokens: Partial<TokenConfig> | null = null;

  if (storage === "memory") {
    tokens = getTokensFromMemory();
  } else if (storage === "sessionStorage") {
    tokens = getTokensFromSessionStorage();
  }

  return tokens?.accessToken || null;
}

/**
 * Get refresh token
 */
export function getRefreshToken(
  storage: StorageType = "memory"
): string | null {
  let tokens: Partial<TokenConfig> | null = null;

  if (storage === "memory") {
    tokens = getTokensFromMemory();
  } else if (storage === "sessionStorage") {
    tokens = getTokensFromSessionStorage();
  }

  return tokens?.refreshToken || null;
}

/**
 * IMPORTANT: With httpOnly Cookies
 *
 * If using httpOnly cookies (recommended approach):
 * 1. Server sets token in httpOnly cookie
 * 2. Browser automatically includes cookie in requests
 * 3. JavaScript CANNOT access the token
 * 4. No need for custom token storage code
 *
 * Example server-side (express):
 * ```typescript
 * res.cookie("accessToken", token, {
 *   httpOnly: true,      // Prevent JS access
 *   secure: true,        // HTTPS only
 *   sameSite: "strict",  // CSRF protection
 *   maxAge: 3600000,     // 1 hour
 * });
 * ```
 *
 * Example client-side:
 * ```typescript
 * // Make API request - cookie is automatically included
 * const response = await fetch("/api/protected", {
 *   credentials: "include", // IMPORTANT: Include cookies
 * });
 * ```
 */

/**
 * Phase 5: Token Encryption at Rest
 *
 * For localStorage/sessionStorage, encrypt tokens:
 * ```typescript
 * import { encrypt, decrypt } from "crypto-js";
 *
 * export function saveTokensEncrypted(tokens: TokenConfig): void {
 *   const encrypted = encrypt(
 *     JSON.stringify(tokens),
 *     process.env.REACT_APP_ENCRYPTION_KEY
 *   );
 *   sessionStorage.setItem("auth_tokens_encrypted", encrypted);
 * }
 *
 * export function getTokensEncrypted(): Partial<TokenConfig> | null {
 *   const encrypted = sessionStorage.getItem("auth_tokens_encrypted");
 *   if (!encrypted) return null;
 *
 *   try {
 *     const decrypted = decrypt(
 *       encrypted,
 *       process.env.REACT_APP_ENCRYPTION_KEY
 *     );
 *     return JSON.parse(decrypted);
 *   } catch (error) {
 *     console.error("Failed to decrypt tokens");
 *     return null;
 *   }
 * }
 * ```
 *
 * Note: This is not perfect (encryption key would be in client code),
 * but adds a layer against basic XSS attacks.
 */

/**
 * Session Management Best Practices
 *
 * 1. Use sessionStorage (cleared on tab close) instead of localStorage
 * 2. Or use memory-only storage (lost on refresh)
 * 3. Implement token refresh before expiry
 * 4. Clear tokens on logout
 * 5. Validate token expiry on app load
 * 6. Redirect to login if tokens invalid
 */

/**
 * Clear all stored tokens
 */
export function clearAllTokens(storage: StorageType = "sessionStorage"): void {
  if (storage === "sessionStorage" || storage === "memory") {
    clearSessionStorageTokens();
    clearMemoryTokens();
  }

  console.debug("✅ All tokens cleared");
}

/**
 * Check if user is authenticated
 *
 * @param storage - Which storage to check
 * @returns true if valid token exists
 */
export function isAuthenticated(storage: StorageType = "memory"): boolean {
  const token = getAccessToken(storage);
  return !!token;
}

/**
 * Check token expiry
 *
 * @returns Seconds until expiry, or -1 if expired
 */
export function getTokenExpirySeconds(
  storage: StorageType = "memory"
): number {
  let tokens: Partial<TokenConfig> | null = null;

  if (storage === "memory") {
    tokens = getTokensFromMemory();
  } else if (storage === "sessionStorage") {
    tokens = getTokensFromSessionStorage();
  }

  return tokens?.expiresIn || -1;
}

/**
 * Set up automatic token refresh before expiry
 *
 * Refreshes token 2 minutes before expiry
 */
export function setupTokenRefreshTimer(
  onRefresh: () => Promise<void>,
  storage: StorageType = "memory"
): () => void {
  const REFRESH_BUFFER_MS = 2 * 60 * 1000; // 2 minutes

  const interval = setInterval(async () => {
    const expirySeconds = getTokenExpirySeconds(storage);

    if (expirySeconds > 0 && expirySeconds * 1000 < REFRESH_BUFFER_MS) {
      console.debug("🔄 Token expiry approaching, refreshing...");

      try {
        await onRefresh();
      } catch (error) {
        console.error("Failed to refresh token", error);
        clearAllTokens(storage);
      }
    }
  }, 30000); // Check every 30 seconds

  // Return cleanup function
  return () => clearInterval(interval);
}
