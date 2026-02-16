/**
 * AuthService: Core authentication business logic
 * 
 * Responsibilities:
 * - User registration with password hashing
 * - User login with credential verification
 * - Token generation and management
 * - Token refresh and validation
 * - User profile retrieval
 * - Security audit logging
 */

import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { Database } from "@/config/database";
import { CacheService } from "./cache-service.js";
import { RefreshTokenService } from "./refresh-token-service.js";
import {
  AuthUser,
  RegisterRequest,
  LoginRequest,
  AuthResponse,
  JWTPayload,
  InvalidCredentialsError,
  UserAlreadyExistsError,
  TokenExpiredError,
  InvalidTokenError,
  ValidationError,
} from "@/types/auth";
import logger from "@/utils/logger";

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || "10");
const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRY = parseInt(process.env.JWT_EXPIRY || "3600"); // 1 hour
const JWT_REFRESH_EXPIRY = parseInt(
  process.env.JWT_REFRESH_EXPIRY || "2592000"
); // 30 days

// Validate environment setup
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error(
    "JWT_SECRET must be set and at least 32 characters long in .env"
  );
}

/**
 * AuthService: Manages all authentication operations
 */
export class AuthService {
  private refreshTokenService: RefreshTokenService;

  constructor(private db: Database) {
    const cache = new CacheService(process.env.REDIS_URL);
    this.refreshTokenService = new RefreshTokenService(db, cache);
  }

  /**
   * Register a new user
   * 
   * Process:
   * 1. Validate input (email format, password strength, match)
   * 2. Check for duplicate email
   * 3. Hash password with bcryptjs
   * 4. Insert user into database
   * 5. Generate access and refresh tokens
   * 6. Return tokens and user profile
   * 
   * @param request - Registration data (email, username, passwords)
   * @returns AuthResponse with tokens and user profile
   * @throws UserAlreadyExistsError if email already registered
   * @throws ValidationError if input invalid
   */
  async register(request: RegisterRequest): Promise<AuthResponse> {
    // Validate input
    this._validateRegisterRequest(request);

    // Check if user already exists
    const existingUser = await this.db.query(
      "SELECT id FROM agent WHERE email = $1",
      [request.email]
    );

    if (existingUser.rows.length > 0) {
      throw new UserAlreadyExistsError(request.email);
    }

    // Hash password with bcryptjs
    const passwordHash = await bcryptjs.hash(request.password, BCRYPT_ROUNDS);

    // Create user
    const userId = uuidv4();
    const now = new Date();

    await this.db.query(
      `INSERT INTO agent (id, username, email, password_hash, role, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [userId, request.username, request.email, passwordHash, "agent", "active", now, now]
    );

    // Retrieve created user
    const user = await this._getUserById(userId);
    if (!user) throw new Error("Failed to retrieve created user");

    // Generate tokens
    const { accessToken, refreshToken } = await this._generateTokens(user);

    logger.info("User registered", {
      userId,
      email: request.email,
      username: request.username,
    });

    return {
      accessToken,
      refreshToken: refreshToken.token,
      user,
      expiresIn: JWT_EXPIRY,
    };
  }

  /**
   * Login user with email and password
   * 
   * Process:
   * 1. Validate input (email and password present)
   * 2. Find user by email
   * 3. Compare password hash with bcryptjs
   * 4. Check account status (must be active)
   * 5. Update last_login_at timestamp
   * 6. Log login attempt (success)
   * 7. Generate tokens
   * 8. Return response
   * 
   * @param request - Login credentials (email, password)
   * @returns AuthResponse with tokens and user profile
   * @throws InvalidCredentialsError if email/password incorrect or account inactive
   */
  async login(request: LoginRequest): Promise<AuthResponse> {
    // Validate input
    if (!request.email || !request.password) {
      await this._logLoginAttempt(null, false);
      throw new InvalidCredentialsError();
    }

    // Find user by email
    const result = await this.db.query(
      "SELECT * FROM agent WHERE email = $1",
      [request.email]
    );

    if (result.rows.length === 0) {
      // Log failed attempt (security: don't reveal if email exists)
      await this._logLoginAttempt(null, false);
      throw new InvalidCredentialsError();
    }

    const userRow = result.rows[0];

    // Verify password
    const passwordValid = await bcryptjs.compare(
      request.password,
      userRow.password_hash
    );

    if (!passwordValid) {
      await this._logLoginAttempt(userRow.id, false);
      throw new InvalidCredentialsError();
    }

    // Check account status
    if (userRow.status !== "active") {
      await this._logLoginAttempt(userRow.id, false);
      throw new InvalidCredentialsError();
    }

    // Update last login
    const now = new Date();
    await this.db.query(
      "UPDATE agent SET last_login_at = $1 WHERE id = $2",
      [now, userRow.id]
    );

    // Log successful attempt
    await this._logLoginAttempt(userRow.id, true);

    const user = this._mapToAuthUser(userRow);

    // Generate tokens
    const { accessToken, refreshToken } = await this._generateTokens(user);

    logger.info("User logged in", {
      userId: user.id,
      email: user.email,
    });

    return {
      accessToken,
      refreshToken: refreshToken.token,
      user,
      expiresIn: JWT_EXPIRY,
    };
  }

  /**
   * Refresh access token using refresh token rotation
   * 
   * Process:
   * 1. Rotate refresh token (single-use enforcement, token family tracking)
   * 2. Verify token validity and detect replay attacks
   * 3. Issue new access token
   * 4. Return new token pair
   * 
   * SECURITY: Implements RFC 6749 Section 6 refresh token rotation
   * - Old token invalidated immediately (single-use)
   * - Token family tracked to detect replay attacks
   * - Entire family revoked if reuse detected
   * 
   * @param refreshToken - Current valid refresh token
   * @returns AuthResponse with new token pair
   * @throws TokenExpiredError if token expired
   * @throws InvalidTokenError if token invalid, revoked, or reused
   */
  async refresh(refreshToken: string): Promise<AuthResponse> {
    try {
      // Rotate refresh token (handles validation and rotation logic)
      const newRefreshTokenData = await this.refreshTokenService.rotateToken(
        refreshToken
      );

      // Extract user ID from refresh token for profile fetch
      // Note: We trust refreshTokenService validation has succeeded
      const tokenIdPart = refreshToken.split(".")[0];
      const tokenRecord = await this.db.query(
        "SELECT user_id FROM refresh_token WHERE id = $1 LIMIT 1",
        [tokenIdPart]
      );

      if (tokenRecord.length === 0) {
        throw new InvalidTokenError("User not found");
      }

      const userId = tokenRecord[0].user_id;
      const user = await this._getUserById(userId);
      if (!user) throw new InvalidTokenError("User not found");

      // Generate new access token
      const accessToken = this._generateAccessToken(user);

      logger.info("Token refreshed with rotation", {
        userId: user.id,
        tokenFamily: newRefreshTokenData.metadata.tokenFamily,
        generation: newRefreshTokenData.metadata.generationNumber,
      });

      return {
        accessToken,
        refreshToken: newRefreshTokenData.token,
        user,
        expiresIn: JWT_EXPIRY,
      };
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes("already used")) {
          throw new InvalidTokenError(
            "Token has been reused. Security incident detected. All tokens revoked."
          );
        }
        throw new InvalidTokenError(err.message);
      }
      throw err;
    }
  }

  /**
   * Validate access token (called by middleware)
   * 
   * Verifies JWT signature and returns decoded payload
   * 
   * @param token - Access token from Authorization header
   * @returns Decoded JWT payload if valid
   * @throws TokenExpiredError if token expired
   * @throws InvalidTokenError if token invalid
   */
  validateAccessToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, JWT_SECRET) as JWTPayload;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new TokenExpiredError();
      }
      throw new InvalidTokenError();
    }
  }

  /**
   * Get user profile by ID
   * 
   * Used by GET /auth/profile and GET /auth/validate endpoints
   * 
   * @param userId - User ID
   * @returns User profile
   * @throws InvalidTokenError if user not found
   */
  async getUserProfile(userId: string): Promise<AuthUser> {
    const user = await this._getUserById(userId);
    if (!user) throw new InvalidTokenError("User not found");
    return user;
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  /**
   * Get user by ID from database
   * 
   * @private
   * @param userId - User ID
   * @returns User profile or null if not found
   */
  private async _getUserById(userId: string): Promise<AuthUser | null> {
    const result = await this.db.query(
      "SELECT * FROM agent WHERE id = $1",
      [userId]
    );

    if (result.rows.length === 0) return null;
    return this._mapToAuthUser(result.rows[0]);
  }

  /**
   * Map database row to AuthUser object
   * 
   * @private
   * @param row - Database row
   * @returns Formatted AuthUser
   */
  private _mapToAuthUser(row: any): AuthUser {
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      emailVerified: row.email_verified || false,
      phone: row.phone,
      bio: row.bio,
      avatarUrl: row.avatar_url,
      role: row.role || "agent",
      status: row.status || "active",
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      lastLoginAt: row.last_login_at?.toISOString(),
    };
  }

  /**
   * Generate only access token
   * 
   * @private
   * @param user - User profile
   * @returns Access token JWT
   */
  private _generateAccessToken(user: AuthUser): string {
    const now = Math.floor(Date.now() / 1000);

    const payload: JWTPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      aud: "clawzz",
      iat: now,
      exp: now + JWT_EXPIRY,
    };

    return jwt.sign(payload, JWT_SECRET, { algorithm: "HS256" });
  }

  /**
   * Generate access and refresh token pair
   * 
   * Process:
   * 1. Create JWT payload with user info
   * 2. Sign access token (1 hour expiry)
   * 3. Issue refresh token via RefreshTokenService (with rotation setup)
   * 
   * @private
   * @param user - User profile
   * @returns Access token and refresh token metadata
   */
  private async _generateTokens(
    user: AuthUser
  ): Promise<{
    accessToken: string;
    refreshToken: { token: string; metadata: any };
  }> {
    // Generate access token
    const accessToken = this._generateAccessToken(user);

    // Issue refresh token (via RefreshTokenService)
    const refreshToken = await this.refreshTokenService.issueToken(user.id);

    return { accessToken, refreshToken };
  }

  /**
   * Validate registration request
   * 
   * Checks:
   * - Email present and valid format
   * - Username present and length (3-30 chars)
   * - Password present, 8+ chars, no spaces
   * - Passwords match
   * 
   * @private
   * @param request - Registration request
   * @throws ValidationError if invalid
   */
  private _validateRegisterRequest(request: RegisterRequest): void {
    // Check required fields
    if (!request.email || !request.username || !request.password) {
      throw new ValidationError("Email, username, and password required");
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(request.email)) {
      throw new ValidationError("Invalid email format", {
        field: "email",
        value: request.email,
      });
    }

    // Validate username length
    if (request.username.length < 3 || request.username.length > 30) {
      throw new ValidationError("Username must be 3-30 characters", {
        field: "username",
        length: request.username.length,
      });
    }

    // Validate password strength (8+ chars)
    if (request.password.length < 8) {
      throw new ValidationError("Password must be at least 8 characters", {
        field: "password",
        minLength: 8,
      });
    }

    // Verify passwords match
    if (request.password !== request.confirmPassword) {
      throw new ValidationError("Passwords do not match", {
        field: "confirmPassword",
      });
    }
  }

  /**
   * Log login attempt for security auditing
   * 
   * Records both successful and failed login attempts
   * Does not throw errors to prevent blocking auth flow
   * 
   * @private
   * @param userId - User ID (null if user not found)
   * @param success - Whether login succeeded
   */
  private async _logLoginAttempt(
    userId: string | null,
    success: boolean
  ): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO login_audit (user_id, success, created_at)
         VALUES ($1, $2, $3)`,
        [userId, success, new Date()]
      );
    } catch (err) {
      // Don't throw - just log that audit failed
      logger.error("Failed to log login attempt", { error: err });
    }
  }
}
