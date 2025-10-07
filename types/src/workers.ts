import { Task } from "tasks.js";

export interface Worker {
	id: number;
	currentTasks: Task[];
	availableTools: Tool[];
	loadFactor: number; // (currentTasks.length / maxTasks)
}

export interface Tool {
	name: string;
	downloadUrl: string;
	version: string;
	description?: string;
}
