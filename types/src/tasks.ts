export interface Task {
	id: number;
	type: "tool" | "command";
	payload: Record<string, any>;
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
