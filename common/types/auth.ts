/**
 * Authentication & Authorization Types
 * 
 * Shared between frontend and backend for type safety.
 * Used across API contracts, state management, and validation.
 */

// ============================================
// Database Models
// ============================================

/**
 * AuthUser: Authenticated user profile
 * 
 * Returned after successful login/registration
 * and when validating current session
 */
export interface AuthUser {
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
 * RefreshToken: Token metadata stored in database
 * 
 * Used internally for token lifecycle management
 */
export interface RefreshToken {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
  revokedAt?: string;
  createdAt: string;
}

// ============================================
// Request/Response Types
// ============================================

/**
 * RegisterRequest: User registration input
 * 
 * @param email - User's email address (validated format)
 * @param username - Display name (3-30 chars)
 * @param password - User password (8+ chars)
 * @param confirmPassword - Password confirmation (must match)
 */
export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
}

/**
 * LoginRequest: User login credentials
 * 
 * @param email - User's email address
 * @param password - User's password
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * AuthResponse: Successful authentication response
 * 
 * Returned by register, login, and refresh endpoints
 * Contains tokens and user profile
 */
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  expiresIn: number;
}

/**
 * TokenRefreshRequest: Token refresh request
 * 
 * @param refreshToken - Valid refresh token from previous auth
 */
export interface TokenRefreshRequest {
  refreshToken: string;
}

/**
 * ValidateTokenResponse: Token validation response
 * 
 * Used by GET /auth/validate endpoint
 */
export interface ValidateTokenResponse {
  valid: boolean;
  user?: AuthUser;
  error?: string;
}

// ============================================
// JWT & Token Payloads
// ============================================

/**
 * JWTPayload: Decoded JWT token payload
 * 
 * Verified by validateAccessToken() middleware
 * Contains user identity and permissions
 * 
 * @param sub - Subject (user_id) - used for authorization
 * @param email - User's email (for reference)
 * @param username - User's username (for display)
 * @param role - User's role (for RBAC)
 * @param aud - Audience (must be "clawhouse")
 * @param iat - Issued at (unix timestamp)
 * @param exp - Expiration (unix timestamp)
 */
export interface JWTPayload {
  sub: string;
  email: string;
  username: string;
  role: string;
  aud: "clawhouse";
  iat: number;
  exp: number;
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
 * InvalidCredentialsError: Login failed (bad email or password)
 */
export class InvalidCredentialsError extends AuthError {
  constructor() {
    super("INVALID_CREDENTIALS", "Invalid email or password", 401);
    Object.setPrototypeOf(this, InvalidCredentialsError.prototype);
  }
}

/**
 * UserAlreadyExistsError: Registration failed (email taken)
 */
export class UserAlreadyExistsError extends AuthError {
  constructor(email: string) {
    super("USER_EXISTS", `User with email ${email} already exists`, 409);
    Object.setPrototypeOf(this, UserAlreadyExistsError.prototype);
  }
}

/**
 * TokenExpiredError: Token has expired (need refresh)
 */
export class TokenExpiredError extends AuthError {
  constructor() {
    super("TOKEN_EXPIRED", "Token has expired", 401);
    Object.setPrototypeOf(this, TokenExpiredError.prototype);
  }
}

/**
 * InvalidTokenError: Token is invalid or malformed
 */
export class InvalidTokenError extends AuthError {
  constructor(reason?: string) {
    super(
      "INVALID_TOKEN",
      `Invalid token${reason ? `: ${reason}` : ""}`,
      401
    );
    Object.setPrototypeOf(this, InvalidTokenError.prototype);
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
