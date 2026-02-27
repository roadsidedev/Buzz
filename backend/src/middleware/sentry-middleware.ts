/**
 * Sentry Middleware
 *
 * Request-level performance tracking and error context
 * Phase 1 (Day 3): Enhance Sentry integration with custom transaction tracking
 *
 * Features:
 * - Request performance monitoring
 * - Custom transaction naming
 * - Security event context
 * - Automatic breadcrumbs
 */

import { Request, Response, NextFunction } from "express";
import * as Sentry from "@sentry/node";
import { logger } from "../utils/logger.js";

// Track if Sentry is initialized
let isSentryInitialized = false;

/**
 * Check if Sentry has been initialized
 * Used to conditionally enable Sentry middleware
 */
export function isSentryEnabled(): boolean {
  return isSentryInitialized;
}

/**
 * Mark Sentry as initialized (called by sentry-config.ts)
 */
export function setSentryInitialized(initialized: boolean): void {
  isSentryInitialized = initialized;
}

/**
 * Start performance tracking for the request
 *
 * IMPORTANT: This middleware uses res.on('finish') instead of monkey-patching
 * res.send. The previous approach of overriding res.send caused TypeError
 * crashes across ALL endpoints because the patched function could corrupt
 * the Express response chain, especially when errors were thrown downstream.
 */
export function sentryTransactionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const startTime = Date.now();
  const method = req.method;
  const path = req.path;

  // Add request breadcrumb (safe — wrapped in try/catch)
  if (isSentryInitialized) {
    try {
      Sentry.addBreadcrumb({
        category: "http",
        message: `${method} ${path}`,
        level: "info",
        data: {
          method,
          path,
          query: req.query,
          params: req.params,
        },
      });
    } catch {
      // Silently ignore — Sentry breadcrumbs are non-critical
    }
  }

  // Use res.on('finish') to safely track response metrics
  // This fires AFTER the response has been fully sent — no risk of
  // corrupting the response chain like res.send monkey-patching did.
  res.on("finish", () => {
    try {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;

      // Add response breadcrumb
      if (isSentryInitialized) {
        Sentry.addBreadcrumb({
          category: "response",
          message: `Response ${statusCode}`,
          level: statusCode >= 400 ? "warning" : "info",
          data: {
            statusCode,
            duration: `${duration}ms`,
          },
        });
      }

      // Log slow requests
      if (duration > 1000) {
        logger.warn("Slow request detected", {
          method,
          path,
          duration: `${duration}ms`,
          statusCode,
        });
      }
    } catch {
      // Silently ignore — response tracking is non-critical
    }
  });

  next();
}

/**
 * Add security context to Sentry
 * For authenticated requests, includes agent info
 */
export function sentrySecurityContextMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!isSentryInitialized) {
    return next();
  }

  const agentId = (req as any).agentId;
  const ip = req.ip || req.get("x-forwarded-for");

  if (agentId) {
    Sentry.setUser({
      id: agentId,
      ip_address: ip,
    });

    Sentry.setContext("security", {
      agentId,
      ip,
      method: req.method,
      path: req.path,
    });
  }

  next();
}

/**
 * Track authentication attempts
 */
export function sentryAuthTrackingMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!isSentryInitialized) {
    return next();
  }

  if (req.path.includes("/auth/")) {
    Sentry.addBreadcrumb({
      category: "auth",
      message: `Auth endpoint: ${req.path}`,
      level: "info",
      data: {
        path: req.path,
        method: req.method,
      },
    });
  }

  next();
}

/**
 * Track errors and exceptions with context
 */
export function sentryErrorContextMiddleware(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!isSentryInitialized) {
    return next(error);
  }

  const contextData = {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get("user-agent"),
    agentId: (req as any).agentId,
  };

  Sentry.captureException(error, {
    contexts: {
      request: contextData,
    },
    tags: {
      errorType: error.name,
      endpoint: req.path,
    },
  });

  next(error);
}
