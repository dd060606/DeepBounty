import { Pool, QueryResultRow } from "pg";
import Logger from "./logger.js";

const logger = new Logger("DB");

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
});

export async function initDatabase() {
  // Test connection on startup
  await new Promise((resolve) => setTimeout(resolve, 2000));
  try {
    await pool.connect();
    logger.info("Connection to the database succeeded");
  } catch (err) {
    logger.error("Connection to the database failed", err);
  }
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: any[]
): Promise<T[]> {
  const result = await pool.query<T>(text, params);
  return result.rows;
}
