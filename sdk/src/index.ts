import { Alert, ModuleSetting, TaskContent, TaskResult, Tool } from "./types";
import { IEventBus } from "./events";

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

/**
 * ScopedDirectory provides isolated file system access within a specific directory.
 * All file operations are restricted to the base directory and its subdirectories.
 */
export interface ScopedDirectory {
	/**
	 * Write binary data to a file (creates parent directories if needed)
	 * @param relativePath Path relative to this directory (supports nested paths like "subfolder/file.bin")
	 * @param data Binary data to write
	 */
	writeFile(relativePath: string, data: Buffer | Uint8Array): void;

	/**
	 * Write text to a file (creates parent directories if needed)
	 * @param relativePath Path relative to this directory (supports nested paths like "logs/output.txt")
	 * @param text Text content to write
	 * @param encoding Text encoding (default: "utf8")
	 */
	writeFileText(
		relativePath: string,
		text: string,
		encoding?: BufferEncoding
	): void;

	/**
	 * Read binary data from a file
	 * @param relativePath Path relative to this directory
	 * @returns Binary data as Buffer
	 */
	readFile(relativePath: string): Buffer;

	/**
	 * Read text from a file
	 * @param relativePath Path relative to this directory
	 * @param encoding Text encoding (default: "utf8")
	 * @returns Text content
	 */
	readFileText(relativePath: string, encoding?: BufferEncoding): string;

	/**
	 * Delete a file
	 * @param relativePath Path relative to this directory
	 */
	deleteFile(relativePath: string): void;

	/**
	 * Get a scoped subdirectory (creates it if it doesn't exist)
	 * Returns a new ScopedDirectory object for the subdirectory
	 * @param relativePath Path relative to this directory
	 * @returns New ScopedDirectory for the subdirectory
	 */
	getSubdirectory(relativePath: string): ScopedDirectory;

	/**
	 * List all files in a directory (optionally in a subdirectory)
	 * @param subdirPath Optional subdirectory path to list files from
	 * @returns Array of relative file paths
	 */
	listFiles(subdirPath?: string): string[];

	/**
	 * Check if a file exists
	 * @param relativePath Path relative to this directory
	 * @returns true if the file exists, false otherwise
	 */
	fileExists(relativePath: string): boolean;
}

/**
 * FilesAPI provides file system access for modules.
 * Each module can create isolated directories within their module folder.
 */
export interface FilesAPI {
	/**
	 * Get or create a directory by path (supports nested paths like "cache/images")
	 * Returns a ScopedDirectory object for isolated file operations.
	 * The directory is automatically created if it doesn't exist.
	 *
	 * @param directoryPath Directory path relative to module's files folder (e.g., "cache", "exports/json")
	 * @returns ScopedDirectory object for file operations within this directory
	 */
	getDirectory(directoryPath: string): ScopedDirectory;
}

export interface ServerAPI {
	version: string; // SDK version
	logger: Logger;
	config: ConfigAPI;
	storage: StorageAPI;
	files: FilesAPI;
	events: IEventBus;
	/**
	 * Register a task template that can be scheduled for all targets
	 * @param uniqueKey Unique identifier for this task within the module (e.g., "subdomain-scan")
	 * @param name Friendly name for the task
	 * @param description Task description
	 * @param taskContent The task content including commands and tools
	 * @param interval Interval in seconds between task executions. For CUSTOM mode: if <= 0, no automatic scheduling (manual mode only)
	 * @param schedulingType How to schedule tasks: "TARGET_BASED" (one per target), "GLOBAL" (single instance), or "CUSTOM" (callback-based)
	 * @param onComplete Optional callback executed when a task instance completes
	 * @param onSchedule Optional callback for CUSTOM mode, invoked at interval to create instances (not called if interval <= 0)
	 * @returns The ID of the registered task template
	 */
	registerTaskTemplate(
		uniqueKey: string,
		name: string,
		description: string,
		taskContent: TaskContent,
		interval: number,
		schedulingType?: "TARGET_BASED" | "GLOBAL" | "CUSTOM",
		onComplete?: (result: TaskResult) => void,
		onSchedule?: (templateId: number) => void | Promise<void>
	): Promise<number>;

	/**
	 * Unregister a task template
	 * @param templateId The ID of the task template to unregister
	 * @returns true if the template was unregistered, false if it didn't exist
	 */
	unregisterTaskTemplate(templateId: number): Promise<boolean>;

	/**
	 * Create a task instance manually (for CUSTOM scheduling type)
	 * Task instances are always one-time and automatically deleted after execution.
	 * @param templateId The ID of the task template
	 * @param targetId Optional target ID for this instance
	 * @param customData Optional custom data to attach to this instance (accessible via {{KEY}} placeholders)
	 * @returns The scheduled task ID
	 */
	createTaskInstance(
		templateId: number,
		targetId?: number,
		customData?: Record<string, any>
	): Promise<number>;

	/** Register a tool
	 * @param tool The tool to register
	 */
	registerTool(tool: Tool): void;

	/**
	 * Create a new alert for a target
	 * The target is automatically detected from the subdomain parameter
	 * @param name The title of the alert
	 * @param subdomain The subdomain where the vulnerability was found (can be main domain or subdomain)
	 * @param score The severity score (0=Informational, 1=Low, 2=Medium, 3=High, 4=Critical)
	 * @param description Detailed description of the alert
	 * @param endpoint Specific endpoint/path where the vulnerability was found
	 * @param confirmed Whether the vulnerability has been confirmed (default: false)
	 * @returns The created alert
	 */
	createAlert(
		name: string,
		subdomain: string,
		score: number,
		description: string,
		endpoint: string,
		confirmed?: boolean
	): Promise<Alert>;

	/**
	 * Create a new alert for a target using its ID
	 * @param name The title of the alert
	 * @param targetId The ID of the target
	 * @param score The severity score (0=Informational, 1=Low, 2=Medium, 3=High, 4=Critical)
	 * @param description Detailed description of the alert
	 * @param endpoint Specific endpoint/path where the vulnerability was found
	 * @param confirmed Whether the vulnerability has been confirmed (default: false)
	 * @returns The created alert
	 */
	createAlert(
		name: string,
		targetId: number,
		score: number,
		description: string,
		endpoint: string,
		confirmed?: boolean
	): Promise<Alert>;
}

export interface ModuleLifecycle {
	run?(api: ServerAPI): Promise<void> | void;
	stop?(): Promise<void> | void;
}

export type ModuleFactory = (
	api: ServerAPI
) => ModuleLifecycle | Promise<ModuleLifecycle>;

// Re-export EventBus and related types
export * from "./events";

export default {} as any; // Type-only module for modules to import types during compile
