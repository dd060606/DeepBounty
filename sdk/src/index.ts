import { ModuleSetting, TaskContent, TaskResult, Tool } from "./types";

export interface Logger {
	info: (...args: any[]) => void;
	warn: (...args: any[]) => void;
	error: (...args: any[]) => void;
}

export interface ConfigAPI {
	/** Get a configuration value by key
	 * @param key The configuration key
	 * @param defaultValue The default value to return if the key does not exist
	 * @returns The configuration value
	 */
	get<T = any>(key: string, defaultValue?: T): Promise<T>;

	/** Set a configuration value by key
	 * @param key The configuration key
	 * @param value The configuration value
	 * @returns A promise that resolves when the value is set
	 */
	set<T = any>(key: string, value: T): Promise<void>;

	/** Remove a configuration value by key
	 * @param key The configuration key
	 * @returns A promise that resolves when the value is removed
	 */
	remove(key: string): Promise<void>;

	// Get all configuration key-value pairs
	getAll(): Promise<Record<string, any>>;

	/** Get a specific module setting by name
	 * @param name The setting name
	 * @returns The module setting
	 */
	getSetting(name: string): Promise<ModuleSetting>;

	/** Set a specific module setting by name
	 * @param name The setting name
	 * @param value The setting value
	 * @returns A promise that resolves when the value is set
	 */
	setSetting(name: string, value: any): Promise<void>;

	/** Get all module settings
	 * @returns An array of all module settings
	 */
	getAllSettings(): Promise<ModuleSetting[]>;
}

export interface StorageAPI {
	/**
	 * Execute a raw SQL query (SELECT)
	 * @param sql The SQL query to execute
	 * @param params Optional parameters for the query
	 * @returns All matching rows
	 */
	query<T = any>(sql: string, params?: any[]): T[];

	/**
	 * Execute a raw SQL query and return the first row
	 * @param sql The SQL query to execute
	 * @param params Optional parameters for the query
	 * @returns The first matching row or undefined
	 */
	queryOne<T = any>(sql: string, params?: any[]): T | undefined;

	/**
	 * Execute a raw SQL statement (INSERT, UPDATE, DELETE)
	 * @param sql The SQL statement to execute
	 * @param params Optional parameters for the statement
	 * @returns Information about the execution (changes, lastInsertRowid)
	 */
	execute(
		sql: string,
		params?: any[]
	): { changes: number | bigint; lastInsertRowid: number | bigint };

	/**
	 * Helper method to create a table if it doesn't exist
	 * @param tableName The name of the table to create
	 * @param schema The schema definition for the table
	 */
	createTable(tableName: string, schema: string): void;

	/**
	 * Helper method to drop a table
	 * @param tableName The name of the table to drop
	 */
	dropTable(tableName: string): void;
}

export interface ServerAPI {
	version: string; // SDK version
	logger: Logger;
	config: ConfigAPI;
	storage: StorageAPI;
	/**
	 * Register a task template that can be scheduled for all targets
	 * @param uniqueKey Unique identifier for this task within the module (e.g., "subdomain-scan")
	 * @param name Friendly name for the task
	 * @param description Task description
	 * @param taskContent The task content including commands and tools
	 * @param interval Interval in seconds between task executions
	 * @param onComplete Optional callback executed when the task completes
	 * @returns The ID of the registered task template
	 */
	registerTaskTemplate(
		uniqueKey: string,
		name: string,
		description: string,
		taskContent: TaskContent,
		interval: number,
		onComplete?: (result: TaskResult) => void
	): Promise<number>;

	/**
	 * Unregister a task template
	 * @param templateId The ID of the task template to unregister
	 * @returns true if the template was unregistered, false if it didn't exist
	 */
	unregisterTaskTemplate(templateId: number): Promise<boolean>;

	/** Register a tool
	 * @param tool The tool to register
	 */
	registerTool(tool: Tool): void;
}

export interface PluginLifecycle {
	run?(api: ServerAPI): Promise<void> | void;
	stop?(): Promise<void> | void;
}

export type PluginFactory = (
	api: ServerAPI
) => PluginLifecycle | Promise<PluginLifecycle>;

export default {} as any; // Type-only module for plugins to import types during compile
