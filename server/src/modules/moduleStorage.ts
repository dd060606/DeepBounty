import { DatabaseSync } from "node:sqlite";
import path from "path";
import fs from "fs";
import Logger from "@/utils/logger.js";
import { MODULES_DIR } from "@/utils/constants.js";

const logger = new Logger("ModuleStorage");

// Warn when a single synchronous statement blocks the event loop longer than this.
const SLOW_QUERY_MS = Number(process.env.MODULE_STORAGE_SLOW_MS) || 500;

function warnIfSlow(moduleId: string, sql: string, startedAt: number): void {
  const elapsed = Date.now() - startedAt;
  if (elapsed < SLOW_QUERY_MS) return;
  const oneLine = sql.replace(/\s+/g, " ").trim();
  const preview = oneLine.length > 200 ? `${oneLine.slice(0, 200)}…` : oneLine;
  logger.warn(
    `Slow module query in "${moduleId}" took ${elapsed}ms (blocks event loop): ${preview}`
  );
}

// Store active database connections
const dbConnections = new Map<string, DatabaseSync>();

/**
 * ModuleStorage provides an isolated SQLite database for each module
 * This allows modules to store their own data without interfering with each other
 * or with the main PostgreSQL database.
 */
export class ModuleStorage {
  private db: DatabaseSync;
  private moduleId: string;
  // Tracks whether a transaction is currently open so nested transaction()/
  // executeMany() calls run inline instead of issuing an illegal nested BEGIN.
  private inTransaction = false;

  constructor(moduleId: string) {
    this.moduleId = moduleId;
    this.db = this.getOrCreateDatabase(this.moduleId);
  }

  /**
   * Get or create a database connection for a module
   */
  private getOrCreateDatabase(moduleId: string): DatabaseSync {
    // Check if connection already exists
    if (dbConnections.has(moduleId)) {
      return dbConnections.get(moduleId)!;
    }

    const dbPath = path.join(MODULES_DIR, moduleId, "data.db");
    try {
      const db = new DatabaseSync(dbPath);
      // Store connection
      dbConnections.set(moduleId, db);

      return db;
    } catch (err) {
      logger.error(`Failed to create database for module "${moduleId}"`, err);
      throw err;
    }
  }

  /**
   * Execute a raw SQL query (SELECT)
   * Returns all matching rows
   */
  query<T = any>(sql: string, params?: any[]): T[] {
    const startedAt = Date.now();
    try {
      const stmt = this.db.prepare(sql);
      // Use spread operator to convert parameters or pass undefined if empty
      const result = params && params.length > 0 ? stmt.all(...params) : stmt.all();
      return result as T[];
    } catch (err) {
      logger.error(`Query error in module "${this.moduleId}":`, err);
      throw err;
    } finally {
      warnIfSlow(this.moduleId, sql, startedAt);
    }
  }

  /**
   * Execute a raw SQL query and return the first row
   */
  queryOne<T = any>(sql: string, params?: any[]): T | undefined {
    const startedAt = Date.now();
    try {
      const stmt = this.db.prepare(sql);
      // Use spread operator to convert parameters or pass undefined if empty
      const result = params && params.length > 0 ? stmt.get(...params) : stmt.get();
      return result as T | undefined;
    } catch (err) {
      logger.error(`QueryOne error in module "${this.moduleId}":`, err);
      throw err;
    } finally {
      warnIfSlow(this.moduleId, sql, startedAt);
    }
  }

  /**
   * Execute a raw SQL statement (INSERT, UPDATE, DELETE)
   * Returns information about the execution
   */
  execute(
    sql: string,
    params?: any[]
  ): { changes: number | bigint; lastInsertRowid: number | bigint } {
    const startedAt = Date.now();
    try {
      const stmt = this.db.prepare(sql);
      // Use spread operator to convert parameters or pass undefined if empty
      const result = params && params.length > 0 ? stmt.run(...params) : stmt.run();

      return {
        changes: result.changes,
        lastInsertRowid: result.lastInsertRowid,
      };
    } catch (err) {
      logger.error(`Execute error in module "${this.moduleId}":`, err);
      throw err;
    } finally {
      warnIfSlow(this.moduleId, sql, startedAt);
    }
  }

  /**
   * Run a function inside a single transaction (BEGIN/COMMIT, ROLLBACK on throw).
   * Reuses an already-open transaction when called nested (runs the function inline).
   */
  transaction<T>(fn: () => T): T {
    // Already inside a transaction: run inline so we never issue a nested BEGIN.
    if (this.inTransaction) {
      return fn();
    }

    this.inTransaction = true;
    this.db.exec("BEGIN");
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (err) {
      try {
        this.db.exec("ROLLBACK");
      } catch (rollbackErr) {
        logger.error(`Rollback failed in module "${this.moduleId}":`, rollbackErr);
      }
      logger.error(`Transaction error in module "${this.moduleId}":`, err);
      throw err;
    } finally {
      this.inTransaction = false;
    }
  }

  /**
   * Execute the same statement for many parameter rows inside a single transaction.
   * Prepares the statement once and reuses it for every row.
   */
  executeMany(sql: string, rows: any[][]): void {
    if (rows.length === 0) return;
    const startedAt = Date.now();
    this.transaction(() => {
      const stmt = this.db.prepare(sql);
      for (const row of rows) {
        stmt.run(...row);
      }
    });
    warnIfSlow(this.moduleId, `[executeMany x${rows.length}] ${sql}`, startedAt);
  }

  /**
   * Helper method to create a table if it doesn't exist
   */
  createTable(tableName: string, schema: string): void {
    const sql = `CREATE TABLE IF NOT EXISTS ${tableName} (${schema})`;
    this.execute(sql);
  }

  /**
   * Helper method to drop a table
   */
  dropTable(tableName: string): void {
    this.execute(`DROP TABLE IF EXISTS ${tableName}`);
  }

  /**
   * Close the database connection
   * Should be called when the module is stopped
   */
  close(): void {
    try {
      if (this.db.isOpen) {
        this.db.close();
        dbConnections.delete(this.moduleId);
      }
    } catch (err) {
      logger.error(`Error closing database for module "${this.moduleId}"`, err);
    }
  }
}

/**
 * Close all database connections
 * Should be called when the server shuts down
 */
export function closeAllDatabases(): void {
  logger.info("Closing all module databases...");
  for (const [moduleId, db] of dbConnections.entries()) {
    try {
      if (db.isOpen) {
        db.close();
      }
    } catch (err) {
      logger.error(`Error closing database for module "${moduleId}"`, err);
    }
  }
  dbConnections.clear();
}

/**
 * Clear all databases
 * Used to reset module storage (reinitialization)
 */
export async function clearAllModuleDatabases(): Promise<void> {
  logger.info("Clearing all module databases...");

  if (!fs.existsSync(MODULES_DIR)) return;

  const modules = fs.readdirSync(MODULES_DIR);

  // Delete each module's database file
  for (const moduleId of modules) {
    const dbPath = path.join(MODULES_DIR, moduleId, "data.db");
    if (fs.existsSync(dbPath)) {
      try {
        fs.unlinkSync(dbPath);
        logger.info(`Deleted database for module "${moduleId}"`);
      } catch (err) {
        logger.error(`Failed to delete database for module "${moduleId}"`, err);
      }
    }
  }
}
