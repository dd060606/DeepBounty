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

export interface ServerAPI {
	version: string; // SDK version
	logger: Logger;
	config: ConfigAPI;
	storage: StorageAPI;
	events: IEventBus;
	/**
	 * Register a task template that can be scheduled for all targets
	 * @param uniqueKey Unique identifier for this task within the module (e.g., "subdomain-scan")
	 * @param name Friendly name for the task
	 * @param description Task description
	 * @param taskContent The task content including commands and tools
	 * @param interval Interval in seconds between task executions
	 * @param schedulingType How to schedule tasks: "TARGET_BASED" (one per target), "GLOBAL" (single instance), or "CUSTOM" (callback-based)
	 * @param onComplete Optional callback executed when a task instance completes
	 * @param onSchedule Optional callback for CUSTOM mode, invoked at interval to create instances
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
	 * @param targetId The ID of the target
	 * @param name The title of the alert
	 * @param subdomain The subdomain where the vulnerability was found
	 * @param score The severity score (0=Informational, 1=Low, 2=Medium, 3=High, 4=Critical)
	 * @param description Detailed description of the alert
	 * @param endpoint Specific endpoint/path where the vulnerability was found
	 * @param confirmed Whether the vulnerability has been confirmed (default: false)
	 * @returns The created alert ID
	 */
	createAlert(
		targetId: number,
		name: string,
		subdomain: string,
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
export {
	IEventBus,
	EventSubscription,
	CoreEvents,
	EventHandler,
} from "./events";

export default {} as any; // Type-only module for modules to import types during compile
