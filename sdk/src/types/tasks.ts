import { Tool } from "./tools";

export interface TaskContent {
	// List of shell commands to execute
	commands: string[];
	// Tools required to execute the task (can be Tool objects or tool names as strings)
	requiredTools?: (Tool | string)[];
}

export interface Task extends TaskContent {
	// Unique task ID
	id: number;
}

// Task representation within the server
export interface ServerTask extends Task {
	// Assigned worker ID
	workerId?: number;
	status: "pending" | "running" | "completed" | "failed";
	createdAt: Date;
	// Resolved tools (always Tool objects, not strings)
	requiredTools?: Tool[];
}

// Result of a completed task
export interface TaskResult {
	taskId: number;
	success: boolean;
	// Result data or error message
	output?: any;
	error?: string;
}
