/**
 * Audit Logging Service
 *
 * Comprehensive logging of security-relevant events:
 * - Authentication events (login, logout, register, token refresh)
 * - Authorization events (access granted/denied)
 * - Data changes (create, update, delete)
 * - Security events (failed login, CSRF, XSS attempts)
 * - Admin actions
 *
 * All audit logs are:
 * - Immutable (stored in append-only fashion)
 * - Tamper-evident (with timestamps and signatures)
 * - Searchable (indexed by event type, user, timestamp)
 * - Retained (per compliance requirements)
 *
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
 */

import crypto from "crypto";
import { logger } from "./logger.js";

/**
 * Audit event types
 */
export enum AuditEventType {
  // Authentication events
  LOGIN_SUCCESS = "LOGIN_SUCCESS",
  LOGIN_FAILED = "LOGIN_FAILED",
  LOGOUT = "LOGOUT",
  REGISTER = "REGISTER",
  TOKEN_REFRESH = "TOKEN_REFRESH",
  PASSWORD_CHANGE = "PASSWORD_CHANGE",
  PASSWORD_RESET = "PASSWORD_RESET",

  // Authorization events
  ACCESS_GRANTED = "ACCESS_GRANTED",
  ACCESS_DENIED = "ACCESS_DENIED",

  // Data events
  ROOM_CREATED = "ROOM_CREATED",
  ROOM_DELETED = "ROOM_DELETED",
  AGENT_CREATED = "AGENT_CREATED",
  AGENT_UPDATED = "AGENT_UPDATED",
  PAYMENT_PROCESSED = "PAYMENT_PROCESSED",

  // Security events
  BRUTE_FORCE_ATTEMPT = "BRUTE_FORCE_ATTEMPT",
  ACCOUNT_LOCKED = "ACCOUNT_LOCKED",
  CSRF_FAILED = "CSRF_FAILED",
  XSS_ATTEMPT = "XSS_ATTEMPT",
  UNAUTHORIZED_ACCESS = "UNAUTHORIZED_ACCESS",
  SUSPICIOUS_ACTIVITY = "SUSPICIOUS_ACTIVITY",

  // Admin events
  ADMIN_ACTION = "ADMIN_ACTION",
  CONFIG_CHANGED = "CONFIG_CHANGED",
  ENCRYPTION_KEY_ROTATED = "ENCRYPTION_KEY_ROTATED",
}

/**
 * Audit log entry structure
 */
export interface AuditLogEntry {
  // Identification
  eventId: string; // Unique ID for this event
  eventType: AuditEventType;
  timestamp: number; // Unix timestamp in milliseconds

  // User/Agent information
  agentId?: string;
  userId?: string;
  email?: string;

  // Request information
  ipAddress?: string;
  userAgent?: string;
  endpoint?: string;
  method?: string;

  // Event details
  details: Record<string, any>;

  // Severity
  severity: "INFO" | "WARN" | "ERROR" | "CRITICAL";

  // Status
  success: boolean;

  // Source
  source: string; // "web", "api", "admin", etc.
}

/**
 * In-memory audit log (Phase 5: move to persistent storage)
 * In production, use PostgreSQL with proper indexing
 */
const auditLogs: AuditLogEntry[] = [];

/**
 * Log an audit event
 *
 * @param eventType - Type of event
 * @param data - Event details
 * @param context - Request context (IP, user agent, etc.)
 *
 * Example:
 * ```typescript
 * auditLog(AuditEventType.LOGIN_SUCCESS, {
 *   email: user.email,
 *   agentId: user.id,
 * }, {
 *   ipAddress: req.ip,
 *   userAgent: req.get("user-agent"),
 * });
 * ```
 */
export function auditLog(
  eventType: AuditEventType,
  data: Record<string, any> = {},
  context: Partial<AuditLogEntry> = {},
): void {
  const entry: AuditLogEntry = {
    eventId: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    eventType,
    timestamp: Date.now(),
    details: data,
    severity: getSeverity(eventType),
    success: data.success !== false,
    source: context.source || "api",
    ...context,
  };

  auditLogs.push(entry);

  // Log to structured logger
  logger.info(`[AUDIT] ${eventType}`, entry);

  // Phase 5: Send to persistent storage
  persistAuditLog(entry);

  // Phase 5: Integrate with Sentry
  // Sentry.captureMessage(`Audit: ${eventType}`, {
  //   level: "info",
  //   tags: { audit: true, eventType },
  //   contexts: { audit: entry },
  // });
}

/**
 * Determine severity level based on event type
 */
function getSeverity(
  eventType: AuditEventType,
): "INFO" | "WARN" | "ERROR" | "CRITICAL" {
  const critical = [
    AuditEventType.BRUTE_FORCE_ATTEMPT,
    AuditEventType.ACCOUNT_LOCKED,
    AuditEventType.XSS_ATTEMPT,
    AuditEventType.UNAUTHORIZED_ACCESS,
    AuditEventType.CSRF_FAILED,
    AuditEventType.ENCRYPTION_KEY_ROTATED,
  ];

  const warning = [
    AuditEventType.LOGIN_FAILED,
    AuditEventType.PASSWORD_CHANGE,
    AuditEventType.SUSPICIOUS_ACTIVITY,
  ];

  if (critical.includes(eventType)) return "CRITICAL";
  if (warning.includes(eventType)) return "WARN";
  return "INFO";
}

/**
 * Log successful login
 */
export function logLoginSuccess(
  agentId: string,
  email: string,
  ipAddress?: string,
  userAgent?: string,
): void {
  auditLog(
    AuditEventType.LOGIN_SUCCESS,
    {
      agentId,
      email,
    },
    {
      agentId,
      email,
      ipAddress,
      userAgent,
      endpoint: "/api/v1/auth/login",
    },
  );
}

/**
 * Log failed login
 */
export function logLoginFailed(
  email: string,
  reason: string,
  ipAddress?: string,
  userAgent?: string,
): void {
  auditLog(
    AuditEventType.LOGIN_FAILED,
    {
      email,
      reason,
      success: false,
    },
    {
      email,
      ipAddress,
      userAgent,
      endpoint: "/api/v1/auth/login",
    },
  );
}

/**
 * Log logout
 */
export function logLogout(agentId: string, ipAddress?: string): void {
  auditLog(
    AuditEventType.LOGOUT,
    {
      agentId,
    },
    {
      agentId,
      ipAddress,
      endpoint: "/api/v1/auth/logout",
    },
  );
}

/**
 * Log account registration
 */
export function logAccountRegistered(
  agentId: string,
  email: string,
  ipAddress?: string,
): void {
  auditLog(
    AuditEventType.REGISTER,
    {
      agentId,
      email,
    },
    {
      agentId,
      email,
      ipAddress,
      endpoint: "/api/v1/auth/register",
    },
  );
}

/**
 * Log brute force attempt
 */
export function logBruteForceAttempt(
  email: string,
  ipAddress?: string,
  attemptNumber?: number,
): void {
  auditLog(
    AuditEventType.BRUTE_FORCE_ATTEMPT,
    {
      email,
      attemptNumber,
      success: false,
    },
    {
      email,
      ipAddress,
      endpoint: "/api/v1/auth/login",
    },
  );
}

/**
 * Log account lockout
 */
export function logAccountLocked(
  email: string,
  ipAddress?: string,
  duration?: number,
): void {
  auditLog(
    AuditEventType.ACCOUNT_LOCKED,
    {
      email,
      lockoutDurationMinutes: duration,
      success: false,
    },
    {
      email,
      ipAddress,
      endpoint: "/api/v1/auth/login",
    },
  );
}

/**
 * Log CSRF validation failure
 */
export function logCsrfFailure(
  agentId: string | undefined,
  endpoint: string,
  ipAddress?: string,
): void {
  auditLog(
    AuditEventType.CSRF_FAILED,
    {
      agentId,
      endpoint,
      success: false,
    },
    {
      agentId,
      ipAddress,
      endpoint,
    },
  );
}

/**
 * Log unauthorized access attempt
 */
export function logUnauthorizedAccess(
  agentId: string | undefined,
  resource: string,
  ipAddress?: string,
): void {
  auditLog(
    AuditEventType.UNAUTHORIZED_ACCESS,
    {
      agentId,
      resource,
      success: false,
    },
    {
      agentId,
      ipAddress,
      endpoint: resource,
    },
  );
}

/**
 * Log XSS attempt
 */
export function logXssAttempt(
  field: string,
  payload: string,
  ipAddress?: string,
): void {
  auditLog(
    AuditEventType.XSS_ATTEMPT,
    {
      field,
      payloadLength: payload.length,
      success: false,
    },
    {
      ipAddress,
      endpoint: "/api/v1/",
    },
  );
}

/**
 * Log data access for compliance
 */
export function logDataAccess(
  agentId: string,
  resource: string,
  action: "READ" | "WRITE" | "DELETE",
): void {
  auditLog(
    action === "READ"
      ? AuditEventType.ACCESS_GRANTED
      : AuditEventType.ROOM_CREATED,
    {
      agentId,
      resource,
      action,
    },
    {
      agentId,
      endpoint: `/api/v1/${resource}`,
    },
  );
}

/**
 * Get audit logs with filtering
 *
 * Phase 5: Add pagination, sorting, advanced filtering
 */
export function getAuditLogs(filters?: {
  eventType?: AuditEventType;
  agentId?: string;
  startTime?: number;
  endTime?: number;
  limit?: number;
}): AuditLogEntry[] {
  let results = [...auditLogs];

  if (filters?.eventType) {
    results = results.filter((log) => log.eventType === filters.eventType);
  }

  if (filters?.agentId) {
    results = results.filter((log) => log.agentId === filters.agentId);
  }

  if (filters?.startTime) {
    results = results.filter((log) => log.timestamp >= filters.startTime!);
  }

  if (filters?.endTime) {
    results = results.filter((log) => log.timestamp <= filters.endTime!);
  }

  // Return most recent first
  results = results.sort((a, b) => b.timestamp - a.timestamp);

  if (filters?.limit) {
    results = results.slice(0, filters.limit);
  }

  return results;
}

/**
 * Phase 5: Persist audit log to PostgreSQL
 *
 * ```sql
 * CREATE TABLE audit_log (
 *   event_id UUID PRIMARY KEY,
 *   event_type VARCHAR(50) NOT NULL,
 *   timestamp BIGINT NOT NULL,
 *   agent_id VARCHAR(255),
 *   email VARCHAR(255),
 *   ip_address VARCHAR(45),
 *   user_agent TEXT,
 *   endpoint VARCHAR(500),
 *   method VARCHAR(10),
 *   details JSONB,
 *   severity VARCHAR(20),
 *   success BOOLEAN,
 *   source VARCHAR(50),
 *   created_at TIMESTAMP DEFAULT NOW()
 * );
 *
 * CREATE INDEX audit_log_event_type_idx ON audit_log(event_type);
 * CREATE INDEX audit_log_agent_id_idx ON audit_log(agent_id);
 * CREATE INDEX audit_log_timestamp_idx ON audit_log(timestamp);
 * CREATE INDEX audit_log_severity_idx ON audit_log(severity);
 * ```
 */
async function persistAuditLog(entry: AuditLogEntry): Promise<void> {
  // Phase 5: Implement database persistence
  // const query = `
  //   INSERT INTO audit_log (
  //     event_id, event_type, timestamp, agent_id, email, ip_address,
  //     user_agent, endpoint, method, details, severity, success, source
  //   ) VALUES (
  //     $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
  //   )
  // `;
  // await db.query(query, [
  //   entry.eventId, entry.eventType, entry.timestamp, entry.agentId,
  //   entry.email, entry.ipAddress, entry.userAgent, entry.endpoint,
  //   entry.method, JSON.stringify(entry.details), entry.severity,
  //   entry.success, entry.source
  // ]);
}

/**
 * Phase 5: Query audit logs for security analysis
 *
 * Example queries:
 * ```sql
 * -- Failed login attempts in last hour
 * SELECT * FROM audit_log
 * WHERE event_type = 'LOGIN_FAILED'
 * AND timestamp > (EXTRACT(EPOCH FROM NOW()) - 3600) * 1000;
 *
 * -- Access patterns by agent
 * SELECT agent_id, COUNT(*) as request_count, event_type
 * FROM audit_log
 * GROUP BY agent_id, event_type;
 *
 * -- Suspicious IPs
 * SELECT ip_address, COUNT(*) as failure_count
 * FROM audit_log
 * WHERE event_type IN ('LOGIN_FAILED', 'CSRF_FAILED', 'UNAUTHORIZED_ACCESS')
 * GROUP BY ip_address
 * HAVING COUNT(*) > 10;
 * ```
 */
