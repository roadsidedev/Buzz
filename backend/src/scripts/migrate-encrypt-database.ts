// @ts-nocheck
/**
 * Database Encryption Migration Script
 * Encrypts sensitive fields in the database
 *
 * Usage: npx ts-node src/scripts/migrate-encrypt-database.ts
 *
 * This script:
 * 1. Connects to the database
 * 2. Reads plaintext sensitive fields
 * 3. Encrypts each field
 * 4. Updates encrypted columns
 * 5. Tracks migration progress
 * 6. Generates report
 */

import pg from "pg";
import { encryptField } from "../utils/encryption.js";
import { logger } from "../utils/logger.js";

const DATABASE_URL = process.env.DATABASE_URL;
const DB_ENCRYPTION_KEY = process.env.DB_ENCRYPTION_KEY;

if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable required");
  process.exit(1);
}

if (!DB_ENCRYPTION_KEY) {
  console.error("DB_ENCRYPTION_KEY environment variable required");
  process.exit(1);
}

interface MigrationTask {
  table: string;
  sourceColumn: string;
  targetColumn: string;
  batchSize: number;
}

// Migration tasks
const MIGRATION_TASKS: MigrationTask[] = [
  {
    table: "agent",
    sourceColumn: "wallet_address",
    targetColumn: "wallet_address_encrypted",
    batchSize: 100,
  },
  {
    table: "payment",
    sourceColumn: "transaction_hash",
    targetColumn: "transaction_hash_encrypted",
    batchSize: 100,
  },
  {
    table: "payment",
    sourceColumn: "payer_address",
    targetColumn: "payer_address_encrypted",
    batchSize: 100,
  },
];

interface MigrationStats {
  task: string;
  totalRows: number;
  processedRows: number;
  failedRows: number;
  duration: number;
  status: "success" | "partial" | "failed";
}

const stats: MigrationStats[] = [];

/**
 * Run encryption migration for a single task
 */
async (client: pg.Client, task: MigrationTask): Promise<MigrationStats> => {
  const startTime = Date.now();
  const taskName = `${task.table}.${task.sourceColumn}`;

  console.log(`\n📝 Migrating ${taskName}...`);

  try {
    // Get total count
    const countResult = await client.query(
      `SELECT COUNT(*) as total FROM ${task.table} WHERE ${task.sourceColumn} IS NOT NULL`,
    );
    const totalRows = parseInt(countResult.rows[0].total, 10);

    if (totalRows === 0) {
      console.log(`  ✅ No rows to migrate for ${taskName}`);
      return {
        task: taskName,
        totalRows: 0,
        processedRows: 0,
        failedRows: 0,
        duration: 0,
        status: "success",
      };
    }

    console.log(`  Processing ${totalRows} rows...`);

    let processedRows = 0;
    let failedRows = 0;

    // Process in batches
    for (let offset = 0; offset < totalRows; offset += task.batchSize) {
      // Fetch batch
      const batchResult = await client.query(
        `SELECT id, ${task.sourceColumn} FROM ${task.table} 
         WHERE ${task.sourceColumn} IS NOT NULL 
         ORDER BY id 
         LIMIT $1 OFFSET $2`,
        [task.batchSize, offset],
      );

      // Encrypt and update each row
      for (const row of batchResult.rows) {
        try {
          const encrypted = encryptField(
            row[task.sourceColumn],
            DB_ENCRYPTION_KEY,
          );

          await client.query(
            `UPDATE ${task.table} SET ${task.targetColumn} = $1 WHERE id = $2`,
            [encrypted, row.id],
          );

          processedRows++;
        } catch (error) {
          console.error(`  ❌ Failed to encrypt row ${row.id}:`, error);
          failedRows++;
        }
      }

      // Progress indicator
      const progress = Math.min(offset + task.batchSize, totalRows);
      console.log(`  ✓ Processed ${progress}/${totalRows} rows`);
    }

    // Update migration log
    await client.query(
      `UPDATE encryption_migration_log 
       SET migrated_rows = $1, completed_at = NOW() 
       WHERE table_name = $2 AND column_name = $3`,
      [processedRows, task.table, task.sourceColumn],
    );

    const duration = Date.now() - startTime;
    const status = failedRows === 0 ? "success" : "partial";

    console.log(`  ✅ Completed in ${(duration / 1000).toFixed(2)}s`);

    return {
      task: taskName,
      totalRows,
      processedRows,
      failedRows,
      duration,
      status,
    };
  } catch (error) {
    console.error(`  ❌ Migration failed for ${taskName}:`, error);
    return {
      task: taskName,
      totalRows: 0,
      processedRows: 0,
      failedRows: 0,
      duration: Date.now() - startTime,
      status: "failed",
    };
  }
};

/**
 * Main migration function
 */
async function runMigration(): Promise<void> {
  const client = new pg.Client({ connectionString: DATABASE_URL });

  try {
    console.log("🔐 Database Encryption Migration Started");
    console.log(`📍 Database: ${DATABASE_URL?.split("@")[1]}`);
    console.log(`🔑 Encryption Key: ${DB_ENCRYPTION_KEY.substring(0, 10)}...`);
    console.log("");

    await client.connect();

    // Run each migration task
    for (const task of MIGRATION_TASKS) {
      const result = await migrateTask(client, task);
      stats.push(result);
    }

    // Print summary
    console.log("\n" + "=".repeat(60));
    console.log("📊 MIGRATION SUMMARY");
    console.log("=".repeat(60));

    let totalProcessed = 0;
    let totalFailed = 0;
    let successCount = 0;

    for (const stat of stats) {
      const statusEmoji = stat.status === "success" ? "✅" : "⚠️";
      console.log(
        `${statusEmoji} ${stat.task}: ${stat.processedRows}/${stat.totalRows} rows`,
      );
      if (stat.failedRows > 0) {
        console.log(`   ❌ ${stat.failedRows} failed`);
      }
      totalProcessed += stat.processedRows;
      totalFailed += stat.failedRows;
      if (stat.status === "success") {
        successCount++;
      }
    }

    console.log("");
    console.log(`Total Processed: ${totalProcessed} rows`);
    console.log(`Total Failed: ${totalFailed} rows`);
    console.log(
      `Success Rate: ${((successCount / stats.length) * 100).toFixed(1)}%`,
    );

    // Next steps
    console.log("\n" + "=".repeat(60));
    console.log("📋 NEXT STEPS");
    console.log("=".repeat(60));
    console.log("1. Verify all rows encrypted successfully above");
    console.log("2. Run this command to rename columns:");
    console.log(
      '   psql $DATABASE_URL -c "ALTER TABLE agent RENAME wallet_address_encrypted TO wallet_address;"',
    );
    console.log(
      '   psql $DATABASE_URL -c "ALTER TABLE payment RENAME transaction_hash_encrypted TO transaction_hash;"',
    );
    console.log(
      '   psql $DATABASE_URL -c "ALTER TABLE payment RENAME payer_address_encrypted TO payer_address;"',
    );
    console.log("3. Update application code to use encryption hooks");
    console.log("4. Restart application");

    process.exit(totalFailed > 0 ? 1 : 0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

/**
 * Declare migrateTask function signature
 */
async function migrateTask(
  client: pg.Client,
  task: MigrationTask,
): Promise<MigrationStats> {
  const startTime = Date.now();
  const taskName = `${task.table}.${task.sourceColumn}`;

  console.log(`\n📝 Migrating ${taskName}...`);

  try {
    // Get total count
    const countResult = await client.query(
      `SELECT COUNT(*) as total FROM ${task.table} WHERE ${task.sourceColumn} IS NOT NULL`,
    );
    const totalRows = parseInt(countResult.rows[0].total, 10);

    if (totalRows === 0) {
      console.log(`  ✅ No rows to migrate for ${taskName}`);
      return {
        task: taskName,
        totalRows: 0,
        processedRows: 0,
        failedRows: 0,
        duration: 0,
        status: "success",
      };
    }

    console.log(`  Processing ${totalRows} rows...`);

    let processedRows = 0;
    let failedRows = 0;

    // Process in batches
    for (let offset = 0; offset < totalRows; offset += task.batchSize) {
      // Fetch batch
      const batchResult = await client.query(
        `SELECT id, ${task.sourceColumn} FROM ${task.table} 
         WHERE ${task.sourceColumn} IS NOT NULL 
         ORDER BY id 
         LIMIT $1 OFFSET $2`,
        [task.batchSize, offset],
      );

      // Encrypt and update each row
      for (const row of batchResult.rows) {
        try {
          const encrypted = encryptField(
            row[task.sourceColumn],
            DB_ENCRYPTION_KEY,
          );

          await client.query(
            `UPDATE ${task.table} SET ${task.targetColumn} = $1 WHERE id = $2`,
            [encrypted, row.id],
          );

          processedRows++;
        } catch (error) {
          console.error(`  ❌ Failed to encrypt row ${row.id}:`, error);
          failedRows++;
        }
      }

      // Progress indicator
      const progress = Math.min(offset + task.batchSize, totalRows);
      console.log(`  ✓ Processed ${progress}/${totalRows} rows`);
    }

    // Update migration log
    await client.query(
      `UPDATE encryption_migration_log 
       SET migrated_rows = $1, completed_at = NOW() 
       WHERE table_name = $2 AND column_name = $3`,
      [processedRows, task.table, task.sourceColumn],
    );

    const duration = Date.now() - startTime;
    const status = failedRows === 0 ? "success" : "partial";

    console.log(`  ✅ Completed in ${(duration / 1000).toFixed(2)}s`);

    return {
      task: taskName,
      totalRows,
      processedRows,
      failedRows,
      duration,
      status,
    };
  } catch (error) {
    console.error(`  ❌ Migration failed for ${taskName}:`, error);
    return {
      task: taskName,
      totalRows: 0,
      processedRows: 0,
      failedRows: 0,
      duration: Date.now() - startTime,
      status: "failed",
    };
  }
}

// Run migration
runMigration();
