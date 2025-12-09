import { TaskContent, TaskResult, Tool } from "@deepbounty/sdk/types";
import getTaskManager from "./taskManager.js";
import Logger from "@/utils/logger.js";

const logger = new Logger("TaskAPI");

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
   * Register a task template that runs across all targets
   */
  async registerTaskTemplate(
    uniqueKey: string,
    name: string,
    description: string,
    taskContent: TaskContent,
    interval: number,
    schedulingType: "TARGET_BASED" | "GLOBAL" | "CUSTOM" = "TARGET_BASED",
    onComplete?: (result: TaskResult) => void,
    onSchedule?: (templateId: number) => void | Promise<void>
  ): Promise<number> {
    const templateId = await this.taskManager.registerTaskTemplate(
      this.moduleId,
      uniqueKey,
      name,
      description,
      taskContent,
      interval,
      schedulingType,
      onSchedule
    );

    // Store callback for result handling (all modes including CUSTOM)
    if (onComplete) {
      this.taskCallbacks.set(templateId, onComplete);
    }

    return templateId;
  } /**
   * Unregister a task template
   */
  async unregisterTaskTemplate(templateId: number): Promise<boolean> {
    this.taskCallbacks.delete(templateId);
    return await this.taskManager.unregisterTaskTemplate(templateId);
  }

  /**
   * Create a task instance manually (for CUSTOM scheduling type)
   * @param templateId - ID of the template to create an instance for
   * @param targetId - Optional target ID for this instance
   * @param customData - Optional custom data to attach to this instance
   * @param oneTime - If true, delete the scheduled task after execution (default: false)
   * @returns The scheduled task ID
   */
  async createTaskInstance(
    templateId: number,
    targetId?: number,
    customData?: Record<string, any>,
    oneTime: boolean = false
  ): Promise<number> {
    return await this.taskManager.createTaskInstance(templateId, targetId, customData, oneTime);
  }

  // Handle task completion and notify waiting callbacks
  private handleTaskComplete(result: TaskResult) {
    // Get the scheduled task to find the template ID
    const scheduledTask = this.taskManager.getScheduledTask(result.scheduledTaskId);
    if (!scheduledTask) {
      logger.warn(`Scheduled task ${result.scheduledTaskId} not found for result callback`);
      return;
    }

    // Look up the callback using the template ID
    const callback = this.taskCallbacks.get(scheduledTask.templateId);
    if (!callback) {
      // Silently return if no callback (this is normal for some tasks)
      return;
    }

    logger.info(
      `Executing callback for template ${scheduledTask.templateId}, execution ${result.executionId}, success: ${result.success}`
    );

    // Notify callback
    try {
      callback(result);
    } catch (error) {
      logger.error(
        `Error in task completion callback for task ${result.scheduledTaskId}: ${(error as Error).message}`
      );
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
