export interface ModuleSetting {
	name: string;
	type: "checkbox" | "text" | "select" | "info";
	default: string | boolean;
	label: string;
	value?: string | boolean;
	// Optional options for select-type settings
	options?: string[];
}

export interface Module {
	// Unique identifier
	id: string;
	// Human readable name
	name: string;
	// Version string
	version: string;
	// Short description
	description?: string;
	// Settings
	settings?: ModuleSetting[];
}

export interface LoadedModule extends Module {
	run: () => Promise<any>;
}
