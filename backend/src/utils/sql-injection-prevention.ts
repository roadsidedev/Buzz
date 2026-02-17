/**
 * SQL Injection Prevention Utility
 *
 * Provides safe SQL query construction and input validation
 * to prevent SQL injection attacks.
 *
 * Security Features:
 * - Identifier validation (table names, column names)
 * - Search query sanitization
 * - Query builder with automatic parameterization
 * - Input length limits
 * - Dangerous pattern detection
 */

import { logger } from "./logger.js";

/**
 * Valid SQL identifier pattern
 * Only allows alphanumeric characters and underscores
 * Must start with a letter
 */
const VALID_IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * Maximum length for identifiers
 */
const MAX_IDENTIFIER_LENGTH = 64;

/**
 * Maximum length for search queries
 */
const MAX_SEARCH_QUERY_LENGTH = 200;

/**
 * Dangerous SQL keywords that shouldn't appear in user input
 */
const DANGEROUS_PATTERNS = [
  /;\s*drop\s+/i,
  /;\s*delete\s+/i,
  /;\s*insert\s+/i,
  /;\s*update\s+/i,
  /union\s+select/i,
  /exec\s*\(/i,
  /execute\s*\(/i,
  /xp_/i,
  /sp_/i,
  /'\s*or\s+'/i,
  /'\s*or\s+\d+\s*=\s*\d+/i,
  /--/,
  /\/\*/,
  /\*\//,
];

/**
 * SQL Injection Error
 */
export class SQLInjectionError extends Error {
  constructor(
    message: string,
    public context?: { input?: string; pattern?: string; field?: string },
  ) {
    super(message);
    this.name = "SQLInjectionError";
  }
}

/**
 * Validate SQL identifier (table name, column name, etc.)
 * Prevents injection through identifiers
 *
 * @param identifier - Table or column name
 * @param fieldName - Name of the field for error messages
 * @returns Sanitized identifier
 * @throws SQLInjectionError if identifier is invalid
 */
export function validateIdentifier(
  identifier: string,
  fieldName: string = "identifier",
): string {
  if (!identifier) {
    throw new SQLInjectionError(`${fieldName} is required`, {
      field: fieldName,
    });
  }

  if (identifier.length > MAX_IDENTIFIER_LENGTH) {
    throw new SQLInjectionError(
      `${fieldName} exceeds maximum length of ${MAX_IDENTIFIER_LENGTH}`,
      { input: identifier.substring(0, 50) + "...", field: fieldName },
    );
  }

  if (!VALID_IDENTIFIER_PATTERN.test(identifier)) {
    throw new SQLInjectionError(
      `${fieldName} contains invalid characters. Only letters, numbers, and underscores allowed`,
      { input: identifier, field: fieldName },
    );
  }

  // Check against SQL reserved words
  const reservedWords = [
    "select",
    "insert",
    "update",
    "delete",
    "drop",
    "create",
    "alter",
    "table",
    "from",
    "where",
    "and",
    "or",
    "not",
    "null",
    "true",
    "false",
  ];

  if (reservedWords.includes(identifier.toLowerCase())) {
    throw new SQLInjectionError(`${fieldName} cannot be a SQL reserved word`, {
      input: identifier,
      field: fieldName,
    });
  }

  return identifier;
}

/**
 * Sanitize full-text search query
 * Removes dangerous characters and limits length
 *
 * @param query - User-provided search query
 * @returns Sanitized query safe for plainto_tsquery
 */
export function sanitizeSearchQuery(query: string): string {
  if (!query) {
    return "";
  }

  if (query.length > MAX_SEARCH_QUERY_LENGTH) {
    logger.warn("Search query truncated", {
      originalLength: query.length,
      maxLength: MAX_SEARCH_QUERY_LENGTH,
    });
    query = query.substring(0, MAX_SEARCH_QUERY_LENGTH);
  }

  // Check for dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(query)) {
      logger.error("Potentially dangerous search query detected", {
        query: query.substring(0, 100),
        pattern: pattern.toString(),
      });
      throw new SQLInjectionError("Search query contains invalid characters", {
        input: query.substring(0, 100),
        pattern: pattern.toString(),
      });
    }
  }

  // Escape special PostgreSQL full-text search characters
  // These characters have special meaning in tsquery
  const sanitized = query
    .replace(/[|&!()]/g, " ") // Remove operators that could manipulate search
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();

  return sanitized;
}

/**
 * Build safe ORDER BY clause
 * Prevents injection through sort columns
 *
 * @param sortColumn - Column to sort by
 * @param sortOrder - Sort direction ('asc' or 'desc')
 * @returns Safe ORDER BY clause
 */
export function buildOrderByClause(
  sortColumn: string,
  sortOrder: "asc" | "desc" = "desc",
): string {
  const validColumn = validateIdentifier(sortColumn, "sortColumn");
  const validOrder = sortOrder.toLowerCase() === "asc" ? "ASC" : "DESC";

  return `${validColumn} ${validOrder}`;
}

/**
 * Build safe LIMIT/OFFSET clause
 * Validates numeric parameters
 *
 * @param limit - Maximum rows to return
 * @param offset - Number of rows to skip
 * @returns Object with validated limit and offset
 */
export function buildPaginationParams(
  limit: number | string,
  offset: number | string = 0,
  maxLimit: number = 100,
): { limit: number; offset: number } {
  const parsedLimit = Math.min(
    Math.max(1, parseInt(String(limit), 10) || 20),
    maxLimit,
  );
  const parsedOffset = Math.max(0, parseInt(String(offset), 10) || 0);

  return { limit: parsedLimit, offset: parsedOffset };
}

/**
 * Query Builder for safe dynamic SQL
 * Automatically parameterizes values
 */
export class SafeQueryBuilder {
  private sql: string = "";
  private params: any[] = [];
  private whereClauses: string[] = [];
  private paramCounter: number = 0;

  /**
   * Start a SELECT query
   */
  select(columns: string[], table: string): this {
    const validColumns = columns.map((col) =>
      validateIdentifier(col, "column"),
    );
    const validTable = validateIdentifier(table, "table");

    this.sql = `SELECT ${validColumns.join(", ")} FROM ${validTable}`;
    return this;
  }

  /**
   * Add WHERE clause with parameterized value
   */
  where(column: string, operator: string, value: any): this {
    const validColumn = validateIdentifier(column, "column");

    // Validate operator to prevent injection
    const validOperators = [
      "=",
      "!=",
      "<>",
      ">",
      "<",
      ">=",
      "<=",
      "LIKE",
      "ILIKE",
    ];
    if (!validOperators.includes(operator.toUpperCase())) {
      throw new SQLInjectionError(`Invalid operator: ${operator}`);
    }

    this.paramCounter++;
    this.whereClauses.push(`${validColumn} ${operator} $${this.paramCounter}`);
    this.params.push(value);

    return this;
  }

  /**
   * Add WHERE IN clause
   */
  whereIn(column: string, values: any[]): this {
    const validColumn = validateIdentifier(column, "column");

    if (!values.length) {
      throw new SQLInjectionError("whereIn requires at least one value");
    }

    const placeholders = values
      .map(() => {
        this.paramCounter++;
        return `$${this.paramCounter}`;
      })
      .join(", ");

    this.whereClauses.push(`${validColumn} IN (${placeholders})`);
    this.params.push(...values);

    return this;
  }

  /**
   * Add ORDER BY clause
   */
  orderBy(column: string, direction: "asc" | "desc" = "desc"): this {
    const orderClause = buildOrderByClause(column, direction);
    this.sql += ` ORDER BY ${orderClause}`;
    return this;
  }

  /**
   * Add LIMIT and OFFSET
   */
  limit(limit: number, offset?: number): this {
    this.paramCounter++;
    this.sql += ` LIMIT $${this.paramCounter}`;
    this.params.push(limit);

    if (offset !== undefined) {
      this.paramCounter++;
      this.sql += ` OFFSET $${this.paramCounter}`;
      this.params.push(offset);
    }

    return this;
  }

  /**
   * Build the final query
   */
  build(): { text: string; values: any[] } {
    if (this.whereClauses.length > 0) {
      this.sql += " WHERE " + this.whereClauses.join(" AND ");
    }

    return { text: this.sql, values: this.params };
  }
}

/**
 * Validate that a value is safe to use in a query
 * Checks type and content
 *
 * @param value - Value to validate
 * @param fieldName - Name of the field
 * @returns Validated value
 */
export function validateQueryValue(value: any, fieldName: string): any {
  // Allow null, undefined, strings, numbers, booleans, dates
  if (value === null || value === undefined) {
    return value;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (value instanceof Date) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((v) => validateQueryValue(v, fieldName));
  }

  throw new SQLInjectionError(
    `Invalid value type for ${fieldName}: ${typeof value}`,
    { field: fieldName },
  );
}

/**
 * Check if a string contains SQL injection patterns
 * Useful for logging and monitoring
 *
 * @param input - String to check
 * @returns Object with isSafe flag and detected patterns
 */
export function checkSQLInjection(input: string): {
  isSafe: boolean;
  patterns: string[];
} {
  const patterns: string[] = [];

  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(input)) {
      patterns.push(pattern.toString());
    }
  }

  return {
    isSafe: patterns.length === 0,
    patterns,
  };
}

/**
 * Middleware to validate and sanitize SQL-related inputs
 * Can be used in Express routes
 */
export function sqlInjectionPrevention() {
  return (req: any, res: any, next: any) => {
    // Check common injection vectors in query params
    const checkParams = (params: any, source: string) => {
      for (const [key, value] of Object.entries(params)) {
        if (typeof value === "string") {
          const check = checkSQLInjection(value);
          if (!check.isSafe) {
            logger.error(`SQL injection attempt detected in ${source}`, {
              key,
              value: value.substring(0, 100),
              patterns: check.patterns,
              ip: req.ip,
              userAgent: req.get("user-agent"),
            });
            return res.status(400).json({
              error: "Invalid input detected",
              code: "INVALID_INPUT",
            });
          }
        }
      }
    };

    checkParams(req.query, "query");
    checkParams(req.body, "body");
    checkParams(req.params, "params");

    next();
  };
}
