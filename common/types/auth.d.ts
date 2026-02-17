/**
 * Authentication & Authorization Types (SIWA + Privy)
 *
 * Shared between frontend and backend for type safety.
 * Uses SIWA (Sign In With Agent) for wallet-based auth.
 * Integrated with Privy for managed agent wallets.
 */
/**
 * Agent Profile: Authenticated agent identity
 *
 * Returned after successful SIWA verification
 * and when validating current session
 */
export interface AgentProfile {
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
    agent: AgentProfile;
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
    agent: AgentProfile;
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
    agent?: AgentProfile;
    error?: string;
}
/**
 * AuthError: Base authentication error
 *
 * All auth-specific errors extend this class
 * Provides error code, message, and HTTP status
 */
export declare class AuthError extends Error {
    code: string;
    statusCode: number;
    constructor(code: string, message: string, statusCode?: number);
}
/**
 * InvalidSignatureError: Signature verification failed
 */
export declare class InvalidSignatureError extends AuthError {
    constructor();
}
/**
 * NonceExpiredError: Signing nonce has expired
 */
export declare class NonceExpiredError extends AuthError {
    constructor();
}
/**
 * NonceUsedError: Nonce already used (replay attack)
 */
export declare class NonceUsedError extends AuthError {
    constructor();
}
/**
 * ReceiptExpiredError: Receipt has expired
 */
export declare class ReceiptExpiredError extends AuthError {
    constructor();
}
/**
 * ReceiptRevokedError: Receipt has been revoked
 */
export declare class ReceiptRevokedError extends AuthError {
    constructor();
}
/**
 * InvalidReceiptError: Receipt is invalid or tampered
 */
export declare class InvalidReceiptError extends AuthError {
    constructor(reason?: string);
}
/**
 * AgentAlreadyExistsError: Wallet or agent ID already registered
 */
export declare class AgentAlreadyExistsError extends AuthError {
    constructor(field: string, value: string);
}
/**
 * AgentNotFoundError: Agent not found in database
 */
export declare class AgentNotFoundError extends AuthError {
    constructor(field?: string);
}
/**
 * ERC8004VerificationError: Onchain ERC-8004 verification failed
 */
export declare class ERC8004VerificationError extends AuthError {
    constructor(reason?: string);
}
/**
 * UnauthorizedError: User lacks required permissions
 */
export declare class UnauthorizedError extends AuthError {
    constructor(message?: string);
}
/**
 * ValidationError: Input validation failed
 */
export declare class ValidationError extends AuthError {
    context?: Record<string, unknown> | undefined;
    constructor(message: string, context?: Record<string, unknown> | undefined);
}
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
/**
 * @deprecated Use AgentProfile instead
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
//# sourceMappingURL=auth.d.ts.map