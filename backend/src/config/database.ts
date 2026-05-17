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
  let failed = 0;

  /**
   * Execute a migration statement with isolated error handling.
   *
   * Previously all migrations ran inside a single BEGIN/COMMIT transaction —
   * one failure rolled back every column and table addition.  Each call now
   * gets its own transaction so a failure in one migration (e.g. podcast
   * tables) does not silently prevent critical columns (last_seen_at,
   * recording_available, visibility) from being added.
   */
  async function runSafely(label: string, sql: string): Promise<void> {
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      failed++;
      logger.error(`Startup migration failed: ${label}`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  try {
    // ── Agent columns: Jam / ERC-8004 identity ──────────────────────────────
    await runSafely("agent Jam/ERC-8004 columns", `
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

    await runSafely("agent relax NOT NULL", `
      ALTER TABLE agent
        ALTER COLUMN llm_provider DROP NOT NULL,
        ALTER COLUMN llm_model DROP NOT NULL,
        ALTER COLUMN display_name DROP NOT NULL
    `);

    await runSafely("idx_agent_api_key", `CREATE INDEX IF NOT EXISTS idx_agent_api_key ON agent(api_key)`);
    await runSafely("idx_agent_claim_token", `CREATE INDEX IF NOT EXISTS idx_agent_claim_token ON agent(claim_token)`);
    await runSafely("idx_agent_jam_identity", `CREATE INDEX IF NOT EXISTS idx_agent_jam_identity ON agent(jam_identity_id)`);
    await runSafely("idx_agent_erc8004_identity", `CREATE INDEX IF NOT EXISTS idx_agent_erc8004_identity ON agent(erc8004_identity)`);

    // ── agent_role_check: extend to include 'human' ─────────────────────────
    // syncUser() inserts Privy-authenticated humans with role='human'.
    // The original constraint may only allow 'agent' / 'moderator' / 'admin'.
    await runSafely("agent_role_check add human", `
      ALTER TABLE agent DROP CONSTRAINT IF EXISTS agent_role_check;
      ALTER TABLE agent ADD CONSTRAINT agent_role_check
        CHECK (role IN ('agent', 'moderator', 'admin', 'human', 'listener', 'host', 'cohost'))
    `);

    // ── Room base columns ───────────────────────────────────────────────────
    await runSafely("room jam_room_url",
      `ALTER TABLE room ADD COLUMN IF NOT EXISTS jam_room_url TEXT`);

    await runSafely("room scheduled_for",
      `ALTER TABLE room ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMP WITH TIME ZONE NULL`);

    await runSafely("room managed_externally",
      `ALTER TABLE room ADD COLUMN IF NOT EXISTS managed_externally BOOLEAN NOT NULL DEFAULT FALSE`);

    // ── Notification tables ─────────────────────────────────────────────────
    await runSafely("room_notification table", `
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

    await runSafely("user_notification table", `
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

    await runSafely("idx_user_notif_user",
      `CREATE INDEX IF NOT EXISTS idx_user_notif_user ON user_notification(user_id, created_at DESC)`);

    // ── Discovery tables (category, room_viewers, room_engagement) ──────────
    // category MUST be created BEFORE room.category_id FK references it.
    await runSafely("category table", `
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

    await runSafely("room_viewers table", `
      CREATE TABLE IF NOT EXISTS room_viewers (
        room_id      UUID PRIMARY KEY REFERENCES room(id) ON DELETE CASCADE,
        viewer_count INT DEFAULT 0,
        updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await runSafely("room_engagement table", `
      CREATE TABLE IF NOT EXISTS room_engagement (
        room_id         UUID PRIMARY KEY REFERENCES room(id) ON DELETE CASCADE,
        total_messages  INT DEFAULT 0,
        engagement_rate DECIMAL(10,4) DEFAULT 0,
        trending_score  DECIMAL(10,4) DEFAULT 0,
        updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Seed default categories if none exist
    try {
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
    } catch (err) {
      logger.error("Failed to seed categories", {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // ── Room columns dependent on discovery tables ──────────────────────────
    // Moved AFTER category table creation so the FK reference resolves.
    await runSafely("room pantry/category_id", `
      ALTER TABLE room
        ADD COLUMN IF NOT EXISTS pantry_room_id     VARCHAR(128),
        ADD COLUMN IF NOT EXISTS pantry_sfu_enabled BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS category_id        UUID REFERENCES category(id) ON DELETE SET NULL
    `);

    await runSafely("idx_room_pantry_room_id",
      `CREATE INDEX IF NOT EXISTS idx_room_pantry_room_id ON room(pantry_room_id)`);
    await runSafely("idx_room_category",
      `CREATE INDEX IF NOT EXISTS idx_room_category ON room(category_id)`);

    // ── visibility column ───────────────────────────────────────────────────
    // Referenced by discovery-service.ts getLiveNow() WHERE r.visibility = 'public'.
    // Was in migration 011_room_visibility_default.sql but omitted from startup.
    await runSafely("room visibility", `
      ALTER TABLE room ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) NOT NULL DEFAULT 'public'
    `);

    // ── Room recording columns ──────────────────────────────────────────────
    await runSafely("room recording columns", `
      ALTER TABLE room
        ADD COLUMN IF NOT EXISTS recording_enabled    BOOLEAN                   NOT NULL DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS recording_url        TEXT,
        ADD COLUMN IF NOT EXISTS recording_started_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS recording_ended_at   TIMESTAMP WITH TIME ZONE
    `);

    // ── room_participant table ──────────────────────────────────────────────
    await runSafely("room_participant table", `
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

    await runSafely("idx_room_participant_room",
      `CREATE INDEX IF NOT EXISTS idx_room_participant_room ON room_participant(room_id)`);
    await runSafely("idx_room_participant_agent",
      `CREATE INDEX IF NOT EXISTS idx_room_participant_agent ON room_participant(agent_id)`);

    // ── recording_available ─────────────────────────────────────────────────
    await runSafely("room recording_available", `
      ALTER TABLE room ADD COLUMN IF NOT EXISTS recording_available BOOLEAN NOT NULL DEFAULT FALSE
    `);

    // ── last_seen_at ────────────────────────────────────────────────────────
    await runSafely("room last_seen_at", `
      ALTER TABLE room ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    `);

    await runSafely("idx_room_last_seen",
      `CREATE INDEX IF NOT EXISTS idx_room_last_seen ON room(last_seen_at) WHERE status = 'live'`);

    // ── last_turn_at / turn_count / completion_percentage ───────────────────
    await runSafely("room turn tracking", `
      ALTER TABLE room
        ADD COLUMN IF NOT EXISTS last_turn_at          TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS turn_count            INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS completion_percentage INTEGER NOT NULL DEFAULT 0
    `);

    // ── room_status ENUM: add 'ended' and 'closed' ─────────────────────────
    // Code references status='ended' (room-repository.ts:664, room-orchestration-service.ts:318)
    // and status='closed' (setRecordingAvailable, /discover/recently-ended).
    // Original ENUM only has: pending, live, paused, completed, cancelled.
    // Migration 009 adds: scheduled, failed.
    await runSafely("room_status add ended", `
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum
          WHERE enumlabel = 'ended' AND enumtypid = 'room_status'::regtype
        ) THEN
          ALTER TYPE room_status ADD VALUE 'ended';
        END IF;
      END $$
    `);

    await runSafely("room_status add closed", `
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum
          WHERE enumlabel = 'closed' AND enumtypid = 'room_status'::regtype
        ) THEN
          ALTER TYPE room_status ADD VALUE 'closed';
        END IF;
      END $$
    `);

    // ── room_status CHECK constraint ────────────────────────────────────────
    // Ensure all valid statuses are allowed.  Without 'ended' and 'closed',
    // setRecordingAvailable() and auto-end logic fail.
    await runSafely("room_status_check constraint", `
      ALTER TABLE room DROP CONSTRAINT IF EXISTS room_status_check
    `);
    await runSafely("room_status_check add", `
      ALTER TABLE room ADD CONSTRAINT room_status_check
        CHECK (status IN (
          'pending', 'live', 'paused', 'scheduled',
          'ended', 'completed', 'cancelled', 'closed', 'failed'
        ))
    `);

    // ── search_vector ───────────────────────────────────────────────────────
    await runSafely("room search_vector", `
      ALTER TABLE room ADD COLUMN IF NOT EXISTS search_vector tsvector
    `);

    await runSafely("room search_vector backfill", `
      UPDATE room
      SET search_vector = to_tsvector('english', COALESCE(objective, '') || ' ' || COALESCE(title, ''))
      WHERE search_vector IS NULL
    `);

    await runSafely("room_search_vector_update function", `
      CREATE OR REPLACE FUNCTION room_search_vector_update()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.search_vector := to_tsvector('english', COALESCE(NEW.objective, '') || ' ' || COALESCE(NEW.title, ''));
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    await runSafely("room_search_vector_trigger", `
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

    await runSafely("idx_room_search_vector",
      `CREATE INDEX IF NOT EXISTS idx_room_search_vector ON room USING GIN(search_vector)`);

    // ── Podcast tables ──────────────────────────────────────────────────────
    await runSafely("podcast table", `
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

    await runSafely("podcast_episode table", `
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

    await runSafely("podcast_distribution table", `
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

    await runSafely("podcast_subscription table", `
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

    await runSafely("podcast_generation_cost table", `
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

    await runSafely("podcast_analytics table", `
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
    await runSafely("idx_podcast_agent", `CREATE INDEX IF NOT EXISTS idx_podcast_agent ON podcast(agent_id)`);
    await runSafely("idx_podcast_category", `CREATE INDEX IF NOT EXISTS idx_podcast_category ON podcast(category)`);
    await runSafely("idx_podcast_by_agent", `CREATE INDEX IF NOT EXISTS idx_podcast_by_agent ON podcast(agent_id, created_at DESC)`);
    await runSafely("idx_episode_podcast", `CREATE INDEX IF NOT EXISTS idx_episode_podcast ON podcast_episode(podcast_id)`);
    await runSafely("idx_episode_status", `CREATE INDEX IF NOT EXISTS idx_episode_status ON podcast_episode(status)`);
    await runSafely("idx_episode_status_created", `CREATE INDEX IF NOT EXISTS idx_episode_status_created ON podcast_episode(status, created_at ASC)`);
    await runSafely("idx_distribution_episode", `CREATE INDEX IF NOT EXISTS idx_distribution_episode ON podcast_distribution(episode_id)`);
    await runSafely("idx_distribution_platform", `CREATE INDEX IF NOT EXISTS idx_distribution_platform ON podcast_distribution(platform)`);
    await runSafely("idx_subscription_agent", `CREATE INDEX IF NOT EXISTS idx_subscription_agent ON podcast_subscription(agent_id)`);
    await runSafely("idx_subscription_podcast", `CREATE INDEX IF NOT EXISTS idx_subscription_podcast ON podcast_subscription(podcast_id)`);
    await runSafely("idx_cost_episode", `CREATE INDEX IF NOT EXISTS idx_cost_episode ON podcast_generation_cost(episode_id)`);
    await runSafely("idx_analytics_episode", `CREATE INDEX IF NOT EXISTS idx_analytics_episode ON podcast_analytics(episode_id)`);
    await runSafely("idx_podcast_trending", `CREATE INDEX IF NOT EXISTS idx_podcast_trending ON podcast_analytics(recorded_at DESC)`);

    await runSafely("agent podcast_specialization",
      `ALTER TABLE agent ADD COLUMN IF NOT EXISTS podcast_specialization VARCHAR(100)`);

    // Podcast episode format
    await runSafely("podcast_episode format", `
      ALTER TABLE podcast_episode
        ADD COLUMN IF NOT EXISTS format VARCHAR(20) NOT NULL DEFAULT 'monologue',
        ADD COLUMN IF NOT EXISTS secondary_voice_id VARCHAR(100)
    `);

    await runSafely("chk_episode_format", `
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

    await runSafely("idx_episode_format",
      `CREATE INDEX IF NOT EXISTS idx_episode_format ON podcast_episode(format)`);

    // Podcast triggers
    await runSafely("update_podcast_timestamp function", `
      CREATE OR REPLACE FUNCTION update_podcast_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    await runSafely("podcast_update_timestamp trigger", `
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'podcast_update_timestamp') THEN
          CREATE TRIGGER podcast_update_timestamp
            BEFORE UPDATE ON podcast
            FOR EACH ROW EXECUTE FUNCTION update_podcast_timestamp();
        END IF;
      END $$
    `);

    await runSafely("update_episode_timestamp function", `
      CREATE OR REPLACE FUNCTION update_episode_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    await runSafely("episode_update_timestamp trigger", `
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'episode_update_timestamp') THEN
          CREATE TRIGGER episode_update_timestamp
            BEFORE UPDATE ON podcast_episode
            FOR EACH ROW EXECUTE FUNCTION update_episode_timestamp();
        END IF;
      END $$
    `);

    // ── Livestream table & heartbeat columns ──────────────────────────────────
    await runSafely("livestream table", `
      CREATE TABLE IF NOT EXISTS livestream (
        id UUID PRIMARY KEY,
        host_agent_id UUID NOT NULL,
        host_agent_name TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        category TEXT NOT NULL,
        stream_capabilities TEXT[] DEFAULT '{video,audio,chat}',
        stream_key TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'live',
        viewer_count INTEGER DEFAULT 0,
        spawn_fee_payment_id TEXT,
        recording_url TEXT,
        recording_available BOOLEAN NOT NULL DEFAULT FALSE,
        recording_started_at TIMESTAMP WITH TIME ZONE,
        recording_ended_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await runSafely("livestream last_seen_at", `
      ALTER TABLE livestream ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    `);

    await runSafely("livestream recording_url", `
      ALTER TABLE livestream ADD COLUMN IF NOT EXISTS recording_url TEXT
    `);

    await runSafely("livestream recording_available", `
      ALTER TABLE livestream ADD COLUMN IF NOT EXISTS recording_available BOOLEAN NOT NULL DEFAULT FALSE
    `);

    await runSafely("livestream recording_started_at", `
      ALTER TABLE livestream ADD COLUMN IF NOT EXISTS recording_started_at TIMESTAMP WITH TIME ZONE
    `);

    await runSafely("livestream recording_ended_at", `
      ALTER TABLE livestream ADD COLUMN IF NOT EXISTS recording_ended_at TIMESTAMP WITH TIME ZONE
    `);

    await runSafely("idx_livestream_last_seen",
      `CREATE INDEX IF NOT EXISTS idx_livestream_last_seen ON livestream(last_seen_at) WHERE status = 'live'`);

    if (failed > 0) {
      logger.warn(`Startup migrations completed with ${failed} failure(s)`);
    } else {
      logger.info("Startup schema migrations applied successfully");
    }
  } finally {
    client.release();
  }
}
