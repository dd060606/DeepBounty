import { Tool } from "./tools";

export interface Module {
	// Unique identifier (e.g., "example-module")
	id: string;
	// Module details
	name: string;
	version: string;
	// Entry point file
	entry: string;
	// Short description
	description?: string;
	// Configuration settings
	settings?: ModuleSetting[];
	// Tools required by the module
	tools?: Tool[];
}
export interface ModuleSetting {
	name: string;
	type: "checkbox" | "text" | "select" | "info";
	default: string | boolean;
	label: string;
	value?: string | boolean;
	// Optional options for select-type settings
	options?: string[];
}

export interface LoadedModule extends Module {
	run: () => Promise<any>;
	tools?: Tool[];
}
