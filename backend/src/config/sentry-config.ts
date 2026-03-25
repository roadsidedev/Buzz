/**
 * Sentry Configuration & Initialization
 *
 * Error tracking and performance monitoring for production
 * @see https://docs.sentry.io/platforms/node/
 */

import * as Sentry from "@sentry/node";
import { logger } from "../utils/logger.js";
import { setSentryInitialized } from "../middleware/sentry-middleware.js";

let profilingIntegration: any = null;
try {
  const { ProfilingIntegration } = await import("@sentry/profiling-node");
  profilingIntegration = new ProfilingIntegration();
} catch {
  logger.warn(
    "Sentry profiling not available - this is normal in some environments",
  );
}

/**
 * Initialize Sentry for error tracking and performance monitoring
 *
 * Features enabled:
 * - Error tracking and alerting
 * - Performance monitoring (transaction tracing)
 * - Release tracking
 * - Custom breadcrumbs for debugging
 * - Security event logging
 *
 * Usage:
 * ```typescript
 * initializeSentry(app);
 * ```
 */
export function initializeSentry(app: any): void {
  const dsn = process.env.SENTRY_DSN;
  const environment = process.env.NODE_ENV || "development";
  const release = process.env.APP_VERSION || "0.0.1";

  if (!dsn) {
    logger.warn("SENTRY_DSN not configured, error tracking disabled");
    return;
  }

  Sentry.init({
    // Connection
    dsn,
    environment,
    release,
    enabled: environment !== "development", // Only in production by default

    // Tracing & Performance
    tracesSampleRate: environment === "production" ? 0.1 : 1.0, // 10% in production, 100% in dev
    profilesSampleRate:
      profilingIntegration && environment === "production" ? 0.1 : 0, // Profiling only if available

    // Integration
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      ...(profilingIntegration ? [profilingIntegration] : []),
      new Sentry.Integrations.OnUncaughtException(),
      new Sentry.Integrations.OnUnhandledRejection(),
    ],

    // Filtering
    allowUrls: [/https?:\/\/.*clawhouse/, /https?:\/\/localhost/],

    beforeSend(event: any, _hint: any) {
      // Don't send development errors to Sentry
      if (environment === "development") {
        return null;
      }

      // Filter sensitive data
      if (event.request) {
        // Remove auth headers
        if (event.request.headers) {
          event.request.headers.Authorization = "[REDACTED]";
          event.request.headers["X-API-Key"] = "[REDACTED]";
        }

        // Remove sensitive cookies
        if (event.request.cookies) {
          event.request.cookies = { redacted: true };
        }
      }

      return event;
    },

    denyUrls: [
      // Ignore errors from browser extensions
      /^chrome:\/\//,
      /^moz-extension:\/\//,
      /^ms-browser-extension:\/\//,

      // Ignore errors from third-party scripts
      /https?:\/\/.*analytics/,
      /https?:\/\/.*tracking/,
    ],
  });

  // Attach Sentry to Express
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.errorHandler());

  // Mark Sentry as initialized so middleware can use it
  setSentryInitialized(true);

  logger.info("✅ Sentry initialized for error tracking", {
    dsn: dsn.substring(0, 30) + "...",
    environment,
    release,
    tracesSampleRate: environment === "production" ? 0.1 : 1.0,
  });
}

/**
 * Capture authentication security events
 *
 * These events are tracked for security analysis but not necessarily errors
 */
export function captureSecurityEvent(
  eventType: string,
  data: Record<string, any>,
): void {
  Sentry.captureMessage(`Security Event: ${eventType}`, {
    level: "warning",
    tags: {
      security: true,
      eventType,
    },
    contexts: {
      security: data,
    },
  });

  logger.info(`Security event captured: ${eventType}`, data);
}

/**
 * Capture brute force attack
 */
export function captureBruteForceAttempt(
  identifier: string,
  ip: string | undefined,
  attempts: number,
): void {
  captureSecurityEvent("brute_force_attempt", {
    identifier,
    ip,
    attempts,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Capture account lockout
 */
export function captureAccountLockout(
  identifier: string,
  ip: string | undefined,
  reason: string,
): void {
  captureSecurityEvent("account_lockout", {
    identifier,
    ip,
    reason,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Capture CSRF token mismatch
 */
export function captureCsrfMismatch(
  sessionId: string,
  ip: string | undefined,
): void {
  captureSecurityEvent("csrf_validation_failed", {
    sessionId,
    ip,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Capture XSS attempt
 */
export function captureXssAttempt(
  payload: string,
  field: string,
  ip: string | undefined,
): void {
  captureSecurityEvent("xss_attempt_detected", {
    field,
    payloadLength: payload.length,
    payloadHash: Buffer.from(payload).toString("base64").substring(0, 50),
    ip,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Capture SQL injection attempt (parameterized queries prevent this)
 */
export function captureSqlInjectionAttempt(
  query: string,
  ip: string | undefined,
): void {
  captureSecurityEvent("potential_sql_injection", {
    queryLength: query.length,
    ip,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Capture API abuse
 */
export function captureApiAbuse(
  agentId: string,
  endpoint: string,
  requestsPerSecond: number,
): void {
  captureSecurityEvent("api_abuse_detected", {
    agentId,
    endpoint,
    requestsPerSecond,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Capture unauthorized access attempt
 */
export function captureUnauthorizedAccess(
  agentId: string | undefined,
  resource: string,
  ip: string | undefined,
): void {
  captureSecurityEvent("unauthorized_access_attempt", {
    agentId,
    resource,
    ip,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Capture suspicious login
 */
export function captureSuspiciousLogin(
  agentId: string,
  reason: string,
  data: Record<string, any>,
): void {
  captureSecurityEvent("suspicious_login", {
    agentId,
    reason,
    ...data,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Manual error capture with context
 */
export function captureError(
  error: Error,
  context: Record<string, any> = {},
): void {
  Sentry.captureException(error, {
    contexts: {
      custom: context,
    },
  });

  logger.error("Error captured in Sentry", error, context);
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(
  message: string,
  data: Record<string, any> = {},
  level: "debug" | "info" | "warning" | "error" = "info",
): void {
  Sentry.addBreadcrumb({
    message,
    data,
    level,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Phase 5: Alert on specific conditions
 *
 * Examples:
 * - Multiple brute force attempts from same IP
 * - Unusual login location/time
 * - Multiple failed CSRF validations
 * - High error rate on specific endpoint
 * - Database connection failures
 */

/**
 * Phase 5: Custom Metrics
 *
 * Track business metrics:
 * - Room creation rate
 * - Agent registration rate
 * - Payment failures
 * - API endpoint performance
 */
