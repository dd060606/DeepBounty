import { Tool } from "./tools";

// Scheduling type for task templates
export type SchedulingType = "TARGET_BASED" | "GLOBAL" | "CUSTOM";

export interface TaskContent {
	// List of shell commands to execute
	commands: string[];
	// Tools required to execute the task
	requiredTools?: Tool[];
	// Optional: Extract specific output using markers
	// Use echo "<<<RESULT_START>>>" and echo "<<<RESULT_END>>>" to mark the result
	extractResult?: boolean;
}

// Task template registered by a module (stored in DB)
export interface TaskTemplate {
	// Unique template ID
	id: number;
	// Module that registered this task
	moduleId: string;
	// Unique key for this task within the module (e.g., "subdomain-scan")
	uniqueKey: string;
	// Friendly task name
	name: string;
	// Task description
	description?: string;
	// Task content (commands and tools)
	content: TaskContent;
	// Interval for task execution in seconds
	interval: number;
	// Scheduling type (TARGET_BASED, GLOBAL, or CUSTOM)
	schedulingType: SchedulingType;
	// Global activation status
	active: boolean;
	// Whether the task is marked as aggressive
	aggressive: boolean;
}

// Registered scheduled task (template)
export interface ScheduledTask {
	// Unique task ID
	id: number;
	// Reference to the task template
	templateId: number;
	// Task content (commands and tools)
	content: TaskContent;
	// Interval for task execution in seconds
	interval: number;
	// Module that registered this task
	moduleId: string;
	// Target ID (if this task is for a specific target)
	targetId?: number;
	// Last execution timestamp
	lastExecutedAt?: Date;
	// Next scheduled execution
	nextExecutionAt: Date;
	// Whether this task is active
	active: boolean;
	// Custom data for CUSTOM scheduling type
	customData?: Record<string, any>;
	// If true, delete task after execution (for one-time CUSTOM tasks)
	oneTime?: boolean;
}

// Task instance being executed by a worker
export interface TaskExecution {
	// Unique execution ID
	executionId: number;
	// Reference to the scheduled task
	scheduledTaskId: number;
	// Reference to the task template
	templateId?: number;
	// Assigned worker ID
	workerId?: number;
	// Execution status
	status: "pending" | "running" | "completed" | "failed";
	// When this execution was created
	createdAt: Date;
	// Task content (snapshot from scheduled task)
	content: TaskContent;
	// Target ID (if this execution is for a specific target)
	targetId?: number;
	// Custom data passed from scheduled task
	customData?: Record<string, any>;
}

// Result of a completed task execution
export interface TaskResult {
	executionId: number;
	scheduledTaskId: number;
	success: boolean;
	// Result data or error message
	output?: string;
	error?: string;
	// Target ID (if this execution was for a specific target)
	targetId?: number;
	// Custom data from the execution
	customData?: Record<string, any>;
}

// Override for target-specific task activation
export interface TargetTaskOverride {
	id: number;
	targetId: number;
	taskTemplateId: number;
	active: boolean;
}
