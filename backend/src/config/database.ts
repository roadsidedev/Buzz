/**
 * Database Configuration
 * PostgreSQL connection pool setup
 */

import { Pool, PoolClient } from "pg";
import { logger } from "../utils/logger";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

/**
 * PostgreSQL connection pool
 */
const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 20, // Maximum pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

/**
 * Alias for pool - for backwards compatibility
 */
export const db = pool;
export { pool };

/**
 * Database class for type compatibility
 */
export class Database {
  private pool: typeof pool;

  constructor() {
    this.pool = pool;
  }

  getPool() {
    return this.pool;
  }

  /**
   * Execute query with connection from pool
   */
  async query<T extends Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<T[]> {
    try {
      const result = await this.pool.query<T>(text, values);
      return result.rows;
    } catch (error) {
      logger.error("Database query failed", error, {
        query: text.substring(0, 100),
      });
      throw error;
    }
  }
}

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
  values?: unknown[],
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
  values?: unknown[],
): Promise<T | null> {
  const results = await query<T>(text, values);
  return results.length > 0 ? results[0] : null;
}

/**
 * Run essential schema migrations that must be present for the application to
 * function correctly.  Each statement is idempotent (uses IF NOT EXISTS / DO
 * NOTHING patterns) so it is safe to run on every startup.
 *
 * This covers migrations that may not have been applied via the manual SQL
 * files, e.g. when the database was provisioned before a migration was added.
 */
export async function runStartupMigrations(): Promise<void> {
  const client: PoolClient = await pool.connect();

  try {
    await client.query("BEGIN");

    // ── Migration 011: agent Jam / ERC-8004 identity columns ────────────────
    // These columns are referenced by room-service.ts when creating V2 Jam
    // rooms with SSR auth.  Without them every room creation attempt throws
    // "column jam_public_key of relation agent does not exist".
    await client.query(`
      ALTER TABLE agent
        ADD COLUMN IF NOT EXISTS jam_public_key           VARCHAR(128),
        ADD COLUMN IF NOT EXISTS jam_private_key_encrypted TEXT,
        ADD COLUMN IF NOT EXISTS jam_identity_id          VARCHAR(128),
        ADD COLUMN IF NOT EXISTS erc8004_identity         TEXT
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_agent_jam_identity
        ON agent(jam_identity_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_agent_erc8004_identity
        ON agent(erc8004_identity)
    `);

    // ── Migration 010: jam_room_url on room table ───────────────────────────
    await client.query(`
      ALTER TABLE room
        ADD COLUMN IF NOT EXISTS jam_room_url TEXT
    `);

    // ── Migration 011 (room): pantry / self-hosted SFU columns ─────────────
    await client.query(`
      ALTER TABLE room
        ADD COLUMN IF NOT EXISTS pantry_room_id    VARCHAR(128),
        ADD COLUMN IF NOT EXISTS pantry_sfu_enabled BOOLEAN DEFAULT false
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_room_pantry_room_id
        ON room(pantry_room_id)
    `);

    await client.query("COMMIT");

    logger.info("Startup schema migrations applied successfully");
  } catch (err) {
    await client.query("ROLLBACK");
    // Non-fatal: log the error but don't crash the server.
    // The application may still work if the columns already exist or the
    // relevant features (V2 Jam) are not in use.
    logger.error("Startup schema migration failed (non-fatal)", {
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    client.release();
  }
}
