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

/**
 * Start a Sentry transaction for the request
 * Tracks performance of each endpoint
 */
export function sentryTransactionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const startTime = Date.now();
  const method = req.method;
  const path = req.path;

  // Create transaction name from method + path
  const transactionName = `${method} ${path}`;

  // Start Sentry transaction
  const transaction = Sentry.startTransaction({
    name: transactionName,
    op: "http.request",
    description: `${method} ${path}`,
  });

  // Store in request for later use
  (req as any).transaction = transaction;

  // Capture request details
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

  // Capture response when finished
  const originalSend = res.send;
  res.send = function (data: any) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    // Add response breadcrumb
    Sentry.addBreadcrumb({
      category: "response",
      message: `Response ${statusCode}`,
      level: statusCode >= 400 ? "warning" : "info",
      data: {
        statusCode,
        duration: `${duration}ms`,
      },
    });

    // Set transaction status
    if (statusCode >= 500) {
      transaction.setStatus("internal_error");
    } else if (statusCode >= 400) {
      transaction.setStatus("invalid_argument");
    } else {
      transaction.setStatus("ok");
    }

    // Finish transaction
    transaction.finish();

    // Log slow requests
    if (duration > 1000) {
      logger.warn("Slow request detected", {
        method,
        path,
        duration: `${duration}ms`,
        statusCode,
      });
    }

    return originalSend.call(this, data);
  };

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
