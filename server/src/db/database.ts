import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import Logger from "@/utils/logger.js";
import { SQL, sql } from "drizzle-orm";

const logger = new Logger("DB");
const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // Add network resilience settings
  keepAlive: true,
  // Close idle clients after 30 seconds
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// This prevents the unhandled promise rejection that crashes the server when the database connection is lost
pool.on("error", (err) => {
  logger.error("Unexpected database error on idle client (network drop)", err);
});

// Pass the pool into Drizzle
const db = drizzle(pool);

// Wait for the database to be ready (with retry)
async function waitForDatabaseReady() {
  const attempts = 5;
  const delayMs = 1500;

  for (let i = 1; i <= attempts; i++) {
    try {
      await db.execute(sql`SELECT 1`);
      return;
    } catch (e) {
      if (i === attempts) throw e;
      await new Promise((res) => setTimeout(res, delayMs));
    }
  }
}

// Run database migrations
export async function initDatabase() {
  try {
    await waitForDatabaseReady();
    await migrate(db, { migrationsFolder: "./drizzle" });
    logger.info("Database migrations executed successfully.");
  } catch (err) {
    logger.error("Failed to run database migrations", err);
  }
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 500;

// Handle execution with retries
async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      const errorMessage = error.message || "";
      const causeMessage = error.cause?.message || "";

      // Check if either the wrapper or the root cause is a network/connection drop error
      const isConnectionError =
        errorMessage.includes("Connection terminated") ||
        errorMessage.includes("timeout") ||
        causeMessage.includes("Connection terminated") ||
        causeMessage.includes("timeout");

      if (isConnectionError && attempt < MAX_RETRIES) {
        logger.warn(
          `Database query failed (attempt ${attempt}/${MAX_RETRIES}). Retrying in ${RETRY_DELAY_MS}ms...`
        );
        await new Promise((res) => setTimeout(res, RETRY_DELAY_MS));
        continue;
      }

      logger.error("Database operation failed fatally", error);
      throw error;
    }
  }
  throw new Error("Unreachable code reached in withRetry");
}

// Send a SQL query
export async function query<T = unknown>(q: SQL): Promise<T[]> {
  return withRetry(async () => {
    const result = await db.execute(q);
    return result.rows as T[];
  });
}

// Send a SQL query for one result
export async function queryOne<T = unknown>(q: SQL): Promise<T> {
  return withRetry(async () => {
    const result = await db.execute(q);
    return result.rows[0] as T;
  });
}
