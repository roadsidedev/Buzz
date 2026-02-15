/**
 * Security Configuration
 *
 * Centralized security settings:
 * - XSS prevention (input sanitization)
 * - CORS configuration
 * - Content Security Policy recommendations
 * - Token storage strategies
 * - Input validation rules
 */

/**
 * Content Security Policy headers to suggest backend
 *
 * These headers should be sent by the API gateway in response headers.
 * They prevent XSS, clickjacking, and other attacks.
 *
 * Backend should add these via middleware:
 * ```typescript
 * app.use((req, res, next) => {
 *   res.setHeader("Content-Security-Policy", CSP_HEADERS["Content-Security-Policy"]);
 *   // ... other headers
 *   next();
 * });
 * ```
 */
export const CSP_HEADERS = {
  "Content-Security-Policy":
    "default-src 'self'; " +
    "script-src 'self' 'wasm-unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "font-src 'self'; " +
    "connect-src 'self' https:; " +
    "frame-ancestors 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};

/**
 * CORS Configuration to send to backend
 *
 * Backend should allow requests matching these settings:
 * ```typescript
 * import cors from "cors";
 * app.use(cors(CORS_CONFIG));
 * ```
 */
export const CORS_CONFIG = {
  origin: [
    "http://localhost:5173", // Vite dev server
    "http://localhost:3000", // Production frontend
    process.env.VITE_FRONTEND_URL, // Environment override
  ].filter(Boolean),
  credentials: true, // Allow cookies in cross-origin requests
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["X-Total-Count", "X-Page-Number"], // Custom headers
  maxAge: 86400, // 24 hours (preflight cache)
};

/**
 * Token Storage Strategies
 *
 * Different approaches to storing auth tokens:
 */
export enum TokenStorageType {
  /** localStorage persists across browser close (XSS risk) */
  LOCAL_STORAGE = "localStorage",

  /** sessionStorage cleared on tab close (better XSS resilience) */
  SESSION_STORAGE = "sessionStorage",

  /** Memory cleared on page reload (least persistent) */
  MEMORY = "memory",

  /** httpOnly cookies (ideal - set by backend only, no JS access) */
  HTTP_ONLY_COOKIE = "httpOnly",
}

/**
 * Get recommended token storage type
 *
 * Returns different strategies based on environment:
 * - Production: sessionStorage (XSS resilience)
 * - Development: localStorage (session persistence across reloads)
 *
 * Future upgrade: httpOnly cookies (requires backend support)
 *
 * @returns Recommended storage type
 */
export function getRecommendedStorageType(): TokenStorageType {
  if (import.meta.env.PROD) {
    // Production: Prefer sessionStorage for security
    // Tokens cleared when tab closes, limits XSS impact duration
    return TokenStorageType.SESSION_STORAGE;
  }

  // Development: Use localStorage for convenience
  // Tokens persist across dev server reloads
  return TokenStorageType.LOCAL_STORAGE;
}

/**
 * Sanitization rules for different input types
 *
 * Defines what characters/patterns are allowed for user inputs
 * that will be sent to API or used in LLM prompts.
 */
export const SANITIZE_INPUTS = {
  /**
   * Room objective - sent to orchestrator LLM
   * Must be safe for prompt injection
   */
  roomObjective: {
    maxLength: 500,
    minLength: 10,
    pattern: /^[a-zA-Z0-9\s\-.,!?'()"]*$/,
    disallowedChars: ["<", ">", "{", "}", "&", ";", "`"],
    description: "Room objective (topic, goal)",
  },

  /**
   * Agent message - scored by orchestrator
   * Could be used in prompts or logging
   */
  agentMessage: {
    maxLength: 2000,
    minLength: 1,
    pattern: /^[a-zA-Z0-9\s\-.,!?'()"]*$/,
    disallowedChars: ["<", ">"],
    description: "Agent message",
  },

  /**
   * Search query - sent to discovery endpoint
   * Should be safe for database queries
   */
  searchQuery: {
    maxLength: 200,
    minLength: 1,
    pattern: /^[a-zA-Z0-9\s\-.,]*$/,
    disallowedChars: ["<", ">", "{", "}", ";"],
    description: "Search query",
  },

  /**
   * Username - stored in database
   * Used for profiles and identification
   */
  username: {
    maxLength: 50,
    minLength: 3,
    pattern: /^[a-zA-Z0-9\-_]*$/,
    disallowedChars: ["<", ">", " "],
    description: "Username",
  },

  /**
   * Display name - shown publicly
   * Could contain special characters but not HTML
   */
  displayName: {
    maxLength: 100,
    minLength: 1,
    pattern: /^[a-zA-Z0-9\s\-.,!?'()\"]*$/,
    disallowedChars: ["<", ">", "{", "}", ";"],
    description: "Display name",
  },
};

/**
 * Sanitization configuration type
 */
export interface SanitizationConfig {
  maxLength?: number;
  minLength?: number;
  pattern?: RegExp;
  disallowedChars?: string[];
  description?: string;
}

/**
 * Sanitize user input
 *
 * Removes potentially harmful characters and enforces length/pattern limits.
 * Should be done on frontend BEFORE sending to backend.
 * Backend should do its own validation independently.
 *
 * This prevents:
 * - XSS via input field
 * - Prompt injection to LLMs
 * - SQL injection (mitigated by backend parameterization)
 * - Command injection attacks
 *
 * @param input - Raw user input string
 * @param config - Sanitization rules to apply
 * @returns Sanitized string
 *
 * @example
 * ```typescript
 * const userObjective = "<script>alert('xss')</script>";
 * const safe = sanitizeInput(userObjective, SANITIZE_INPUTS.roomObjective);
 * // Returns: "scriptalertxssscript" (invalid, but at least no tags)
 *
 * // Better approach - validate pattern:
 * if (!SANITIZE_INPUTS.roomObjective.pattern.test(userObjective)) {
 *   throw new Error("Invalid characters in objective");
 * }
 * ```
 */
export function sanitizeInput(
  input: string,
  config: SanitizationConfig
): string {
  if (!input) return "";

  let sanitized = String(input).trim();

  // Remove disallowed characters
  if (config.disallowedChars && config.disallowedChars.length > 0) {
    const charPattern = new RegExp(
      `[${config.disallowedChars.map((c) => c.replace(/[-[\]{}()*+?.\\^$|#\s]/g, "\\$&")).join("")}]`,
      "g"
    );
    sanitized = sanitized.replace(charPattern, "");
  }

  // Enforce length limits
  if (config.minLength && sanitized.length < config.minLength) {
    throw new Error(
      `Input too short (minimum ${config.minLength} characters)`
    );
  }

  if (config.maxLength) {
    if (sanitized.length > config.maxLength) {
      throw new Error(
        `Input too long (maximum ${config.maxLength} characters)`
      );
    }
  }

  // Enforce pattern if specified
  if (config.pattern) {
    // Check if entire string matches pattern
    if (!config.pattern.test(sanitized)) {
      throw new Error(
        `Input contains invalid characters (${config.description})`
      );
    }
  }

  return sanitized;
}

/**
 * Validate email address
 *
 * Uses HTML5 email validation pattern.
 * Backend should validate independently.
 *
 * @param email - Email string to validate
 * @returns True if valid format
 */
export function validateEmail(email: string): boolean {
  const pattern =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return pattern.test(email);
}

/**
 * Validate password strength
 *
 * Requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 *
 * @param password - Password string to validate
 * @returns Object with validation result and specific failures
 */
export function validatePassword(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters");
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }

  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push("Password must contain at least one special character");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Escape HTML special characters
 *
 * Prevents XSS when displaying user-provided content.
 * Use in template display, not for storage.
 *
 * @param text - Text to escape
 * @returns Escaped text safe for HTML display
 *
 * @example
 * ```typescript
 * const userComment = `<img src=x onerror="alert('xss')">`;
 * const safe = escapeHtml(userComment);
 * // "<img src=x onerror=\"alert('xss')\">" (safe to display)
 * ```
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };

  return text.replace(/[&<>"']/g, (char) => map[char]);
}

/**
 * Security utility: Check if string contains suspicious patterns
 *
 * Detects common attack patterns:
 * - Script tags
 * - Event handlers
 * - SQL keywords (basic)
 * - File protocol (javascript:, file://)
 *
 * @param input - String to check
 * @returns True if suspicious pattern detected
 */
export function isSuspiciousInput(input: string): boolean {
  const suspiciousPatterns = [
    /<script/i,
    /on\w+\s*=/i, // onclick=, onerror=, etc.
    /javascript:/i,
    /file:\/\//i,
    /union\s+select/i,
    /drop\s+table/i,
    /insert\s+into/i,
    /delete\s+from/i,
  ];

  return suspiciousPatterns.some((pattern) => pattern.test(input));
}
