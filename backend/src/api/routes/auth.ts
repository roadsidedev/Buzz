// @ts-nocheck
/**
 * Authentication Routes
 * @deprecated Use SIWA authentication routes instead
 *
 * Endpoints for user registration, login, token refresh, and validation.
 * All endpoints return consistent JSON format.
 */

import { Router, Request, Response } from "express";
import { AuthService } from "@/services/auth-service";
import {
  RegisterRequest,
  LoginRequest,
  AuthError,
  ValidationError,
} from "@/types/auth";
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
 * @body {RegisterRequest} email, username, password, confirmPassword
 * @returns {AuthResponse} accessToken, refreshToken, user, expiresIn
 * @status 201 Created
 * @status 400 Validation error
 * @status 409 User already exists
 * @status 500 Server error
 */
router.post("/register", async (req: Request, res: Response) => {
  try {
    const request = req.body as RegisterRequest;

    // Validate required fields present
    if (!request || typeof request !== "object") {
      return res.status(400).json({
        error: "Request body must be JSON object",
        code: "INVALID_REQUEST",
      });
    }

    // Call auth service
    const response = await authService.register(request);

    logger.info("User registration successful", {
      email: request.email,
      username: request.username,
      userId: response.user.id,
    });

    res.status(201).json(response);
  } catch (err) {
    if (err instanceof AuthError) {
      logger.warn("Registration failed", {
        error: err.message,
        code: err.code,
      });
      res.status(err.statusCode).json({
        error: err.message,
        code: err.code,
      });
    } else if (err instanceof ValidationError) {
      logger.warn("Registration validation failed", {
        error: err.message,
        context: err.context,
      });
      res.status(400).json({
        error: err.message,
        code: "VALIDATION_ERROR",
        context: err.context,
      });
    } else {
      logger.error("Registration failed with unexpected error", {
        error: err,
      });
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

/**
 * POST /auth/login
 *
 * Authenticate user and return tokens
 *
 * @body {LoginRequest} email, password
 * @returns {AuthResponse} accessToken, refreshToken, user, expiresIn
 * @status 200 OK
 * @status 400 Validation error
 * @status 401 Invalid credentials
 * @status 500 Server error
 */
router.post("/login", async (req: Request, res: Response) => {
  try {
    const request = req.body as LoginRequest;

    // Validate request body
    if (!request || typeof request !== "object") {
      return res.status(400).json({
        error: "Request body must be JSON object",
        code: "INVALID_REQUEST",
      });
    }

    // Call auth service
    const response = await authService.login(request);

    logger.info("User login successful", {
      email: request.email,
      userId: response.user.id,
    });

    res.json(response);
  } catch (err) {
    if (err instanceof AuthError) {
      logger.warn("Login failed", {
        error: err.message,
        code: err.code,
      });
      res.status(err.statusCode).json({
        error: err.message,
        code: err.code,
      });
    } else {
      logger.error("Login failed with unexpected error", {
        error: err,
      });
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

/**
 * POST /auth/refresh
 *
 * Refresh access token using refresh token
 *
 * @body {TokenRefreshRequest} refreshToken
 * @returns {AuthResponse} accessToken, refreshToken, user, expiresIn
 * @status 200 OK
 * @status 400 Missing refresh token
 * @status 401 Invalid or expired refresh token
 * @status 500 Server error
 */
router.post("/refresh", async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    // Validate refresh token present
    if (!refreshToken) {
      return res.status(400).json({
        error: "Refresh token required",
        code: "MISSING_REFRESH_TOKEN",
      });
    }

    // Call auth service
    const response = await authService.refresh(refreshToken);

    logger.info("Token refresh successful", {
      userId: response.user.id,
    });

    res.json(response);
  } catch (err) {
    if (err instanceof AuthError) {
      logger.warn("Token refresh failed", {
        error: err.message,
        code: err.code,
      });
      res.status(err.statusCode).json({
        error: err.message,
        code: err.code,
      });
    } else {
      logger.error("Token refresh failed with unexpected error", {
        error: err,
      });
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

/**
 * GET /auth/validate
 *
 * Validate current access token (requires Bearer token)
 *
 * Checks if provided token is valid and not expired.
 * Useful for checking session validity on client.
 *
 * @header {string} Authorization "Bearer <accessToken>"
 * @returns {object} { valid: boolean, user?: AuthUser }
 * @status 200 OK (always, even if invalid)
 * @status 500 Server error
 */
router.get("/validate", validateJWT, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        valid: false,
        error: "Not authenticated",
      });
    }

    // Get full user profile
    const user = await authService.getUserProfile(req.user.sub);

    logger.debug("Token validation successful", {
      userId: req.user.sub,
    });

    res.json({
      valid: true,
      user,
    });
  } catch (err) {
    logger.warn("Validation check failed", {
      error: err,
      userId: req.user?.sub,
    });
    res.status(401).json({
      valid: false,
      error: "Invalid token",
    });
  }
});

/**
 * GET /auth/profile
 *
 * Get authenticated user profile (requires Bearer token)
 *
 * Returns full user profile including optional fields.
 *
 * @header {string} Authorization "Bearer <accessToken>"
 * @returns {AuthUser} User profile
 * @status 200 OK
 * @status 401 Unauthorized
 * @status 500 Server error
 */
router.get("/profile", validateJWT, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: "Not authenticated",
        code: "UNAUTHENTICATED",
      });
    }

    // Get full user profile
    const user = await authService.getUserProfile(req.user.sub);

    logger.debug("Profile fetch successful", {
      userId: req.user.sub,
    });

    res.json(user);
  } catch (err) {
    logger.error("Profile fetch failed", {
      error: err,
      userId: req.user?.sub,
    });
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
