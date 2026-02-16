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
  max: 50,
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

      // Is the database explicitly telling us it's overloaded?
      const isOverload =
        errorMessage.includes("canceling authentication due to timeout") ||
        causeMessage.includes("canceling authentication due to timeout");

      // Is it a genuine network drop?
      const isConnectionError =
        errorMessage.includes("Connection terminated") ||
        errorMessage.includes("ECONNRESET") ||
        errorMessage.includes("socket hang up") ||
        (errorMessage.includes("timeout") && !isOverload) || // Catch generic timeouts, but NOT overloads
        causeMessage.includes("Connection terminated") ||
        causeMessage.includes("ECONNRESET");

      if (isConnectionError && attempt < MAX_RETRIES) {
        // Calculate Exponential Backoff with Jitter (e.g., 500ms, 1000ms, 1500ms + random 0-200ms)
        const jitter = Math.floor(Math.random() * 200);
        const delayMs = RETRY_DELAY_MS * attempt + jitter;

        logger.warn(
          `Database query failed (attempt ${attempt}/${MAX_RETRIES}). Retrying in ${delayMs}ms...`
        );

        await new Promise((res) => setTimeout(res, delayMs));
        continue;
      }

      // If it's an overload, or we ran out of retries, fail fast.
      if (isOverload) {
        logger.error("Database is overloaded (Authentication Timeout). Failing fast.");
      } else {
        logger.error("Database operation failed fatally", error);
      }
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
