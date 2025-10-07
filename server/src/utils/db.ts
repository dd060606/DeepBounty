import { QueryResultRow } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import Logger from "./logger.js";
import { sql, SQL } from "drizzle-orm";

const logger = new Logger("DB");

const db = drizzle(process.env.DB_URL!);

// Run migrations
export async function initDatabase() {
  try {
    await migrate(db, { migrationsFolder: "./drizzle" });
  } catch (err) {
    logger.error("Database migration failed:", err);
    throw err;
  }
}

// Send a SQL query
export async function query<T = unknown>(q: SQL): Promise<T[]> {
  const result = await db.execute(q);
  return result.rows as T[];
}
