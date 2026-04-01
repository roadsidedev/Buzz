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
  max: 50, // L6: raised from 20 — at 100 concurrent users each holding a ~300 ms connection the old pool exhausted
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  // Fail fast rather than queuing indefinitely when the pool is saturated.
  // 5 s is long enough for momentary spikes but short enough to surface bottlenecks.
  query_timeout: 5000,
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
        ADD COLUMN IF NOT EXISTS erc8004_identity         TEXT,
        ADD COLUMN IF NOT EXISTS name                     VARCHAR(255),
        ADD COLUMN IF NOT EXISTS avatar                   TEXT,
        ADD COLUMN IF NOT EXISTS description              TEXT,
        ADD COLUMN IF NOT EXISTS api_key                  VARCHAR(255),
        ADD COLUMN IF NOT EXISTS claim_token              VARCHAR(255),
        ADD COLUMN IF NOT EXISTS claim_status             VARCHAR(50) DEFAULT 'pending_claim',
        ADD COLUMN IF NOT EXISTS role                     VARCHAR(50) DEFAULT 'agent',
        ADD COLUMN IF NOT EXISTS twitter_handle           VARCHAR(100),
        ADD COLUMN IF NOT EXISTS twitter_verified         BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS owner_email              VARCHAR(255),
        ADD COLUMN IF NOT EXISTS owner_email_verified     BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS twitter_verification_code VARCHAR(100),
        ADD COLUMN IF NOT EXISTS verification_status      VARCHAR(50) DEFAULT 'unverified'
    `);

    // Relax NOT NULL constraints for Moltbook-style human users
    await client.query(`
      ALTER TABLE agent 
        ALTER COLUMN llm_provider DROP NOT NULL,
        ALTER COLUMN llm_model DROP NOT NULL,
        ALTER COLUMN display_name DROP NOT NULL
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_agent_api_key ON agent(api_key)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_agent_claim_token ON agent(claim_token)
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

    // ── Migration: Room Scheduling ───────────────────────────────────────
    await client.query(`
      ALTER TABLE room
        ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMP WITH TIME ZONE NULL
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS room_notification (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        room_id       UUID NOT NULL,
        agent_id      UUID NOT NULL,
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id)  REFERENCES room(id)  ON DELETE CASCADE,
        FOREIGN KEY (agent_id) REFERENCES agent(id) ON DELETE CASCADE,
        UNIQUE(room_id, agent_id)
      )
    `);

    // ── Migration: User Notifications ─────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_notification (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id       VARCHAR(255) NOT NULL,
        title         VARCHAR(255) NOT NULL,
        message       TEXT,
        link          VARCHAR(1024),
        is_read       BOOLEAN DEFAULT false,
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_notif_user 
        ON user_notification(user_id, created_at DESC)
    `);

    // ── Migration 011 (room): pantry / self-hosted SFU columns ─────────────
    await client.query(`
      ALTER TABLE room
        ADD COLUMN IF NOT EXISTS pantry_room_id    VARCHAR(128),
        ADD COLUMN IF NOT EXISTS pantry_sfu_enabled BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS category_id       UUID REFERENCES category(id) ON DELETE SET NULL
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_room_pantry_room_id
        ON room(pantry_room_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_room_category
        ON room(category_id)
    `);

    // ── Migration: Discovery & Engagement Tables ──────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS category (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name        VARCHAR(100) NOT NULL UNIQUE,
        slug        VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        icon_url    VARCHAR(2048),
        color       VARCHAR(50),
        order_index INT DEFAULT 0,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS room_viewers (
        room_id      UUID PRIMARY KEY REFERENCES room(id) ON DELETE CASCADE,
        viewer_count INT DEFAULT 0,
        updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS room_engagement (
        room_id         UUID PRIMARY KEY REFERENCES room(id) ON DELETE CASCADE,
        total_messages  INT DEFAULT 0,
        engagement_rate DECIMAL(10,4) DEFAULT 0,
        trending_score  DECIMAL(10,4) DEFAULT 0,
        updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Seed default categories if none exist
    const catCheck = await client.query("SELECT COUNT(*) FROM category");
    if (parseInt(catCheck.rows[0].count) === 0) {
      const categories = [
        { name: "Debate", slug: "debate", color: "#EF4444" },
        { name: "Coding", slug: "coding", color: "#10B981" },
        { name: "Research", slug: "research", color: "#3B82F6" },
        { name: "Trading", slug: "trading", color: "#F59E0B" },
        { name: "Simulation", slug: "simulation", color: "#8B5CF6" },
        { name: "Podcast", slug: "podcast", color: "#EC4899" }
      ];
      
      for (const cat of categories) {
        await client.query(
          "INSERT INTO category (name, slug, color) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
          [cat.name, cat.slug, cat.color]
        );
      }
    }

    // ── Migration 003: podcast tables ────────────────────────────────────────
    // The original SQL file used MySQL-style INDEX clauses inside CREATE TABLE
    // blocks, which PostgreSQL rejects.  We create the tables here with valid
    // PostgreSQL syntax so they exist regardless of whether the file was applied.

    await client.query(`
      CREATE TABLE IF NOT EXISTS podcast (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id         UUID NOT NULL,
        title            VARCHAR(255) NOT NULL,
        description      TEXT,
        category         VARCHAR(50),
        cover_image_url  VARCHAR(2048),
        status           VARCHAR(50) DEFAULT 'active',
        created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (agent_id) REFERENCES agent(id) ON DELETE CASCADE
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS podcast_episode (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        podcast_id          UUID NOT NULL,
        title               VARCHAR(255) NOT NULL,
        description         TEXT,
        transcript          TEXT,
        audio_url           VARCHAR(2048),
        duration_seconds    INT,
        audio_format        VARCHAR(20) DEFAULT 'mp3',
        status              VARCHAR(50) DEFAULT 'draft',
        generated_at        TIMESTAMP,
        published_at        TIMESTAMP,
        created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (podcast_id) REFERENCES podcast(id) ON DELETE CASCADE
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS podcast_distribution (
        id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        episode_id           UUID NOT NULL,
        platform             VARCHAR(50) NOT NULL,
        platform_episode_id  VARCHAR(255),
        platform_url         VARCHAR(2048),
        status               VARCHAR(50) DEFAULT 'pending',
        error_message        TEXT,
        distributed_at       TIMESTAMP,
        updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (episode_id) REFERENCES podcast_episode(id) ON DELETE CASCADE,
        UNIQUE(episode_id, platform)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS podcast_subscription (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id      UUID NOT NULL,
        podcast_id    UUID NOT NULL,
        tier          VARCHAR(50) DEFAULT 'free',
        subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        renewed_at    TIMESTAMP,
        expires_at    TIMESTAMP,
        status        VARCHAR(50) DEFAULT 'active',
        FOREIGN KEY (agent_id)   REFERENCES agent(id)   ON DELETE CASCADE,
        FOREIGN KEY (podcast_id) REFERENCES podcast(id) ON DELETE CASCADE,
        UNIQUE(agent_id, podcast_id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS podcast_generation_cost (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        episode_id            UUID NOT NULL,
        generation_cost_usdc  DECIMAL(18,6) NOT NULL,
        platform_fee_usdc     DECIMAL(18,6) DEFAULT 0,
        platform_revenue_usdc DECIMAL(18,6) DEFAULT 0,
        payment_status        VARCHAR(50) DEFAULT 'pending',
        paid_at               TIMESTAMP,
        created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (episode_id) REFERENCES podcast_episode(id) ON DELETE CASCADE
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS podcast_analytics (
        id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        episode_id                  UUID NOT NULL,
        total_listens               INT DEFAULT 0,
        unique_listeners            INT DEFAULT 0,
        completion_rate             DECIMAL(5,2) DEFAULT 0,
        average_listen_time_seconds INT DEFAULT 0,
        replays                     INT DEFAULT 0,
        shares                      INT DEFAULT 0,
        comments                    INT DEFAULT 0,
        recorded_at                 TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (episode_id) REFERENCES podcast_episode(id) ON DELETE CASCADE
      )
    `);

    // Podcast indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_podcast_agent    ON podcast(agent_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_podcast_category  ON podcast(category)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_podcast_by_agent  ON podcast(agent_id, created_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_episode_podcast   ON podcast_episode(podcast_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_episode_status    ON podcast_episode(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_episode_status_created ON podcast_episode(status, created_at ASC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_distribution_episode  ON podcast_distribution(episode_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_distribution_platform ON podcast_distribution(platform)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_subscription_agent   ON podcast_subscription(agent_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_subscription_podcast ON podcast_subscription(podcast_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cost_episode          ON podcast_generation_cost(episode_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_analytics_episode     ON podcast_analytics(episode_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_podcast_trending      ON podcast_analytics(recorded_at DESC)`);

    // Podcast-related columns on existing tables
    await client.query(`ALTER TABLE agent ADD COLUMN IF NOT EXISTS podcast_specialization VARCHAR(100)`);

    // ── Migration 015: dialogue format support for podcast_episode ──────────
    await client.query(`
      ALTER TABLE podcast_episode
        ADD COLUMN IF NOT EXISTS format VARCHAR(20) NOT NULL DEFAULT 'monologue',
        ADD COLUMN IF NOT EXISTS secondary_voice_id VARCHAR(100)
    `);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'chk_episode_format'
          AND table_name = 'podcast_episode'
        ) THEN
          ALTER TABLE podcast_episode
            ADD CONSTRAINT chk_episode_format CHECK (format IN ('monologue', 'dialogue'));
        END IF;
      END $$
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_episode_format ON podcast_episode(format)`);

    // Podcast timestamp triggers
    await client.query(`
      CREATE OR REPLACE FUNCTION update_podcast_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger WHERE tgname = 'podcast_update_timestamp'
        ) THEN
          CREATE TRIGGER podcast_update_timestamp
            BEFORE UPDATE ON podcast
            FOR EACH ROW EXECUTE FUNCTION update_podcast_timestamp();
        END IF;
      END $$
    `);

    await client.query(`
      CREATE OR REPLACE FUNCTION update_episode_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger WHERE tgname = 'episode_update_timestamp'
        ) THEN
          CREATE TRIGGER episode_update_timestamp
            BEFORE UPDATE ON podcast_episode
            FOR EACH ROW EXECUTE FUNCTION update_episode_timestamp();
        END IF;
      END $$
    `);

    // ── Migration 014: room recording columns ─────────────────────────────
    // Required by room-repository SELECT queries. Without these columns every
    // GET /rooms/:id returns a DB error which the frontend shows as
    // "Room not found or unavailable."
    await client.query(`
      ALTER TABLE room
        ADD COLUMN IF NOT EXISTS recording_enabled  BOOLEAN                   NOT NULL DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS recording_url      TEXT,
        ADD COLUMN IF NOT EXISTS recording_started_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS recording_ended_at   TIMESTAMP WITH TIME ZONE
    `);

    // ── Migration 018: Missing discovery & room lifecycle columns ──────────
    // Fixes 500 errors on /discover/live-now, /discover/recently-ended,
    // and room heartbeat/participant tracking.
    //
    // Root cause: The discovery queries reference tables and columns that were
    // never created by any migration or startup script.

    // 1. room_participant table — referenced by discovery-service.ts getLiveNow()
    //    subqueries (speaker lists, participant counts), room-repository.ts
    //    addParticipant(), and migration 017 (which ALTERs it but never CREATEs).
    await client.query(`
      CREATE TABLE IF NOT EXISTS room_participant (
        room_id    UUID NOT NULL REFERENCES room(id) ON DELETE CASCADE,
        agent_id   UUID NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
        role       VARCHAR(50) NOT NULL DEFAULT 'speaker',
        status     VARCHAR(50) NOT NULL DEFAULT 'joined',
        joined_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        left_at    TIMESTAMP WITH TIME ZONE,
        PRIMARY KEY (room_id, agent_id)
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_room_participant_room
        ON room_participant(room_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_room_participant_agent
        ON room_participant(agent_id)
    `);

    // 2. recording_available — referenced by /discover/recently-ended
    //    (WHERE recording_available = TRUE) and room-repository.ts
    //    setRecordingAvailable().  Migration 014 adds recording_enabled
    //    but skips this column.
    await client.query(`
      ALTER TABLE room
        ADD COLUMN IF NOT EXISTS recording_available BOOLEAN NOT NULL DEFAULT FALSE
    `);

    // 3. last_seen_at — heartbeat column used by discovery-service.ts
    //    getLiveNow() to filter stale rooms and by room-repository.ts
    //    updateHeartbeat().
    await client.query(`
      ALTER TABLE room
        ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_room_last_seen
        ON room(last_seen_at) WHERE status = 'live'
    `);

    // 3b. last_turn_at / turn_count / completion_percentage — used by
    //     room-repository.ts updateTurn() and updateCompletionPercentage().
    //     Without these the orchestrator crashes on every turn.
    await client.query(`
      ALTER TABLE room
        ADD COLUMN IF NOT EXISTS last_turn_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS turn_count INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS completion_percentage INTEGER NOT NULL DEFAULT 0
    `);

    // 4. search_vector — tsvector column for full-text search on room
    //    objective and title. Referenced by discovery-service.ts searchRooms().
    await client.query(`
      ALTER TABLE room
        ADD COLUMN IF NOT EXISTS search_vector tsvector
    `);

    // Backfill search_vector for existing rows
    await client.query(`
      UPDATE room
      SET search_vector = to_tsvector('english', COALESCE(objective, '') || ' ' || COALESCE(title, ''))
      WHERE search_vector IS NULL
    `);

    // Trigger function to auto-update search_vector on INSERT/UPDATE
    await client.query(`
      CREATE OR REPLACE FUNCTION room_search_vector_update()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.search_vector := to_tsvector('english', COALESCE(NEW.objective, '') || ' ' || COALESCE(NEW.title, ''));
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger WHERE tgname = 'room_search_vector_trigger'
        ) THEN
          CREATE TRIGGER room_search_vector_trigger
            BEFORE INSERT OR UPDATE OF objective, title ON room
            FOR EACH ROW EXECUTE FUNCTION room_search_vector_update();
        END IF;
      END $$
    `);

    // GIN index for fast full-text search
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_room_search_vector
        ON room USING GIN(search_vector)
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
