import { ScheduledTask, TaskContent, TaskExecution, TaskResult, Tool } from "@deepbounty/sdk/types";
import {
  installToolsTask,
  replaceTargetPlaceholders,
  replaceToolPlaceholders,
} from "./taskBuilder.js";
import getRegistry from "../utils/registry.js";
import { getMissingTools } from "@/utils/taskUtils.js";
import { getTaskTemplateService } from "./taskTemplateService.js";
import Logger from "@/utils/logger.js";

const logger = new Logger("Tasks-Manager");

// Transport interface for TaskManager to interact with workers
interface TaskTransport {
  listWorkers(): Array<{
    id: number;
    currentTasks: TaskExecution[];
    availableTools: Tool[];
  }>;
  sendTask(workerId: number, execution: TaskExecution): boolean;
  onRequeueNeeded?(executionIds: number[]): void;
  updateWorkerTools(workerId: number, tools: Tool[]): void;
}

// Listener for task completion events
type TaskCompletionListener = (execution: TaskExecution, result: TaskResult) => void;

class TaskManager {
  private static instance: TaskManager | null = null;
  private readonly registry = getRegistry();
  private readonly templateService = getTaskTemplateService();
  // Queue of pending execution IDs
  private pendingQueue: number[] = [];
  private transport?: TaskTransport;
  private completionListeners: TaskCompletionListener[] = [];
  // Scheduler interval handle
  private schedulerInterval?: NodeJS.Timeout;

  private constructor() {
    // Start the scheduler (check every 10 seconds)
    this.startScheduler(10000);
  }

  /**
   * Get the singleton instance of TaskManager
   * @returns The TaskManager instance
   */
  public static getTaskManager(): TaskManager {
    if (!TaskManager.instance) {
      TaskManager.instance = new TaskManager();
    }
    return TaskManager.instance;
  }

  /**
   * Register the transport layer for worker communication
   * @param transport - The transport interface to use
   */
  registerTransport(transport: TaskTransport) {
    this.transport = transport;
  }

  /**
   * Register a listener for task completion events
   * @param listener - Callback function called when a task completes
   */
  onTaskComplete(listener: TaskCompletionListener) {
    this.completionListeners.push(listener);
  }

  /**
   * Register a task template that creates scheduled tasks for all active targets
   * @param moduleId - ID of the module registering the task
   * @param uniqueKey - Unique identifier for this task within the module (e.g., "subdomain-scan")
   * @param name - Friendly name for the task
   * @param description - Detailed description of what the task does
   * @param content - Task content including commands and required tools
   * @param interval - Execution interval in seconds
   * @returns Promise resolving to the template ID
   */
  async registerTaskTemplate(
    moduleId: string,
    uniqueKey: string,
    name: string,
    description: string,
    content: TaskContent,
    interval: number
  ): Promise<number> {
    // Create or update template in database
    const templateId = await this.templateService.createTemplate(
      moduleId,
      uniqueKey,
      name,
      description,
      content,
      interval
    );

    // Create scheduled tasks for all active targets
    await this.syncTasksForTemplate(templateId);

    logger.info(`Module '${moduleId}' registered task '${name}' (ID: ${templateId})`);

    return templateId;
  }

  /**
   * Unregister a task template and all its associated scheduled tasks
   * @param templateId - ID of the template to unregister
   * @returns Promise resolving to true if successful, false otherwise
   */
  async unregisterTaskTemplate(templateId: number): Promise<boolean> {
    // Delete all scheduled tasks for this template
    const scheduledTasks = this.registry.getScheduledTasksByTemplate(templateId);
    scheduledTasks.forEach((task) => {
      this.registry.deleteScheduledTask(task.id);
    });

    // Delete template from database
    return await this.templateService.deleteTemplate(templateId);
  }

  /**
   * Synchronize scheduled tasks for a template across all applicable targets
   * Creates tasks for new targets, removes tasks for inactive targets,
   * and updates interval for existing tasks if template interval changed
   * @param templateId - ID of the template to synchronize
   */
  async syncTasksForTemplate(templateId: number): Promise<void> {
    const template = await this.templateService.getTemplate(templateId);
    if (!template) return;

    // Get all targets where this task should run
    const targets = await this.templateService.getTargetsForTask(templateId);

    // Get existing scheduled tasks for this template
    const existingTasks = this.registry.getScheduledTasksByTemplate(templateId);
    const existingTargetIds = new Set(
      existingTasks.filter((t) => t.targetId !== undefined).map((t) => t.targetId!)
    );

    // Update existing tasks with new interval and content if changed
    existingTasks.forEach((task) => {
      const needsUpdate =
        task.interval !== template.interval ||
        JSON.stringify(task.content) !== JSON.stringify(template.content) ||
        task.active !== template.active;

      if (needsUpdate) {
        // Calculate new nextExecutionAt based on the new interval
        // If the task hasn't run yet or lastExecutedAt is not set, schedule from now
        const baseTime = task.lastExecutedAt || new Date();
        const timeSinceLastExecution = Date.now() - baseTime.getTime();

        // If interval changed, reschedule appropriately
        let nextExecutionAt: Date;
        if (task.interval !== template.interval) {
          // If time since last execution exceeds new interval, execute soon
          if (timeSinceLastExecution >= template.interval * 1000) {
            nextExecutionAt = new Date(Date.now() + 5000); // Execute in 5 seconds
          } else {
            // Schedule based on remaining time with new interval
            const remainingTime = template.interval * 1000 - timeSinceLastExecution;
            nextExecutionAt = new Date(Date.now() + remainingTime);
          }
        } else {
          // Keep existing nextExecutionAt if interval didn't change
          nextExecutionAt = task.nextExecutionAt;
        }

        this.registry.updateScheduledTask(task.id, {
          content: template.content,
          interval: template.interval,
          active: template.active,
          nextExecutionAt,
        });
      }
    });

    // Create new scheduled tasks for targets that don't have one
    for (const target of targets) {
      if (!existingTargetIds.has(target.id)) {
        const taskId = this.registry.generateTaskId();
        const now = new Date();
        const scheduledTask: ScheduledTask = {
          id: taskId,
          templateId,
          content: template.content,
          interval: template.interval,
          moduleId: template.moduleId,
          targetId: target.id,
          nextExecutionAt: new Date(now.getTime() + template.interval * 1000),
          active: true,
        };
        this.registry.registerScheduledTask(scheduledTask);
      }
    }

    // Remove scheduled tasks for targets that are no longer applicable
    const validTargetIds = new Set(targets.map((t) => t.id));
    existingTasks.forEach((task) => {
      if (task.targetId !== undefined && !validTargetIds.has(task.targetId)) {
        this.registry.deleteScheduledTask(task.id);
      }
    });
  }

  /**
   * Synchronize all tasks when a new target is added or target settings change
   * Ensures all templates have scheduled tasks for all applicable targets
   */
  async syncAllTasks(): Promise<void> {
    const templates = await this.templateService.getAllTemplates();
    for (const template of templates) {
      await this.syncTasksForTemplate(template.id);
    }
  }

  /**
   * Enable or disable a task template globally for all targets
   * @param templateId - ID of the template to modify
   * @param active - true to enable, false to disable
   * @returns Promise resolving to true if successful
   */
  async setTaskTemplateActive(templateId: number, active: boolean): Promise<boolean> {
    const success = await this.templateService.setTemplateActive(templateId, active);
    if (success) {
      await this.syncTasksForTemplate(templateId);
    }
    return success;
  }

  /**
   * Enable or disable a task template for a specific target
   * Creates an override that takes precedence over the global setting
   * @param templateId - ID of the template to modify
   * @param targetId - ID of the target to apply the override to
   * @param active - true to enable, false to disable for this target
   */
  async setTaskActiveForTarget(
    templateId: number,
    targetId: number,
    active: boolean
  ): Promise<void> {
    await this.templateService.setTargetOverride(targetId, templateId, active);
    await this.syncTasksForTemplate(templateId);
  }

  /**
   * Register a scheduled task (legacy method for backward compatibility)
   * @deprecated Use registerTaskTemplate instead for multi-target support
   * @param content - Task content including commands and required tools
   * @param interval - Execution interval in seconds
   * @param moduleId - ID of the module registering the task
   * @returns The scheduled task ID
   */
  registerTask(content: TaskContent, interval: number, moduleId: string): number {
    const taskId = this.registry.generateTaskId();
    const now = new Date();
    const scheduledTask: ScheduledTask = {
      id: taskId,
      templateId: 0, // Legacy tasks don't have a template
      content,
      interval,
      moduleId,
      nextExecutionAt: new Date(now.getTime() + interval * 1000),
      active: true,
    };
    this.registry.registerScheduledTask(scheduledTask);
    return taskId;
  }

  /**
   * Unregister a scheduled task (legacy method)
   * @deprecated Use unregisterTaskTemplate instead
   * @param taskId - ID of the task to unregister
   * @returns true if successful, false if task not found
   */
  unregisterTask(taskId: number): boolean {
    if (!this.registry.hasScheduledTask(taskId)) {
      return false;
    }
    this.registry.deleteScheduledTask(taskId);
    return true;
  }

  /**
   * Start the task scheduler
   * @param checkInterval - Interval in milliseconds between scheduler checks (default: 10000)
   * @private
   */
  private startScheduler(checkInterval: number = 10000) {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
    }
    this.schedulerInterval = setInterval(() => {
      this.checkDueTasks();
    }, checkInterval);
  }

  /**
   * Stop the task scheduler
   * Clears the scheduler interval to prevent further task executions
   */
  stopScheduler() {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = undefined;
    }
  }

  /**
   * Check for due tasks and create executions
   * Called periodically by the scheduler
   * @private
   */
  private checkDueTasks() {
    const dueTasks = this.registry.getDueScheduledTasks();
    for (const scheduledTask of dueTasks) {
      // Skip inactive tasks
      if (!scheduledTask.active) {
        // Update next execution time even for inactive tasks
        const now = new Date();
        this.registry.updateScheduledTask(scheduledTask.id, {
          lastExecutedAt: now,
          nextExecutionAt: new Date(now.getTime() + scheduledTask.interval * 1000),
        });
        continue;
      }

      this.createExecution(scheduledTask);
      // Update next execution time
      const now = new Date();
      this.registry.updateScheduledTask(scheduledTask.id, {
        lastExecutedAt: now,
        nextExecutionAt: new Date(now.getTime() + scheduledTask.interval * 1000),
      });
    }
  }

  /**
   * Create a task execution from a scheduled task
   * @param scheduledTask - The scheduled task to create an execution for
   * @private
   */
  private createExecution(scheduledTask: ScheduledTask) {
    const executionId = this.registry.generateExecutionId();
    const execution: TaskExecution = {
      executionId,
      scheduledTaskId: scheduledTask.id,
      status: "pending",
      createdAt: new Date(),
      content: {
        commands: [...scheduledTask.content.commands],
        requiredTools: scheduledTask.content.requiredTools
          ? [...scheduledTask.content.requiredTools]
          : undefined,
        extractResult: scheduledTask.content.extractResult,
      },
      targetId: scheduledTask.targetId,
    };
    this.registry.registerTaskExecution(execution);
    this.pendingQueue.push(executionId);
    // Don't await here to avoid blocking the scheduler
    this.assignNextTask().catch((err) => {
      logger.error(`Error assigning task: ${err.message}`);
    });
  }

  /**
   * Attempt to assign the next pending execution to an available worker
   * Handles tool installation, placeholder replacement, and load balancing
   */
  async assignNextTask() {
    if (!this.transport) return;

    // Prevent concurrent executions of this method
    if ((this as any)._assigning) return;
    (this as any)._assigning = true;

    try {
      // Try to fill as many executions as possible while workers are available
      for (let safety = 0; safety < 1000; safety++) {
        const nextExecutionId = this.pendingQueue[0];
        // Pending queue empty
        if (nextExecutionId == null) break;

        const execution = this.registry.getTaskExecution(nextExecutionId);
        // Pending execution missing or not pending anymore
        if (!execution || execution.status !== "pending") {
          this.pendingQueue.shift();
          continue;
        }

        // Get list of available workers
        const workers = this.transport.listWorkers();
        if (!workers.length) break;

        // Select the worker with the lowest effective load
        workers.sort((a, b) => a.currentTasks.length - b.currentTasks.length);
        const chosen = workers[0];
        if (!chosen) break;

        // Check if the worker has all required tools
        const missingTools = getMissingTools(
          chosen.availableTools,
          execution.content.requiredTools
        );
        let executionToSend = execution;

        // If tools are missing, augment the execution with installation commands
        if (missingTools.length > 0) {
          // Clone the execution to avoid modifying the original
          executionToSend = {
            ...execution,
            content: {
              commands: [...execution.content.commands],
              requiredTools: execution.content.requiredTools
                ? [...execution.content.requiredTools]
                : undefined,
              extractResult: execution.content.extractResult,
            },
          };
          // Add installation commands for missing tools
          executionToSend.content.commands = installToolsTask(
            missingTools,
            executionToSend.content
          );
        }
        // Replace tool placeholders in commands before sending
        executionToSend.content.commands = replaceToolPlaceholders(
          executionToSend.content.commands,
          executionToSend.content.requiredTools || []
        );

        // Replace target placeholders if applicable
        executionToSend.content.commands = await replaceTargetPlaceholders(
          executionToSend.content.commands,
          executionToSend.targetId
        );

        // Assign execution to chosen worker
        this.registry.updateTaskExecution(execution.executionId, {
          workerId: chosen.id,
          status: "running",
        });
        logger.info(`Sending task execution ${execution.executionId} to worker ${chosen.id}`);
        const sent = this.transport.sendTask(chosen.id, executionToSend);
        if (sent) {
          this.pendingQueue.shift();
          continue;
        } else {
          // Could not send; mark back to pending & break to avoid tight loop
          this.registry.updateTaskExecution(execution.executionId, {
            status: "pending",
            workerId: undefined,
          });
          break;
        }
      }
    } finally {
      (this as any)._assigning = false;
    }
  }

  /**
   * Handle a new worker connection
   * Attempts to assign pending tasks to the newly connected worker
   * @param _workerId - ID of the connected worker (unused but kept for interface compatibility)
   */
  handleWorkerConnect(_workerId: number) {
    // Try to dispatch tasks when a new worker arrives
    this.assignNextTask().catch((err) => {
      logger.error(`Error assigning task on worker connect: ${err.message}`);
    });
  }

  /**
   * Handle a worker disconnection
   * Requeues all running tasks from the disconnected worker
   * @param workerId - ID of the disconnected worker
   */
  handleWorkerDisconnect(workerId: number) {
    // Requeue executions that were running on that worker
    const toRequeue: number[] = [];
    const workerExecutions = this.registry.getTaskExecutionsByWorkerId(workerId);

    workerExecutions.forEach((execution) => {
      // Only requeue executions that were running on the disconnected worker
      if (execution.status === "running") {
        this.registry.updateTaskExecution(execution.executionId, {
          status: "pending",
          workerId: undefined,
        });
        if (!this.pendingQueue.includes(execution.executionId)) {
          this.pendingQueue.unshift(execution.executionId);
        }
        toRequeue.push(execution.executionId);
      }
    });

    if (toRequeue.length) {
      this.transport?.onRequeueNeeded?.(toRequeue);
      // Attempt immediate reassignment
      this.assignNextTask().catch((err) => {
        logger.error(`Error assigning task on worker disconnect: ${err.message}`);
      });
    }
  }

  /**
   * Handle a task result from a worker
   * Updates execution status and notifies completion listeners
   * @param workerId - ID of the worker that executed the task
   * @param result - The task execution result
   */
  handleWorkerResult(workerId: number, result: TaskResult) {
    const execution = this.registry.getTaskExecution(result.executionId);
    if (!execution) return;
    if (execution.workerId !== workerId) {
      // Stale or duplicated result (ignore)
      return;
    }

    // Update execution status
    this.registry.updateTaskExecution(execution.executionId, {
      status: result.success ? "completed" : "failed",
    });

    // Get updated execution for listeners
    const updatedExecution = this.registry.getTaskExecution(execution.executionId);
    if (!updatedExecution) return;

    // If a new tool was installed, update associated worker tool list
    const taskRequiredTools = execution.content.requiredTools || [];
    if (taskRequiredTools.length > 0) {
      this.transport?.updateWorkerTools(workerId, taskRequiredTools);
    }

    // Notify listeners
    this.completionListeners.forEach((cb) => {
      try {
        cb(updatedExecution, result);
      } catch {}
    });
  }

  /**
   * Get a scheduled task by ID
   * @param id - The scheduled task ID
   * @returns The scheduled task or undefined if not found
   */
  getScheduledTask(id: number): ScheduledTask | undefined {
    return this.registry.getScheduledTask(id);
  }

  /**
   * Get all scheduled tasks
   * @returns Array of all scheduled tasks
   */
  getAllScheduledTasks(): ScheduledTask[] {
    return this.registry.getAllScheduledTasks();
  }

  /**
   * Get all scheduled tasks registered by a specific module
   * @param moduleId - The module ID to filter by
   * @returns Array of scheduled tasks for the module
   */
  getScheduledTasksByModule(moduleId: string): ScheduledTask[] {
    return this.registry.getScheduledTasksByModule(moduleId);
  }

  /**
   * Get a task execution by ID
   * @param executionId - The execution ID
   * @returns The task execution or undefined if not found
   */
  getTaskExecution(executionId: number): TaskExecution | undefined {
    return this.registry.getTaskExecution(executionId);
  }

  /**
   * Get all task executions
   * @returns Array of all task executions
   */
  getAllTaskExecutions(): TaskExecution[] {
    return this.registry.getAllTaskExecutions();
  }

  /**
   * Get task executions filtered by status
   * @param status - The execution status to filter by
   * @returns Array of task executions with the specified status
   */
  getTaskExecutionsByStatus(status: TaskExecution["status"]): TaskExecution[] {
    return this.registry.getTaskExecutionsByStatus(status);
  }

  /**
   * Get all pending task executions
   * @returns Array of pending task executions
   */
  getPendingExecutions(): TaskExecution[] {
    return this.registry.getTaskExecutionsByStatus("pending");
  }

  /**
   * Get all running task executions
   * @returns Array of running task executions
   */
  getRunningExecutions(): TaskExecution[] {
    return this.registry.getTaskExecutionsByStatus("running");
  }

  /**
   * Clear old completed or failed task executions
   * Removes executions that are older than the specified date
   * @param olderThan - Date threshold; executions before this date will be removed
   */
  clearOldExecutions(olderThan: Date) {
    this.registry.clearOldExecutions(olderThan);
  }
}

export default TaskManager.getTaskManager;
