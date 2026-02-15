/**
 * Authentication Integration Tests
 * 
 * Tests for all auth endpoints including:
 * - User registration
 * - User login
 * - Token refresh
 * - Token validation
 * - Error handling
 * - Security constraints
 */

import request from "supertest";
import { app } from "@/server";
import { db } from "@/config/database";

describe("Authentication API", () => {
  beforeEach(async () => {
    // Clear auth-related tables before each test
    await db.query("DELETE FROM login_audit");
    await db.query("DELETE FROM refresh_token");
    await db.query("DELETE FROM agent WHERE email LIKE 'test%' OR email LIKE '%example%'");
  });

  afterAll(async () => {
    await db.end();
  });

  describe("POST /api/v1/auth/register", () => {
    it("should register new user with valid input", async () => {
      const res = await request(app).post("/api/v1/auth/register").send({
        email: "test@example.com",
        username: "testuser",
        password: "SecurePass123",
        confirmPassword: "SecurePass123",
      });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("accessToken");
      expect(res.body).toHaveProperty("refreshToken");
      expect(res.body).toHaveProperty("user");
      expect(res.body).toHaveProperty("expiresIn");
      expect(res.body.user.email).toBe("test@example.com");
      expect(res.body.user.username).toBe("testuser");
      expect(res.body.user.role).toBe("agent");
      expect(res.body.user.status).toBe("active");
    });

    it("should reject duplicate email", async () => {
      // Register first user
      await request(app).post("/api/v1/auth/register").send({
        email: "duplicate@example.com",
        username: "user1",
        password: "SecurePass123",
        confirmPassword: "SecurePass123",
      });

      // Try to register with same email
      const res = await request(app).post("/api/v1/auth/register").send({
        email: "duplicate@example.com",
        username: "user2",
        password: "SecurePass123",
        confirmPassword: "SecurePass123",
      });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("USER_EXISTS");
      expect(res.body.error).toContain("duplicate@example.com");
    });

    it("should reject password mismatch", async () => {
      const res = await request(app).post("/api/v1/auth/register").send({
        email: "test@example.com",
        username: "testuser",
        password: "SecurePass123",
        confirmPassword: "DifferentPass",
      });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
      expect(res.body.error).toContain("not match");
    });

    it("should reject short password", async () => {
      const res = await request(app).post("/api/v1/auth/register").send({
        email: "test@example.com",
        username: "testuser",
        password: "short",
        confirmPassword: "short",
      });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("should reject invalid email format", async () => {
      const res = await request(app).post("/api/v1/auth/register").send({
        email: "invalid-email",
        username: "testuser",
        password: "SecurePass123",
        confirmPassword: "SecurePass123",
      });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("should reject short username", async () => {
      const res = await request(app).post("/api/v1/auth/register").send({
        email: "test@example.com",
        username: "ab",
        password: "SecurePass123",
        confirmPassword: "SecurePass123",
      });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("should reject missing required fields", async () => {
      const res = await request(app).post("/api/v1/auth/register").send({
        email: "test@example.com",
        // missing username and password
      });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("should hash password in database", async () => {
      const password = "MySecurePassword123";

      await request(app).post("/api/v1/auth/register").send({
        email: "test@example.com",
        username: "testuser",
        password,
        confirmPassword: password,
      });

      // Query database to verify password is hashed
      const result = await db.query(
        "SELECT password_hash FROM agent WHERE email = $1",
        ["test@example.com"]
      );

      const passwordHash = result.rows[0].password_hash;
      expect(passwordHash).not.toBe(password);
      expect(passwordHash.length).toBeGreaterThan(20); // bcrypt hashes are ~60 chars
    });
  });

  describe("POST /api/v1/auth/login", () => {
    beforeEach(async () => {
      // Register a test user
      await request(app).post("/api/v1/auth/register").send({
        email: "testuser@example.com",
        username: "testuser",
        password: "SecurePass123",
        confirmPassword: "SecurePass123",
      });
    });

    it("should login with valid credentials", async () => {
      const res = await request(app).post("/api/v1/auth/login").send({
        email: "testuser@example.com",
        password: "SecurePass123",
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("accessToken");
      expect(res.body).toHaveProperty("refreshToken");
      expect(res.body.user.email).toBe("testuser@example.com");
      expect(res.body.expiresIn).toBeGreaterThan(0);
    });

    it("should reject invalid password", async () => {
      const res = await request(app).post("/api/v1/auth/login").send({
        email: "testuser@example.com",
        password: "WrongPassword",
      });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("INVALID_CREDENTIALS");
    });

    it("should reject nonexistent email", async () => {
      const res = await request(app).post("/api/v1/auth/login").send({
        email: "nonexistent@example.com",
        password: "SecurePass123",
      });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("INVALID_CREDENTIALS");
    });

    it("should reject missing email", async () => {
      const res = await request(app).post("/api/v1/auth/login").send({
        password: "SecurePass123",
      });

      expect(res.status).toBe(401);
    });

    it("should reject missing password", async () => {
      const res = await request(app).post("/api/v1/auth/login").send({
        email: "testuser@example.com",
      });

      expect(res.status).toBe(401);
    });

    it("should update last_login_at on successful login", async () => {
      const beforeLogin = new Date();

      await new Promise((resolve) => setTimeout(resolve, 10)); // Small delay

      const loginRes = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "testuser@example.com",
          password: "SecurePass123",
        });

      const user = loginRes.body.user;
      const lastLogin = new Date(user.lastLoginAt);

      expect(lastLogin.getTime()).toBeGreaterThan(beforeLogin.getTime());
    });
  });

  describe("POST /api/v1/auth/refresh", () => {
    let validRefreshToken: string;
    let validAccessToken: string;

    beforeEach(async () => {
      // Register and login to get tokens
      const registerRes = await request(app).post("/api/v1/auth/register").send({
        email: "testuser@example.com",
        username: "testuser",
        password: "SecurePass123",
        confirmPassword: "SecurePass123",
      });

      validRefreshToken = registerRes.body.refreshToken;
      validAccessToken = registerRes.body.accessToken;
    });

    it("should refresh token with valid refresh token", async () => {
      const res = await request(app)
        .post("/api/v1/auth/refresh")
        .send({ refreshToken: validRefreshToken });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("accessToken");
      expect(res.body).toHaveProperty("refreshToken");
      expect(res.body.user.email).toBe("testuser@example.com");

      // New tokens should be different from old ones
      expect(res.body.accessToken).not.toBe(validAccessToken);
      expect(res.body.refreshToken).not.toBe(validRefreshToken);
    });

    it("should reject invalid refresh token", async () => {
      const res = await request(app)
        .post("/api/v1/auth/refresh")
        .send({ refreshToken: "invalid_token_xyz" });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("INVALID_TOKEN");
    });

    it("should reject missing refresh token", async () => {
      const res = await request(app)
        .post("/api/v1/auth/refresh")
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("MISSING_REFRESH_TOKEN");
    });

    it("should revoke old refresh token after refresh", async () => {
      // Refresh once (should succeed)
      const firstRefresh = await request(app)
        .post("/api/v1/auth/refresh")
        .send({ refreshToken: validRefreshToken });

      expect(firstRefresh.status).toBe(200);

      // Try to use old token again (should fail)
      const secondAttempt = await request(app)
        .post("/api/v1/auth/refresh")
        .send({ refreshToken: validRefreshToken });

      expect(secondAttempt.status).toBe(401);
    });
  });

  describe("GET /api/v1/auth/validate", () => {
    let accessToken: string;

    beforeEach(async () => {
      const res = await request(app).post("/api/v1/auth/register").send({
        email: "testuser@example.com",
        username: "testuser",
        password: "SecurePass123",
        confirmPassword: "SecurePass123",
      });

      accessToken = res.body.accessToken;
    });

    it("should validate token with Authorization header", async () => {
      const res = await request(app)
        .get("/api/v1/auth/validate")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe("testuser@example.com");
    });

    it("should reject missing Authorization header", async () => {
      const res = await request(app).get("/api/v1/auth/validate");

      expect(res.status).toBe(401);
    });

    it("should reject invalid token format", async () => {
      const res = await request(app)
        .get("/api/v1/auth/validate")
        .set("Authorization", "InvalidFormat");

      expect(res.status).toBe(401);
    });

    it("should reject malformed token", async () => {
      const res = await request(app)
        .get("/api/v1/auth/validate")
        .set("Authorization", "Bearer not.a.valid.token");

      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/v1/auth/profile", () => {
    let accessToken: string;

    beforeEach(async () => {
      const res = await request(app).post("/api/v1/auth/register").send({
        email: "testuser@example.com",
        username: "testuser",
        password: "SecurePass123",
        confirmPassword: "SecurePass123",
      });

      accessToken = res.body.accessToken;
    });

    it("should get user profile with valid token", async () => {
      const res = await request(app)
        .get("/api/v1/auth/profile")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.email).toBe("testuser@example.com");
      expect(res.body.username).toBe("testuser");
      expect(res.body.role).toBe("agent");
      expect(res.body.status).toBe("active");
    });

    it("should reject missing token", async () => {
      const res = await request(app).get("/api/v1/auth/profile");

      expect(res.status).toBe(401);
    });
  });

  describe("Security & Audit Logging", () => {
    it("should log successful login attempts", async () => {
      await request(app).post("/api/v1/auth/register").send({
        email: "testuser@example.com",
        username: "testuser",
        password: "SecurePass123",
        confirmPassword: "SecurePass123",
      });

      await request(app).post("/api/v1/auth/login").send({
        email: "testuser@example.com",
        password: "SecurePass123",
      });

      // Check audit log
      const auditRes = await db.query(
        "SELECT success FROM login_audit WHERE success = true ORDER BY created_at DESC LIMIT 1"
      );

      expect(auditRes.rows.length).toBeGreaterThan(0);
      expect(auditRes.rows[0].success).toBe(true);
    });

    it("should log failed login attempts", async () => {
      await request(app).post("/api/v1/auth/register").send({
        email: "testuser@example.com",
        username: "testuser",
        password: "SecurePass123",
        confirmPassword: "SecurePass123",
      });

      await request(app).post("/api/v1/auth/login").send({
        email: "testuser@example.com",
        password: "WrongPassword",
      });

      // Check audit log
      const auditRes = await db.query(
        "SELECT success FROM login_audit WHERE success = false ORDER BY created_at DESC LIMIT 1"
      );

      expect(auditRes.rows.length).toBeGreaterThan(0);
      expect(auditRes.rows[0].success).toBe(false);
    });
  });

  describe("Token Structure", () => {
    it("should return properly formatted JWT tokens", async () => {
      const res = await request(app).post("/api/v1/auth/register").send({
        email: "testuser@example.com",
        username: "testuser",
        password: "SecurePass123",
        confirmPassword: "SecurePass123",
      });

      const { accessToken, refreshToken } = res.body;

      // JWT format: xxx.yyy.zzz
      expect(accessToken.split(".").length).toBe(3);
      expect(refreshToken.split(".").length).toBe(3);
    });
  });
});
