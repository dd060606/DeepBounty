import { Tool } from "./tools";

export interface Task {
	id: number;
	// List of shell commands to execute
	commands: string[];
	// Tools required to execute the task
	requiredTools?: Tool[];
	// Assigned worker ID
	workerId: number;
	status: "pending" | "running" | "completed" | "failed";
	createdAt: Date;
}

export interface TaskResult {
	taskId: number;
	success: boolean;
	// Result data or error message
	output?: any;
	error?: string;
}
