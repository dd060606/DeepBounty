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

export function initDatabase() {
  // Test connection on startup
  setTimeout(() => {
    pool
      .connect()
      .then((client) => {
        client.release();
        logger.info("Connection to the database succeeded");
      })
      .catch((err) => {
        logger.error("Connection to the database failed", err);
      });
  }, 2000);
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: any[]
): Promise<T[]> {
  const result = await pool.query<T>(text, params);
  return result.rows;
}
