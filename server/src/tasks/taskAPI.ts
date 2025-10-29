import { ServerTask, TaskContent, TaskResult, Tool } from "@deepbounty/sdk/types";
import TaskManager from "./taskManager.js";
import { resolveTools } from "@/modules/moduleTools.js";

/**
 * Task API for modules to submit tasks
 */
export class TaskAPI {
  private taskManager: TaskManager;
  private nextTaskId: number = 1;
  // Store pending task promises
  private pendingTasks: Map<
    number,
    {
      resolve: (result: TaskResult) => void;
      reject: (error: Error) => void;
    }
  > = new Map();

  constructor(taskManager: TaskManager) {
    this.taskManager = taskManager;
    // Listen for task completion events
    this.taskManager.onTaskComplete((task, result) => {
      this.handleTaskComplete(task.id, result);
    });
  }

  /**
   * Submit a task and wait for its result
   * @param taskContent The task content including commands and required tools
   * @returns Promise that resolves with the task result
   */
  async submitTask(taskContent: TaskContent): Promise<TaskResult> {
    const taskId = this.nextTaskId++;

    // Resolve tool names to full Tool objects
    const resolvedTools = resolveTools(taskContent.requiredTools);

    const task: ServerTask = {
      id: taskId,
      commands: taskContent.commands,
      requiredTools: resolvedTools,
      status: "pending",
      createdAt: new Date(),
    };

    // Create a promise that will be resolved when the task completes
    const resultPromise = new Promise<TaskResult>((resolve, reject) => {
      this.pendingTasks.set(taskId, {
        resolve,
        reject,
      });
    });

    // Enqueue the task
    try {
      this.taskManager.enqueue(task);
    } catch (error) {
      // Clean up if enqueue fails
      this.pendingTasks.delete(taskId);
      throw error;
    }

    return resultPromise;
  }

  /**
   * Handle task completion
   */
  private handleTaskComplete(taskId: number, result: TaskResult) {
    const pending = this.pendingTasks.get(taskId);
    if (!pending) return;

    // Resolve or reject based on task success
    if (result.success) {
      pending.resolve(result);
    } else {
      pending.reject(new Error(result.error || "Task failed"));
    }

    // Clean up
    this.pendingTasks.delete(taskId);
  }
}

// Global singleton instance
let taskAPIInstance: TaskAPI | null = null;

/**
 * Initialize the global TaskAPI instance
 */
export function initTaskAPI(taskManager: TaskManager): TaskAPI {
  taskAPIInstance = new TaskAPI(taskManager);
  return taskAPIInstance;
}

/**
 * Get the global TaskAPI instance
 */
export function getTaskAPI(): TaskAPI {
  if (!taskAPIInstance) {
    throw new Error("TaskAPI not initialized. Call initTaskAPI first.");
  }
  return taskAPIInstance;
}
