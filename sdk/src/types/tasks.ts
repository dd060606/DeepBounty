import { Tool } from "./tools";

export interface TaskContent {
	// List of shell commands to execute
	commands: string[];
	// Tools required to execute the task
	requiredTools?: Tool[];
	// Optional: Extract specific output using markers
	// Use echo "<<<RESULT_START>>>" and echo "<<<RESULT_END>>>" to mark the result
	extractResult?: boolean;
}

// Registered scheduled task (template)
export interface ScheduledTask {
	// Unique task ID
	id: number;
	// Task content (commands and tools)
	content: TaskContent;
	// Interval for task execution in seconds
	interval: number;
	// Module that registered this task
	moduleId: string;
	// Last execution timestamp
	lastExecutedAt?: Date;
	// Next scheduled execution
	nextExecutionAt: Date;
}

// Task instance being executed by a worker
export interface TaskExecution {
	// Unique execution ID
	executionId: number;
	// Reference to the scheduled task
	scheduledTaskId: number;
	// Assigned worker ID
	workerId?: number;
	// Execution status
	status: "pending" | "running" | "completed" | "failed";
	// When this execution was created
	createdAt: Date;
	// Task content (snapshot from scheduled task)
	content: TaskContent;
}

// Result of a completed task execution
export interface TaskResult {
	executionId: number;
	scheduledTaskId: number;
	success: boolean;
	// Result data or error message
	output?: any;
	error?: string;
}
