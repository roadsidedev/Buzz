# Phase 4 Week 1: Backend Authentication Foundation

**Week:** 1 of 3  
**Focus:** Database, User model, Auth service, JWT middleware  
**Days:** 5 (Feb 15-19, 2026)  
**Deliverables:** User table migrations, AuthService, Auth endpoints, 15+ tests

---

## Day 1: Database Schema & User Model

### Task: Create Auth Migration

📁 **migrations/001_auth_schema.sql**

```sql
-- Add auth fields to agent table
ALTER TABLE agent ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE NOT NULL;
ALTER TABLE agent ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) NOT NULL;
ALTER TABLE agent ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
ALTER TABLE agent ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE agent ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE agent ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);
ALTER TABLE agent ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'agent' CHECK (role IN ('agent', 'viewer', 'admin', 'moderator'));
ALTER TABLE agent ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'banned'));
ALTER TABLE agent ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE agent ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE agent ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

-- Create refresh_token table
CREATE TABLE IF NOT EXISTS refresh_token (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
  token VARCHAR(500) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_refresh_token_user_id ON refresh_token(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_token_token ON refresh_token(token);
CREATE INDEX IF NOT EXISTS idx_refresh_token_expires ON refresh_token(expires_at);

-- Create password_reset table
CREATE TABLE IF NOT EXISTS password_reset_token (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_password_reset_token_user_id ON password_reset_token(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_token_token ON password_reset_token(token);

-- Create login_audit table
CREATE TABLE IF NOT EXISTS login_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
  ip_address VARCHAR(45),
  user_agent VARCHAR(500),
  success BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_login_audit_user_id ON login_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_login_audit_created ON login_audit(created_at);
```

**Rationale:**
- Separate auth fields from existing agent data
- refresh_token table for token lifecycle
- password_reset_token for future password recovery
- login_audit for security tracking
- Indexes for query performance

**Testing:**
```bash
# Run migration
psql -U postgres -d clawhouse -f migrations/001_auth_schema.sql

# Verify
psql -U postgres -d clawhouse -c "\d agent"  # Should show new columns
psql -U postgres -d clawhouse -c "\d refresh_token"  # Should exist
```

---

### Task: Create Auth Types

📁 **common/types/auth.ts** (NEW)

```typescript
/**
 * Authentication & Authorization Types
 * 
 * Shared between frontend and backend for type safety
 */

// Database Models
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

export interface RefreshToken {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
  revokedAt?: string;
  createdAt: string;
}

// Request/Response Types
export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  expiresIn: number;
}

export interface TokenRefreshRequest {
  refreshToken: string;
}

export interface ValidateTokenResponse {
  valid: boolean;
  user?: AuthUser;
  error?: string;
}

// JWT Payload
export interface JWTPayload {
  sub: string;           // user_id
  email: string;
  username: string;
  role: string;
  iat: number;           // issued at
  exp: number;           // expiration
  aud: "clawhouse";      // audience
}

// Error Types
export class AuthError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 401
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export class InvalidCredentialsError extends AuthError {
  constructor() {
    super("INVALID_CREDENTIALS", "Invalid email or password", 401);
  }
}

export class UserAlreadyExistsError extends AuthError {
  constructor(email: string) {
    super("USER_EXISTS", `User with email ${email} already exists`, 409);
  }
}

export class TokenExpiredError extends AuthError {
  constructor() {
    super("TOKEN_EXPIRED", "Token has expired", 401);
  }
}

export class InvalidTokenError extends AuthError {
  constructor(reason?: string) {
    super("INVALID_TOKEN", `Invalid token${reason ? `: ${reason}` : ""}`, 401);
  }
}
```

**Usage:**
- Extend `common/types/auth.ts` in frontend and backend
- Export from both `backend/src/types/auth.ts` (symlink) and `frontend/src/types/auth.ts` (symlink)

---

## Day 2: Auth Service & Password Hashing

### Task: Create Auth Service

📁 **backend/src/services/auth-service.ts** (NEW)

```typescript
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { Database } from "@/config/database";
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
} from "@/types/auth";
import logger from "@/utils/logger";

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || "10");
const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRY = parseInt(process.env.JWT_EXPIRY || "3600"); // 1 hour
const JWT_REFRESH_EXPIRY = parseInt(process.env.JWT_REFRESH_EXPIRY || "2592000"); // 30 days

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters");
}

export class AuthService {
  constructor(private db: Database) {}

  /**
   * Register a new user
   * 
   * Validates input, checks for duplicates, hashes password, creates user
   * 
   * @throws UserAlreadyExistsError if email already registered
   * @throws ValidationError if input invalid
   */
  async register(request: RegisterRequest): Promise<AuthResponse> {
    // Validate input
    this._validateRegisterRequest(request);

    // Check if user exists
    const existingUser = await this.db.query(
      "SELECT id FROM agent WHERE email = $1",
      [request.email]
    );

    if (existingUser.rows.length > 0) {
      throw new UserAlreadyExistsError(request.email);
    }

    // Hash password
    const passwordHash = await bcryptjs.hash(request.password, BCRYPT_ROUNDS);

    // Create user
    const userId = uuidv4();
    const now = new Date();

    await this.db.query(
      `INSERT INTO agent (id, username, email, password_hash, role, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [userId, request.username, request.email, passwordHash, "agent", "active", now, now]
    );

    // Get user profile
    const user = await this._getUserById(userId);
    if (!user) throw new Error("Failed to retrieve created user");

    // Generate tokens
    const { accessToken, refreshToken } = await this._generateTokens(user);

    logger.info("User registered", { userId, email: request.email });

    return {
      accessToken,
      refreshToken,
      user,
      expiresIn: JWT_EXPIRY,
    };
  }

  /**
   * Login user
   * 
   * Validates credentials, updates last login, generates tokens
   * 
   * @throws InvalidCredentialsError if email/password incorrect
   */
  async login(request: LoginRequest): Promise<AuthResponse> {
    // Validate input
    if (!request.email || !request.password) {
      throw new InvalidCredentialsError();
    }

    // Find user
    const result = await this.db.query(
      "SELECT * FROM agent WHERE email = $1",
      [request.email]
    );

    if (result.rows.length === 0) {
      // Log failed attempt (security)
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

    logger.info("User logged in", { userId: user.id, email: user.email });

    return {
      accessToken,
      refreshToken,
      user,
      expiresIn: JWT_EXPIRY,
    };
  }

  /**
   * Refresh access token using refresh token
   * 
   * Validates refresh token, revokes old token, issues new pair
   * 
   * @throws TokenExpiredError if refresh token expired
   * @throws InvalidTokenError if token invalid
   */
  async refresh(refreshToken: string): Promise<AuthResponse> {
    // Verify token signature
    let payload: JWTPayload;
    try {
      payload = jwt.verify(refreshToken, JWT_SECRET) as JWTPayload;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new TokenExpiredError();
      }
      throw new InvalidTokenError("Invalid refresh token");
    }

    // Find refresh token in database
    const result = await this.db.query(
      `SELECT * FROM refresh_token 
       WHERE token = $1 AND user_id = $2 AND revoked_at IS NULL`,
      [refreshToken, payload.sub]
    );

    if (result.rows.length === 0) {
      throw new InvalidTokenError("Refresh token not found or revoked");
    }

    const tokenRow = result.rows[0];

    // Check expiration
    if (new Date(tokenRow.expires_at) < new Date()) {
      throw new TokenExpiredError();
    }

    // Get user
    const user = await this._getUserById(payload.sub);
    if (!user) throw new InvalidTokenError("User not found");

    // Revoke old token
    await this.db.query(
      "UPDATE refresh_token SET revoked_at = $1 WHERE id = $2",
      [new Date(), tokenRow.id]
    );

    // Issue new tokens
    const { accessToken, refreshToken: newRefreshToken } = await this._generateTokens(user);

    logger.info("Token refreshed", { userId: user.id });

    return {
      accessToken,
      refreshToken: newRefreshToken,
      user,
      expiresIn: JWT_EXPIRY,
    };
  }

  /**
   * Validate access token (called by middleware)
   * 
   * @returns Decoded JWT payload if valid
   * @throws InvalidTokenError if invalid
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
   */
  async getUserProfile(userId: string): Promise<AuthUser> {
    const user = await this._getUserById(userId);
    if (!user) throw new InvalidTokenError("User not found");
    return user;
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  private async _getUserById(userId: string): Promise<AuthUser | null> {
    const result = await this.db.query(
      "SELECT * FROM agent WHERE id = $1",
      [userId]
    );

    if (result.rows.length === 0) return null;
    return this._mapToAuthUser(result.rows[0]);
  }

  private _mapToAuthUser(row: any): AuthUser {
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      emailVerified: row.email_verified,
      phone: row.phone,
      bio: row.bio,
      avatarUrl: row.avatar_url,
      role: row.role,
      status: row.status,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      lastLoginAt: row.last_login_at?.toISOString(),
    };
  }

  private async _generateTokens(user: AuthUser): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const payload: JWTPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      aud: "clawhouse",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + JWT_EXPIRY,
    };

    const accessToken = jwt.sign(payload, JWT_SECRET, {
      algorithm: "HS256",
    });

    // Generate refresh token
    const refreshPayload: JWTPayload = {
      ...payload,
      exp: Math.floor(Date.now() / 1000) + JWT_REFRESH_EXPIRY,
    };

    const refreshToken = jwt.sign(refreshPayload, JWT_SECRET, {
      algorithm: "HS256",
    });

    // Store refresh token in database
    const refreshTokenId = uuidv4();
    const expiresAt = new Date(Date.now() + JWT_REFRESH_EXPIRY * 1000);

    await this.db.query(
      `INSERT INTO refresh_token (id, user_id, token, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [refreshTokenId, user.id, refreshToken, expiresAt]
    );

    return { accessToken, refreshToken };
  }

  private _validateRegisterRequest(request: RegisterRequest): void {
    if (!request.email || !request.username || !request.password) {
      throw new InvalidCredentialsError();
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(request.email)) {
      throw new InvalidCredentialsError();
    }

    if (request.password.length < 8) {
      throw new InvalidCredentialsError();
    }

    if (request.password !== request.confirmPassword) {
      throw new InvalidCredentialsError();
    }

    if (request.username.length < 3 || request.username.length > 30) {
      throw new InvalidCredentialsError();
    }
  }

  private async _logLoginAttempt(
    userId: string | null,
    success: boolean
  ): Promise<void> {
    // In production, also capture IP and user agent from request
    try {
      await this.db.query(
        `INSERT INTO login_audit (user_id, success, created_at)
         VALUES ($1, $2, $3)`,
        [userId, success, new Date()]
      );
    } catch (err) {
      logger.error("Failed to log login attempt", { error: err });
    }
  }
}
```

**Installation:**
```bash
cd backend
npm install bcryptjs jsonwebtoken
```

**Testing (Day 2):**
- Test register with valid input
- Test register with duplicate email
- Test login with valid credentials
- Test login with invalid password
- Test token generation

---

## Day 3: Auth Middleware & Routes

### Task: Create Auth Middleware

📁 **backend/src/middleware/auth.ts** (NEW)

```typescript
import { Request, Response, NextFunction } from "express";
import { AuthService } from "@/services/auth-service";
import { JWTPayload, InvalidTokenError } from "@/types/auth";
import logger from "@/utils/logger";

/**
 * Extend Express Request to include authenticated user
 */
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

const authService = new AuthService(db);

/**
 * Extract Bearer token from Authorization header
 */
function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Validate JWT token and attach user to request
 * 
 * Usage: app.use(validateJWT) or router.get('/protected', validateJWT, handler)
 */
export const validateJWT = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({ error: "No authorization token provided" });
      return;
    }

    // Validate token
    const payload = authService.validateAccessToken(token);
    req.user = payload;

    logger.debug("Token validated", { userId: payload.sub });
    next();
  } catch (err) {
    if (err instanceof InvalidTokenError) {
      res.status(401).json({ error: err.message });
    } else {
      logger.error("Auth validation failed", { error: err });
      res.status(500).json({ error: "Internal server error" });
    }
  }
};

/**
 * Require specific role (optional)
 * 
 * Usage: router.get('/admin', validateJWT, requireRole('admin'), handler)
 */
export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }

    next();
  };
};
```

### Task: Create Auth Routes

📁 **backend/src/api/routes/auth.ts** (NEW)

```typescript
import { Router, Request, Response } from "express";
import { AuthService } from "@/services/auth-service";
import { RegisterRequest, LoginRequest, AuthError } from "@/types/auth";
import { validateJWT } from "@/middleware/auth";
import logger from "@/utils/logger";
import { db } from "@/config/database";

const router = Router();
const authService = new AuthService(db);

/**
 * POST /auth/register
 * 
 * Register a new user
 * 
 * @body email, username, password, confirmPassword
 * @returns accessToken, refreshToken, user
 */
router.post("/register", async (req: Request, res: Response) => {
  try {
    const request = req.body as RegisterRequest;
    const response = await authService.register(request);
    
    logger.info("User registration", { email: request.email });
    res.status(201).json(response);
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
    } else {
      logger.error("Registration failed", { error: err });
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

/**
 * POST /auth/login
 * 
 * Authenticate user and return tokens
 * 
 * @body email, password
 * @returns accessToken, refreshToken, user
 */
router.post("/login", async (req: Request, res: Response) => {
  try {
    const request = req.body as LoginRequest;
    const response = await authService.login(request);
    
    logger.info("User login", { email: request.email });
    res.json(response);
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
    } else {
      logger.error("Login failed", { error: err });
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

/**
 * POST /auth/refresh
 * 
 * Refresh access token using refresh token
 * 
 * @body refreshToken
 * @returns accessToken, refreshToken, user
 */
router.post("/refresh", async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      res.status(400).json({ error: "Refresh token required" });
      return;
    }

    const response = await authService.refresh(refreshToken);
    res.json(response);
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
    } else {
      logger.error("Token refresh failed", { error: err });
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

/**
 * GET /auth/validate
 * 
 * Validate current access token (requires Bearer token)
 * 
 * @returns user profile
 */
router.get("/validate", validateJWT, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const user = await authService.getUserProfile(req.user.sub);
    res.json({ valid: true, user });
  } catch (err) {
    logger.error("Validation failed", { error: err });
    res.status(401).json({ valid: false, error: "Invalid token" });
  }
});

/**
 * GET /auth/profile
 * 
 * Get authenticated user profile (requires Bearer token)
 * 
 * @returns user profile
 */
router.get("/profile", validateJWT, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const user = await authService.getUserProfile(req.user.sub);
    res.json(user);
  } catch (err) {
    logger.error("Profile fetch failed", { error: err });
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
```

---

## Day 4: Integration into API Gateway

### Task: Add Auth Routes to Server

📁 **backend/src/server.ts** (UPDATED)

Add these lines:
```typescript
import authRoutes from "./api/routes/auth";

// ... existing setup ...

// Register auth routes (before other routes)
app.use("/api/v1/auth", authRoutes);

// Protect all other /api/v1 routes with JWT
app.use("/api/v1", validateJWT);

// ... rest of routes ...
```

---

## Day 5: Comprehensive Testing

### Task: Write Auth Tests

📁 **tests/integration/auth.test.ts** (NEW)

```typescript
import request from "supertest";
import { app } from "@/server";
import { db } from "@/config/database";

describe("Authentication API", () => {
  beforeEach(async () => {
    // Clear tables
    await db.query("DELETE FROM agent");
    await db.query("DELETE FROM refresh_token");
  });

  afterAll(async () => {
    await db.end();
  });

  describe("POST /auth/register", () => {
    it("should register new user with valid input", async () => {
      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({
          email: "test@example.com",
          username: "testuser",
          password: "SecurePass123",
          confirmPassword: "SecurePass123",
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("accessToken");
      expect(res.body).toHaveProperty("refreshToken");
      expect(res.body.user.email).toBe("test@example.com");
      expect(res.body.user.username).toBe("testuser");
    });

    it("should reject duplicate email", async () => {
      await request(app)
        .post("/api/v1/auth/register")
        .send({
          email: "test@example.com",
          username: "user1",
          password: "SecurePass123",
          confirmPassword: "SecurePass123",
        });

      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({
          email: "test@example.com",
          username: "user2",
          password: "SecurePass123",
          confirmPassword: "SecurePass123",
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("USER_EXISTS");
    });

    it("should reject password mismatch", async () => {
      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({
          email: "test@example.com",
          username: "testuser",
          password: "SecurePass123",
          confirmPassword: "DifferentPass",
        });

      expect(res.status).toBe(401);
    });

    it("should reject short password", async () => {
      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({
          email: "test@example.com",
          username: "testuser",
          password: "short",
          confirmPassword: "short",
        });

      expect(res.status).toBe(401);
    });
  });

  describe("POST /auth/login", () => {
    beforeEach(async () => {
      await request(app)
        .post("/api/v1/auth/register")
        .send({
          email: "test@example.com",
          username: "testuser",
          password: "SecurePass123",
          confirmPassword: "SecurePass123",
        });
    });

    it("should login with valid credentials", async () => {
      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "test@example.com",
          password: "SecurePass123",
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("accessToken");
      expect(res.body).toHaveProperty("refreshToken");
      expect(res.body.user.email).toBe("test@example.com");
    });

    it("should reject invalid password", async () => {
      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "test@example.com",
          password: "WrongPassword",
        });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("INVALID_CREDENTIALS");
    });

    it("should reject nonexistent email", async () => {
      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "nonexistent@example.com",
          password: "SecurePass123",
        });

      expect(res.status).toBe(401);
    });
  });

  describe("POST /auth/refresh", () => {
    let refreshToken: string;

    beforeEach(async () => {
      const registerRes = await request(app)
        .post("/api/v1/auth/register")
        .send({
          email: "test@example.com",
          username: "testuser",
          password: "SecurePass123",
          confirmPassword: "SecurePass123",
        });

      refreshToken = registerRes.body.refreshToken;
    });

    it("should refresh token with valid refresh token", async () => {
      const res = await request(app)
        .post("/api/v1/auth/refresh")
        .send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("accessToken");
      expect(res.body).toHaveProperty("refreshToken");
      expect(res.body.user.email).toBe("test@example.com");
    });

    it("should reject invalid refresh token", async () => {
      const res = await request(app)
        .post("/api/v1/auth/refresh")
        .send({ refreshToken: "invalid_token" });

      expect(res.status).toBe(401);
    });

    it("should reject missing refresh token", async () => {
      const res = await request(app)
        .post("/api/v1/auth/refresh")
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe("GET /auth/validate", () => {
    let accessToken: string;

    beforeEach(async () => {
      const registerRes = await request(app)
        .post("/api/v1/auth/register")
        .send({
          email: "test@example.com",
          username: "testuser",
          password: "SecurePass123",
          confirmPassword: "SecurePass123",
        });

      accessToken = registerRes.body.accessToken;
    });

    it("should validate token with Authorization header", async () => {
      const res = await request(app)
        .get("/api/v1/auth/validate")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
      expect(res.body.user.email).toBe("test@example.com");
    });

    it("should reject missing Authorization header", async () => {
      const res = await request(app)
        .get("/api/v1/auth/validate");

      expect(res.status).toBe(401);
    });

    it("should reject invalid token format", async () => {
      const res = await request(app)
        .get("/api/v1/auth/validate")
        .set("Authorization", "InvalidFormat");

      expect(res.status).toBe(401);
    });
  });
});
```

**Run tests:**
```bash
npm run test -- tests/integration/auth.test.ts
```

---

## Checklist: Week 1

- [ ] Migration created and tested
- [ ] Auth types defined
- [ ] AuthService implemented
- [ ] Auth middleware created
- [ ] Auth routes registered
- [ ] Integration tests passing (15+)
- [ ] Error handling complete
- [ ] Logging implemented
- [ ] Password hashing working (bcryptjs)
- [ ] JWT generation/validation working
- [ ] Documentation updated

---

## Summary

**Week 1 delivers:**
- ✅ Database schema for users, tokens, audit
- ✅ AuthService with register/login/refresh
- ✅ JWT generation and validation
- ✅ Auth middleware
- ✅ 4 protected endpoints
- ✅ 15+ integration tests
- ✅ Full type safety

**Week 2:** Frontend routes and auth store  
**Week 3:** E2E testing and security hardening

