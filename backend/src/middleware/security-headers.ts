/**
 * Security Headers Middleware
 *
 * Implements comprehensive security headers per OWASP standards:
 * - Content-Security-Policy (CSP)
 * - X-Frame-Options (Clickjacking prevention)
 * - X-Content-Type-Options (MIME sniffing prevention)
 * - X-XSS-Protection (Legacy XSS filter)
 * - Strict-Transport-Security (HSTS for HTTPS enforcement)
 * - Referrer-Policy (Referrer leakage prevention)
 * - Permissions-Policy (Feature access control)
 *
 * @see https://owasp.org/www-project-secure-headers/
 */

import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger.js";

/**
 * Apply comprehensive security headers to all responses
 */
export function securityHeaders(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const isProduction = process.env.NODE_ENV === "production";
  const isHttps = req.secure || req.get("x-forwarded-proto") === "https";

  // =========================================================================
  // CONTENT SECURITY POLICY (CSP)
  // =========================================================================
  // Prevents XSS by restricting script, style, and resource loading

  const cspDirectives = [
    // Default: only allow same-origin
    "default-src 'self'",

    // Scripts: self only (no inline eval, require strict-dynamic)
    "script-src 'self' 'strict-dynamic' https: http:",

    // Styles: self + inline (required for React)
    "style-src 'self' 'unsafe-inline'",

    // Images: self + data URLs
    "img-src 'self' data: https:",

    // Fonts: self + Google Fonts (for UI libraries)
    "font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com",

    // Connect: self + API domain + WebSocket
    `connect-src 'self' ${process.env.API_URL || "http://localhost:4000"} ws: wss:`,

    // Frame: deny all (prevent clickjacking)
    "frame-ancestors 'none'",

    // Form: self only
    "form-action 'self'",

    // Base: self only
    "base-uri 'self'",

    // Report CSP violations (Phase 5: integrate with Sentry)
    `report-uri ${process.env.CSP_REPORT_URI || "/api/v1/security/csp-report"}`,
  ];

  const cspHeader = cspDirectives.join("; ");
  res.setHeader("Content-Security-Policy", cspHeader);

  // =========================================================================
  // CLICKJACKING PREVENTION
  // =========================================================================
  res.setHeader("X-Frame-Options", "DENY"); // Deny embedding in frames

  // =========================================================================
  // MIME SNIFFING PREVENTION
  // =========================================================================
  res.setHeader("X-Content-Type-Options", "nosniff"); // Prevent browser MIME detection

  // =========================================================================
  // XSS PROTECTION (Legacy, modern CSP is primary defense)
  // =========================================================================
  res.setHeader("X-XSS-Protection", "1; mode=block");

  // =========================================================================
  // HSTS (HTTPS Enforcement)
  // =========================================================================
  // Only set in production with HTTPS
  if (isProduction && isHttps) {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    ); // 1 year
  }

  // =========================================================================
  // REFERRER POLICY
  // =========================================================================
  // Only send referrer to same-site requests
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // =========================================================================
  // PERMISSIONS POLICY (Feature Control)
  // =========================================================================
  // Disable unnecessary browser features
  const permissionsPolicy = [
    "accelerometer=()",
    "ambient-light-sensor=()",
    "autoplay=()",
    "battery=()",
    "camera=()",
    "document-domain=()",
    "encrypted-media=()",
    "fullscreen=(self)",
    "geolocation=()",
    "gyroscope=()",
    "layout-animations=(self)",
    "legacy-image-formats=(self)",
    "magnetometer=()",
    "microphone=()",
    "midi=()",
    "payment=()",
    "picture-in-picture=()",
    "publickey-credentials-get=()",
    "speaker-selection=()",
    "sync-xhr=(self)",
    "usb=()",
    "vr=()",
    "xr-spatial-tracking=()",
  ];

  res.setHeader("Permissions-Policy", permissionsPolicy.join(", "));

  // =========================================================================
  // PREVENT CACHING OF SENSITIVE DATA
  // =========================================================================
  // Do not cache authentication-related responses
  if (req.path.includes("/auth/") || req.path.includes("/refresh")) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }

  logger.debug("Security headers applied", {
    path: req.path,
    cspEnabled: true,
    hstsEnabled: isProduction && isHttps,
  });

  next();
}

/**
 * CSP Report Endpoint
 * Receives and logs CSP violations for monitoring
 *
 * Phase 5: Integrate with Sentry for automated alerting
 */
export async function handleCspReport(req: Request, res: Response): Promise<void> {
  const violation = req.body;

  logger.warn("CSP violation detected", {
    blockedUri: violation["blocked-uri"],
    violationUri: violation["violation-uri"],
    effectiveDirective: violation["effective-directive"],
    originalPolicy: violation["original-policy"],
    sourceFile: violation["source-file"],
    lineNumber: violation["line-number"],
    columnNumber: violation["column-number"],
  });

  // Phase 5: Send to Sentry
  // Sentry.captureMessage("CSP Violation", {
  //   level: "warning",
  //   contexts: { csp: violation },
  // });

  res.status(204).send(); // No content response
}

/**
 * Default CSP report endpoint path for testing
 * Can be overridden via CSP_REPORT_URI env var
 */
export function cspReportRoutes(router: any): void {
  router.post("/api/v1/security/csp-report", handleCspReport);
}
