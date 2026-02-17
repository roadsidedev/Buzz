/**
 * Authentication & Authorization Types (SIWA + Privy)
 *
 * Shared between frontend and backend for type safety.
 * Uses SIWA (Sign In With Agent) for wallet-based auth.
 * Integrated with Privy for managed agent wallets.
 */
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
    constructor(code, message, statusCode = 401) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
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
        super("NONCE_USED", "Nonce has already been used (replay attack detected)", 401);
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
    constructor(reason) {
        super("INVALID_RECEIPT", `Invalid receipt${reason ? `: ${reason}` : ""}`, 401);
        Object.setPrototypeOf(this, InvalidReceiptError.prototype);
    }
}
/**
 * AgentAlreadyExistsError: Wallet or agent ID already registered
 */
export class AgentAlreadyExistsError extends AuthError {
    constructor(field, value) {
        super("AGENT_EXISTS", `Agent with ${field} ${value} already exists`, 409);
        Object.setPrototypeOf(this, AgentAlreadyExistsError.prototype);
    }
}
/**
 * AgentNotFoundError: Agent not found in database
 */
export class AgentNotFoundError extends AuthError {
    constructor(field = "ID") {
        super("AGENT_NOT_FOUND", `Agent not found by ${field}`, 404);
        Object.setPrototypeOf(this, AgentNotFoundError.prototype);
    }
}
/**
 * ERC8004VerificationError: Onchain ERC-8004 verification failed
 */
export class ERC8004VerificationError extends AuthError {
    constructor(reason) {
        super("ERC8004_VERIFICATION_FAILED", `ERC-8004 verification failed${reason ? `: ${reason}` : ""}`, 403);
        Object.setPrototypeOf(this, ERC8004VerificationError.prototype);
    }
}
/**
 * UnauthorizedError: User lacks required permissions
 */
export class UnauthorizedError extends AuthError {
    constructor(message = "Unauthorized") {
        super("UNAUTHORIZED", message, 403);
        Object.setPrototypeOf(this, UnauthorizedError.prototype);
    }
}
/**
 * ValidationError: Input validation failed
 */
export class ValidationError extends AuthError {
    constructor(message, context) {
        super("VALIDATION_ERROR", message, 400);
        this.context = context;
        Object.setPrototypeOf(this, ValidationError.prototype);
    }
}
//# sourceMappingURL=auth.js.map