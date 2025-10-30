import { TaskContent, TaskResult, Tool } from "@deepbounty/sdk/types";
import getTaskManager from "./taskManager.js";

/**
 * Task API for modules to register scheduled tasks
 * This acts as a simplified interface for modules to interact with the TaskManager
 */
export class TaskAPI {
  private readonly taskManager = getTaskManager();
  // Store completion callbacks for tasks, keyed by scheduledTaskId
  private taskCallbacks: Map<number, (result: TaskResult) => void> = new Map();

  constructor(private moduleId: string) {
    // Listen for task completion events
    this.taskManager.onTaskComplete((execution, result) => {
      this.handleTaskComplete(result);
    });
  }

  /**
   * Register a scheduled task that runs at a specific interval
   * @param taskContent The task content including commands and required tools
   * @param interval Interval in seconds between task executions
   * @param onComplete Optional callback executed when the task completes
   * @returns The ID of the registered scheduled task
   */
  registerScheduledTask(
    taskContent: TaskContent,
    interval: number,
    onComplete?: (result: TaskResult) => void
  ): number {
    const taskId = this.taskManager.registerTask(taskContent, interval, this.moduleId);

    // Store callback if provided
    if (onComplete) {
      this.taskCallbacks.set(taskId, onComplete);
    }

    return taskId;
  }

  /**
   * Unregister a scheduled task
   * @param taskId The ID of the scheduled task to unregister
   * @returns true if the task was unregistered, false if it didn't exist
   */
  unregisterScheduledTask(taskId: number): boolean {
    // Remove callback
    this.taskCallbacks.delete(taskId);
    return this.taskManager.unregisterTask(taskId);
  }

  // Handle task completion and notify waiting callbacks
  private handleTaskComplete(result: TaskResult) {
    const callback = this.taskCallbacks.get(result.scheduledTaskId);
    if (!callback) return;

    // Notify callback
    try {
      callback(result);
    } catch (error) {
      console.error(`Error in task completion callback for task ${result.scheduledTaskId}:`, error);
    }
  }

  // Get all scheduled tasks registered by this module
  getModuleTasks() {
    return this.taskManager.getScheduledTasksByModule(this.moduleId);
  }
}

// Map of moduleId to TaskAPI instance
const taskAPIInstances: Map<string, TaskAPI> = new Map();

/**
 * Initialize or get the TaskAPI instance for a specific module
 * @param moduleId The ID of the module
 * @returns TaskAPI instance for the module
 */
export function getTaskAPI(moduleId: string): TaskAPI {
  let instance = taskAPIInstances.get(moduleId);
  if (!instance) {
    instance = new TaskAPI(moduleId);
    taskAPIInstances.set(moduleId, instance);
  }
  return instance;
}
