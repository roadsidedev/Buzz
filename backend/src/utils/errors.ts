/**
 * Error classes for structured error handling
 */

import type { ErrorCode } from "../types/api";

/**
 * Base application error
 */
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public statusCode: number = 500,
    public context: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "AppError";
  }
}

/**
 * Validation error (400)
 */
export class ValidationError extends AppError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super("VALIDATION_ERROR" as ErrorCode, message, 400, context);
    this.name = "ValidationError";
  }
}

/**
 * Authentication error (401)
 */
export class AuthenticationError extends AppError {
  constructor(
    message: string,
    code: ErrorCode = "INVALID_CREDENTIALS" as ErrorCode,
    context: Record<string, unknown> = {},
  ) {
    super(code, message, 401, context);
    this.name = "AuthenticationError";
  }
}

/**
 * Authorization error (403)
 */
export class AuthorizationError extends AppError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super("UNAUTHORIZED" as ErrorCode, message, 403, context);
    this.name = "AuthorizationError";
  }
}

/**
 * Not found error (404)
 */
export class NotFoundError extends AppError {
  constructor(
    resource: string,
    id: string,
    context: Record<string, unknown> = {},
  ) {
    super(
      `${resource.toUpperCase()}_NOT_FOUND` as ErrorCode,
      `${resource} with id ${id} not found`,
      404,
      { resource, id, ...context },
    );
    this.name = "NotFoundError";
  }
}

/**
 * Rate limit error (429)
 */
export class RateLimitError extends AppError {
  constructor(
    message: string,
    retryAfter: number,
    context: Record<string, unknown> = {},
  ) {
    super("RATE_LIMIT_EXCEEDED" as ErrorCode, message, 429, {
      retryAfter,
      ...context,
    });
    this.name = "RateLimitError";
  }
}

/**
 * Payment error
 */
export class PaymentError extends AppError {
  constructor(
    message: string,
    public x402Error: unknown,
    context: Record<string, unknown> = {},
  ) {
    super("PAYMENT_FAILED" as ErrorCode, message, 402, context);
    this.name = "PaymentError";
  }
}

/**
 * Security error (401)
 */
export class SecurityError extends AppError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super("SECURITY_ERROR" as ErrorCode, message, 401, context);
    this.name = "SecurityError";
  }
}

/**
 * Service unavailable error (503)
 */
export class ServiceUnavailableError extends AppError {
  constructor(service: string, context: Record<string, unknown> = {}) {
    super(
      "SERVICE_UNAVAILABLE" as ErrorCode,
      `${service} service is unavailable`,
      503,
      { service, ...context },
    );
    this.name = "ServiceUnavailableError";
  }
}

/**
 * Database error (500)
 */
export class DatabaseError extends AppError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super("DATABASE_ERROR" as ErrorCode, message, 500, context);
    this.name = "DatabaseError";
  }
}

/**
 * Type guard for AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
