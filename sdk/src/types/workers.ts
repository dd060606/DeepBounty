import { TaskExecution } from "./tasks";
import { Tool } from "./tools";

// Server-side representation of a worker
export interface Worker {
	id: number;
	ip?: string;
	currentTasks: TaskExecution[];
	availableTools: Tool[];
	connectedAt: Date;
}
