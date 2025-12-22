import { DatabaseSync } from "node:sqlite";
import path from "path";
import fs from "fs";
import Logger from "@/utils/logger.js";
import { MODULES_DIR } from "@/utils/constants.js";

const logger = new Logger("ModuleStorage");

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
    try {
      const stmt = this.db.prepare(sql);
      // Use spread operator to convert parameters or pass undefined if empty
      const result = params && params.length > 0 ? stmt.all(...params) : stmt.all();
      return result as T[];
    } catch (err) {
      logger.error(`Query error in module "${this.moduleId}":`, err);
      throw err;
    }
  }

  /**
   * Execute a raw SQL query and return the first row
   */
  queryOne<T = any>(sql: string, params?: any[]): T | undefined {
    try {
      const stmt = this.db.prepare(sql);
      // Use spread operator to convert parameters or pass undefined if empty
      const result = params && params.length > 0 ? stmt.get(...params) : stmt.get();
      return result as T | undefined;
    } catch (err) {
      logger.error(`QueryOne error in module "${this.moduleId}":`, err);
      throw err;
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
    }
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
export function clearAllModuleDatabases(): void {
  logger.info("Clearing all module databases...");
  for (const [moduleId, db] of dbConnections.entries()) {
    try {
      if (db.isOpen) {
        db.close();
      }
      const dbPath = path.join(MODULES_DIR, moduleId, "data.db");
      fs.unlinkSync(dbPath);
    } catch (err) {
      logger.error(`Error closing database for module "${moduleId}"`, err);
    }
  }
  dbConnections.clear();
}
