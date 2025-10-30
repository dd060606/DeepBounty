import { TaskExecution } from "./tasks";
import { Tool } from "./tools";

// Server-side representation of a worker
export interface Worker {
	id: number;
	currentTasks: TaskExecution[];
	availableTools: Tool[];
	loadFactor: number; // (currentTasks.length / maxTasks)
}
