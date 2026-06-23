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
  // Server-side ceiling so a single runaway query can never pin a pooled
  // connection indefinitely and cascade into pool exhaustion.
  statement_timeout: 30000,
});

// This prevents the unhandled promise rejection that crashes the server when the database connection is lost
pool.on("error", (err) => {
  logger.error("Unexpected database error on idle client (network drop)", err);
});

// Pass the pool into Drizzle
const db = drizzle(pool);

// Dedicated, small pool reserved for high-volume, low-priority analytics writes
// (task-execution + event metrics). Analytics row loss is acceptable, so this
// path is fail-fast and lossy by design.
const ANALYTICS_POOL_MAX = Number(process.env.DB_ANALYTICS_POOL_MAX) || 3;
const analyticsPool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: ANALYTICS_POOL_MAX,
  keepAlive: true,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 15000,
});
analyticsPool.on("error", (err) => {
  logger.error("Unexpected analytics database error on idle client", err);
});
const analyticsDb = drizzle(analyticsPool);

// If more than this many analytics writes are already queued for a connection,
// new ones are dropped rather than queued (load shedding).
const ANALYTICS_MAX_WAITING = Number(process.env.DB_ANALYTICS_MAX_WAITING) || 5;

// Threshold above which a query is logged as slow (helps pinpoint lag sources).
const SLOW_QUERY_MS = Number(process.env.DB_SLOW_QUERY_MS) || 1000;

/** Live pool saturation snapshot. waitingCount > 0 means requests are queued for a connection. */
export function getPoolStats(): { total: number; idle: number; waiting: number; max: number } {
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
    max: 50,
  };
}

let poolMonitorTimer: NodeJS.Timeout | null = null;

/**
 * Periodically log pool saturation. Logs at WARN whenever requests are waiting for a connection.
 */
export function startPoolMonitor(intervalMs = 15000): void {
  if (poolMonitorTimer) return;
  poolMonitorTimer = setInterval(() => {
    const { total, idle, waiting, max } = getPoolStats();
    if (waiting > 0) {
      logger.warn(
        `Pool saturated: ${waiting} request(s) waiting for a connection (in-use=${total - idle}/${max}, idle=${idle}).`
      );
    }
    if (analyticsPool.waitingCount > 0) {
      logger.warn(
        `Analytics pool saturated: ${analyticsPool.waitingCount} write(s) waiting (in-use=${analyticsPool.totalCount - analyticsPool.idleCount}/${ANALYTICS_POOL_MAX}). Excess analytics writes are being dropped.`
      );
    }
  }, intervalMs);
  poolMonitorTimer.unref?.();
}

//  SQL object to text for slow-query diagnostics.
function renderSql(q: SQL): string {
  try {
    const text = (db as any).dialect?.sqlToQuery?.(q)?.sql as string | undefined;
    if (!text) return "<unknown>";
    return text.length > 300 ? `${text.slice(0, 300)}…` : text;
  } catch {
    return "<unrenderable>";
  }
}

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

const READ_MAX_RETRIES = 3;
const WRITE_MAX_RETRIES = 8;
const RETRY_DELAY_MS = 500;

interface QueryOptions {
  // Marks the statement as a write so it gets the durable retry budget.
  write?: boolean;
  // Optional label surfaced in slow-query logs.
  label?: string;
}

function collectErrorDetails(error: any): {
  code?: string;
  messages: string[];
  names: string[];
} {
  const messages: string[] = [];
  const names: string[] = [];
  let code: string | undefined;

  let current: any = error;
  let depth = 0;
  while (current && depth < 5) {
    if (typeof current.message === "string" && current.message.trim()) {
      messages.push(current.message);
    }
    if (typeof current.name === "string" && current.name.trim()) {
      names.push(current.name);
    }
    if (!code && typeof current.code === "string") {
      code = current.code;
    }
    current = current.cause;
    depth += 1;
  }

  return { code, messages, names };
}

function isRetryableDbError(error: any): { retryable: boolean; reason: string } {
  const details = collectErrorDetails(error);
  const combinedMessage = details.messages.join(" | ").toLowerCase();

  // Retry network/protocol/transient connection errors
  const retryableCodes = new Set([
    "ECONNRESET",
    "EPIPE",
    "ETIMEDOUT",
    "ECONNREFUSED",
    "57P01", // admin_shutdown
    "57P02", // crash_shutdown
    "57P03", // cannot_connect_now
    "53300", // too_many_connections
  ]);

  if (details.code && retryableCodes.has(details.code)) {
    return { retryable: true, reason: `code:${details.code}` };
  }

  const retryableMessageFragments = [
    "connection terminated",
    "socket hang up",
    "timeout exceeded when trying to connect",
    "connection terminated unexpectedly",
    "the database system is starting up",
    "too many clients already",
    "terminating connection due to administrator command",
    "could not connect to server",
  ];

  if (retryableMessageFragments.some((fragment) => combinedMessage.includes(fragment))) {
    return { retryable: true, reason: "message-match" };
  }

  // Generic timeout handling for transient infra issues
  if (combinedMessage.includes("timeout")) {
    return { retryable: true, reason: "generic-timeout" };
  }

  return { retryable: false, reason: "non-retryable" };
}

// Handle execution with retries
async function withRetry<T>(operation: () => Promise<T>, isWrite: boolean): Promise<T> {
  const maxRetries = isWrite ? WRITE_MAX_RETRIES : READ_MAX_RETRIES;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      const details = collectErrorDetails(error);
      const retry = isRetryableDbError(error);

      if (retry.retryable && attempt < maxRetries) {
        // Exponential backoff with jitter.
        const jitter = Math.floor(Math.random() * 200);
        const delayMs = RETRY_DELAY_MS * attempt + jitter;

        logger.warn(
          `Database ${isWrite ? "write" : "query"} failed (attempt ${attempt}/${maxRetries}, reason=${retry.reason}, code=${details.code || "n/a"}). Retrying in ${delayMs}ms...`
        );

        await new Promise((res) => setTimeout(res, delayMs));
        continue;
      }

      logger.error(
        `Database operation failed fatally (attempt=${attempt}, reason=${retry.reason}, code=${details.code || "n/a"})`,
        error
      );
      throw error;
    }
  }
  throw new Error("Unreachable code reached in withRetry");
}

// Time an execution and warn if it crosses the slow-query threshold.
async function runTimed<T>(
  q: SQL,
  opts: QueryOptions | undefined,
  run: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  try {
    return await run();
  } finally {
    const elapsed = Date.now() - start;
    if (elapsed >= SLOW_QUERY_MS) {
      logger.warn(
        `Slow query (${elapsed}ms${opts?.label ? `, ${opts.label}` : ""}): ${renderSql(q)}`
      );
    }
  }
}

// Send a SQL query
export async function query<T = unknown>(q: SQL, opts?: QueryOptions): Promise<T[]> {
  return withRetry(
    () =>
      runTimed(q, opts, async () => {
        const result = await db.execute(q);
        return result.rows as T[];
      }),
    opts?.write ?? false
  );
}

// Send a SQL query for one result
export async function queryOne<T = unknown>(q: SQL, opts?: QueryOptions): Promise<T> {
  return withRetry(
    () =>
      runTimed(q, opts, async () => {
        const result = await db.execute(q);
        return result.rows[0] as T;
      }),
    opts?.write ?? false
  );
}

/**
 * Execute a best-effort analytics write on the dedicated analytics pool.
 * Fail-fast and lossy by design: under saturation the write is dropped
 * (acceptable for analytics) and never retried or blocked. Security data must
 * never use this path.
 *
 * @returns true if the statement ran, false if it was dropped or failed.
 */
export async function analyticsQuery(q: SQL, opts?: QueryOptions): Promise<boolean> {
  // Load shedding: if analytics connections are already backed up, drop this
  // write instead of queueing it (never block, never grow unbounded).
  if (analyticsPool.waitingCount > ANALYTICS_MAX_WAITING) {
    return false;
  }
  try {
    await runTimed(q, opts, async () => {
      await analyticsDb.execute(q);
    });
    return true;
  } catch {
    // Analytics is best-effort; swallow errors (they are logged by the caller if needed).
    return false;
  }
}
