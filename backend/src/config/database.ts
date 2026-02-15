/**
 * Database Configuration
 * PostgreSQL connection pool setup
 */

import { Pool, PoolClient } from "pg";
import { logger } from "../utils/logger.js";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

/**
 * PostgreSQL connection pool
 */
export const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 20, // Maximum pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

/**
 * Log pool events
 */
pool.on("connect", () => {
  logger.debug("New database connection created");
});

pool.on("error", (err) => {
  logger.error("Unexpected error on idle client", err);
});

/**
 * Test database connection
 */
export async function testConnection(): Promise<void> {
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();
    const result = await client.query("SELECT NOW()");
    logger.info("Database connection successful", {
      timestamp: result.rows[0].now,
    });
  } catch (error) {
    logger.error("Database connection failed", error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
}

/**
 * Close pool connections
 */
export async function closePool(): Promise<void> {
  await pool.end();
  logger.info("Database connection pool closed");
}

/**
 * Execute query with connection from pool
 */
export async function query<T extends Record<string, unknown>>(
  text: string,
  values?: unknown[]
): Promise<T[]> {
  try {
    const result = await pool.query<T>(text, values);
    return result.rows;
  } catch (error) {
    logger.error("Database query failed", error, {
      query: text.substring(0, 100),
    });
    throw error;
  }
}

/**
 * Execute query returning single row
 */
export async function queryOne<T extends Record<string, unknown>>(
  text: string,
  values?: unknown[]
): Promise<T | null> {
  const results = await query<T>(text, values);
  return results.length > 0 ? results[0] : null;
}
