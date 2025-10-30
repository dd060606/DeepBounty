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

export interface ServerAPI {
	version: string; // SDK version
	logger: Logger;
	config: ConfigAPI;
	/**
	 * Register a scheduled task that runs at a specific interval
	 * @param taskContent The task content including commands and required tools
	 * @param interval Interval in seconds between task executions
	 * @param onComplete Optional callback executed when the task completes
	 * @returns The ID of the registered scheduled task
	 */
	registerScheduledTask(
		taskContent: TaskContent,
		interval: number,
		onComplete?: (result: TaskResult) => void
	): number;

	/**
	 * Unregister a scheduled task
	 * @param taskId The ID of the scheduled task to unregister
	 * @returns true if the task was unregistered, false if it didn't exist
	 */
	unregisterScheduledTask(taskId: number): boolean;

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
