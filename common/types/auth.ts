/**
 * Authentication & Authorization Types (SIWA + Privy)
 *
 * Shared between frontend and backend for type safety.
 * Uses SIWA (Sign In With Agent) for wallet-based auth.
 * Integrated with Privy for managed agent wallets.
 */

// ============================================
// Database Models
// ============================================

/**
 * Agent Profile: Authenticated agent identity
 *
 * Returned after successful SIWA verification
 * and when validating current session
 */
export interface AuthAgentProfile {
  id: string;
  name: string;
  avatar?: string;
  walletAddress: string;
  erc8004AgentId: number;
  erc8004Verified: boolean;
  verificationStatus: "pending" | "verified" | "failed";
  role: "agent" | "admin" | "moderator";
  status: "active" | "inactive" | "suspended" | "banned";
  createdAt: string;
  updatedAt: string;
  lastVerifiedAt?: string;
}

/**
 * SIWANonce: Signing challenge stored in database
 *
 * Used internally for nonce lifecycle management
 */
export interface SIWANonce {
  id: string;
  walletAddress: string;
  agentId: number;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
  consumed: boolean;
  consumedAt?: string;
  createdAt: string;
}

/**
 * SIWAReceipt: HMAC-signed stateless token
 *
 * Issued after successful SIWA verification
 * Used for subsequent API calls (included in Authorization header)
 * Format: base64(payload).base64(hmac)
 */
export interface SIWAReceipt {
  walletAddress: string;
  agentId: number;
  signerType?: "eoa" | "sca";
  issuedAt: string;
  expiresAt: string;
}

/**
 * WalletSession: Privy wallet session tracking
 *
 * Used for managed agents with Privy wallet integration
 */
export interface WalletSession {
  id: string;
  agentId: string;
  privyUserId: string;
  walletAddress: string;
  chainId: number;
  isActive: boolean;
  expiresAt: string;
  lastActivityAt: string;
  createdAt: string;
}

// ============================================
// Request/Response Types
// ============================================

/**
 * ConnectWalletRequest: Register new agent with wallet
 *
 * First step in agent registration. Agent provides wallet address
 * and their ERC-8004 token ID.
 *
 * @param walletAddress - Ethereum address (0x...)
 * @param agentId - ERC-8004 token ID (>= 1)
 * @param name - Display name (1-255 chars)
 * @param avatar - Optional avatar URL
 */
export interface ConnectWalletRequest {
  walletAddress: string;
  agentId: number;
  name: string;
  avatar?: string;
}

/**
 * ConnectWalletResponse: Successful wallet connection
 *
 * Returns agent profile. Next step is to request nonce for signing.
 */
export interface ConnectWalletResponse {
  success: boolean;
  agent: AuthAgentProfile;
}

/**
 * SIWANonceRequest: Request signing challenge
 *
 * Agent provides wallet address and agent ID
 * Server returns nonce to be included in signed message
 *
 * @param walletAddress - Agent's wallet address
 * @param agentId - Agent's ERC-8004 token ID
 */
export interface SIWANonceRequest {
  walletAddress: string;
  agentId: number;
}

/**
 * SIWANonceResponse: Signing challenge returned
 *
 * @param nonce - Random string to include in signed message (>= 8 chars)
 * @param issuedAt - RFC 3339 timestamp when nonce was generated
 * @param expiresAt - RFC 3339 timestamp when nonce expires (10 minutes)
 */
export interface SIWANonceResponse {
  nonce: string;
  issuedAt: string;
  expiresAt: string;
}

/**
 * SIWAVerifyRequest: Submit signed SIWA message
 *
 * Agent has signed the SIWA message and submits it to verify ownership.
 * Server verifies signature and checks onchain registration.
 *
 * @param message - Full SIWA message (RFC format)
 * @param signature - EIP-191 signature hex string (0x...)
 * @param walletAddress - Signer's wallet address
 * @param agentId - Agent's ERC-8004 token ID
 */
export interface SIWAVerifyRequest {
  message: string;
  signature: string;
  walletAddress: string;
  agentId: number;
}

/**
 * SIWAVerifyResponse: Authentication successful, receipt issued
 *
 * @param receipt - HMAC-signed stateless token for API auth
 * @param agent - Authenticated agent profile
 * @param expiresAt - When receipt expires (24 hours)
 */
export interface SIWAVerifyResponse {
  receipt: string;
  agent: AuthAgentProfile;
  expiresAt: string;
}

/**
 * ReceiptVerifyRequest: Verify receipt for API call
 *
 * Agent includes receipt in Authorization header
 * Server verifies signature and checks expiration
 *
 * @param receipt - HMAC-signed receipt from /siwa/verify
 */
export interface ReceiptVerifyRequest {
  receipt: string;
}

/**
 * ReceiptVerifyResponse: Receipt validation result
 *
 * @param valid - Whether receipt is valid
 * @param agent - Agent profile if valid
 * @param error - Error message if invalid
 */
export interface ReceiptVerifyResponse {
  valid: boolean;
  agent?: AuthAgentProfile;
  error?: string;
}

// ============================================
// Error Types
// ============================================

/**
 * AuthError: Base authentication error
 *
 * All auth-specific errors extend this class
 * Provides error code, message, and HTTP status
 */
export class AuthError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 401
  ) {
    super(message);
    this.name = "AuthError";
    Object.setPrototypeOf(this, AuthError.prototype);
  }
}

/**
 * InvalidSignatureError: Signature verification failed
 */
export class InvalidSignatureError extends AuthError {
  constructor() {
    super("INVALID_SIGNATURE", "Signature verification failed", 401);
    Object.setPrototypeOf(this, InvalidSignatureError.prototype);
  }
}

/**
 * NonceExpiredError: Signing nonce has expired
 */
export class NonceExpiredError extends AuthError {
  constructor() {
    super("NONCE_EXPIRED", "Signing nonce has expired", 401);
    Object.setPrototypeOf(this, NonceExpiredError.prototype);
  }
}

/**
 * NonceUsedError: Nonce already used (replay attack)
 */
export class NonceUsedError extends AuthError {
  constructor() {
    super(
      "NONCE_USED",
      "Nonce has already been used (replay attack detected)",
      401
    );
    Object.setPrototypeOf(this, NonceUsedError.prototype);
  }
}

/**
 * ReceiptExpiredError: Receipt has expired
 */
export class ReceiptExpiredError extends AuthError {
  constructor() {
    super("RECEIPT_EXPIRED", "Receipt has expired", 401);
    Object.setPrototypeOf(this, ReceiptExpiredError.prototype);
  }
}

/**
 * ReceiptRevokedError: Receipt has been revoked
 */
export class ReceiptRevokedError extends AuthError {
  constructor() {
    super("RECEIPT_REVOKED", "Receipt has been revoked", 401);
    Object.setPrototypeOf(this, ReceiptRevokedError.prototype);
  }
}

/**
 * InvalidReceiptError: Receipt is invalid or tampered
 */
export class InvalidReceiptError extends AuthError {
  constructor(reason?: string) {
    super(
      "INVALID_RECEIPT",
      `Invalid receipt${reason ? `: ${reason}` : ""}`,
      401
    );
    Object.setPrototypeOf(this, InvalidReceiptError.prototype);
  }
}

/**
 * AgentAlreadyExistsError: Wallet or agent ID already registered
 */
export class AgentAlreadyExistsError extends AuthError {
  constructor(field: string, value: string) {
    super(
      "AGENT_EXISTS",
      `Agent with ${field} ${value} already exists`,
      409
    );
    Object.setPrototypeOf(this, AgentAlreadyExistsError.prototype);
  }
}

/**
 * AgentNotFoundError: Agent not found in database
 */
export class AgentNotFoundError extends AuthError {
  constructor(field: string = "ID") {
    super("AGENT_NOT_FOUND", `Agent not found by ${field}`, 404);
    Object.setPrototypeOf(this, AgentNotFoundError.prototype);
  }
}

/**
 * ERC8004VerificationError: Onchain ERC-8004 verification failed
 */
export class ERC8004VerificationError extends AuthError {
  constructor(reason?: string) {
    super(
      "ERC8004_VERIFICATION_FAILED",
      `ERC-8004 verification failed${reason ? `: ${reason}` : ""}`,
      403
    );
    Object.setPrototypeOf(this, ERC8004VerificationError.prototype);
  }
}

/**
 * UnauthorizedError: User lacks required permissions
 */
export class UnauthorizedError extends AuthError {
  constructor(message: string = "Unauthorized") {
    super("UNAUTHORIZED", message, 403);
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}

/**
 * ValidationError: Input validation failed
 */
export class ValidationError extends AuthError {
  constructor(message: string, public context?: Record<string, unknown>) {
    super("VALIDATION_ERROR", message, 400);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

// ============================================
// SIWA Message Format (RFC-style)
// ============================================

/**
 * SIWA Message Format (per SIWA spec)
 *
 * Example:
 * ```
 * example.com wants you to sign in with your Agent account:
 * 0x1234567890123456789012345678901234567890
 *
 * URI: https://example.com/siwa
 * Version: 1
 * Agent ID: 42
 * Agent Registry: eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e
 * Chain ID: 84532
 * Nonce: a1b2c3d4e5f6g7h8
 * Issued At: 2026-02-16T10:30:00Z
 * Expiration Time: 2026-02-16T10:40:00Z
 * ```
 *
 * See: https://siwa.id/docs#protocol-specification
 */
export type SIWAMessageFields = {
  domain: string;
  address: string;
  statement?: string;
  uri: string;
  agentId: number;
  agentRegistry: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
  expirationTime?: string;
  notBefore?: string;
  requestId?: string;
};

// ============================================
// Deprecated Types (for migration reference only)
// ============================================

/**
 * @deprecated Use AuthAgentProfile instead
 * Legacy email/password auth - no longer used
 */
export interface LegacyAuthUser {
  id: string;
  username: string;
  email: string;
  emailVerified: boolean;
  phone?: string;
  bio?: string;
  avatarUrl?: string;
  role: "agent" | "viewer" | "admin" | "moderator";
  status: "active" | "inactive" | "suspended" | "banned";
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

/**
 * @deprecated Use SIWAVerifyResponse instead
 * Legacy email/password response
 */
export interface LegacyAuthResponse {
  accessToken: string;
  refreshToken: string;
  user: LegacyAuthUser;
  expiresIn: number;
}
