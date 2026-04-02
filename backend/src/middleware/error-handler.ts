/**
 * Express Error Handling Middleware
 */

import { Request, Response, NextFunction } from "express";
import type { ApiError, ApiResponse } from "../types/api.js";
import { AppError, isAppError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

/**
 * Async error handler wrapper for route handlers
 * Catches promise rejections and passes to error middleware
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Global error handling middleware
 * Should be registered last in middleware chain
 */
export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log the error — wrapped in try/catch to prevent secondary crashes
  try {
    logger.error("Request error", err, {
      method: req.method,
      path: req.path,
      agentId: (req as any).agent?.id,
    });
  } catch {
    // If logging fails, at least write to console
    console.error("Request error (logger failed):", err?.message || err);
  }

  let statusCode = 500;
  let code = "INTERNAL_SERVER_ERROR";
  let message = "An unexpected error occurred";
  let context: Record<string, unknown> = {};

  if (isAppError(err)) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    context = err.context;
  } else if (err instanceof SyntaxError) {
    statusCode = 400;
    code = "INVALID_JSON";
    message = "Invalid JSON in request body";
  } else {
    // For unexpected errors, expose the actual error message for debugging
    // In production, you may want to sanitize this to avoid leaking internals
    message = err.message || message;
    context = {
      errorType: err.constructor.name,
      ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
    };
  }

  const response: ApiResponse<null> = {
    success: false,
    error: {
      code,
      message,
      context,
      statusCode,
    } as ApiError,
  };

  // Guard against headers already sent
  if (res.headersSent) {
    return next(err);
  }

  res.status(statusCode).json(response);
}

/**
 * 404 Not Found middleware
 * Should be registered after all other routes
 */
export function notFoundHandler(
  req: Request,
  res: Response
): void {
  const response: ApiResponse<null> = {
    success: false,
    error: {
      code: "NOT_FOUND",
      message: `Route ${req.method} ${req.path} not found`,
      statusCode: 404,
    },
  };

  res.status(404).json(response);
}
