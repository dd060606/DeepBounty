import { Task } from "./tasks";
import { Tool } from "./tools";

export interface Worker {
	id: number;
	currentTasks: Task[];
	availableTools: Tool[];
	loadFactor: number; // (currentTasks.length / maxTasks)
}
