import { ScheduledTask, TaskContent, TaskExecution, TaskResult, Tool } from "@deepbounty/sdk/types";
import {
  installToolsTask,
  replaceTargetPlaceholders,
  replaceToolPlaceholders,
  replaceCustomDataPlaceholders,
} from "./taskBuilder.js";
import getRegistry from "../utils/registry.js";
import { getMissingTools } from "@/utils/taskUtils.js";
import { getTaskTemplateService } from "./taskTemplateService.js";
import Logger from "@/utils/logger.js";
import { detectTargetId, extractDomainsFromCommands } from "@/utils/domains.js";

const logger = new Logger("Tasks-Manager");
const toolKey = (tool: Tool) => `${tool.name}@${tool.version}`;

// Transport interface for TaskManager to interact with workers
interface TaskTransport {
  listWorkers(): Array<{
    id: number;
    currentTasks: TaskExecution[];
    availableTools: Tool[];
    aggressiveTasksEnabled: boolean;
  }>;
  sendTask(workerId: number, execution: TaskExecution): boolean;
  onRequeueNeeded?(executionIds: number[]): void;
  updateWorkerTools(workerId: number, tools: Tool[]): void;
}

// Listener for task completion events
type TaskCompletionListener = (execution: TaskExecution, result: TaskResult) => void;

// Callback for CUSTOM scheduling mode (called when schedule is due)
type ScheduleCallback = (templateId: number) => void | Promise<void>;

// Callback for manual task triggering
type ManualTriggerCallback = (templateId: number, targetId: number) => void | Promise<void>;

class TaskManager {
  private static instance: TaskManager | null = null;
  private readonly registry = getRegistry();
  private readonly templateService = getTaskTemplateService();
  // Queue of pending execution IDs
  private pendingQueue: number[] = [];
  private transport?: TaskTransport;
  private completionListeners: TaskCompletionListener[] = [];
  // Map of template ID to onSchedule callback (for CUSTOM mode)
  private scheduleCallbacks: Map<number, ScheduleCallback> = new Map();
  // Manual trigger callbacks for tasks
  private manualTriggerCallbacks: Map<number, ManualTriggerCallback> = new Map();
  // Tools currently being installed per worker (to avoid duplicate installs)
  private pendingInstallations: Map<number, Set<string>> = new Map();
  // Scheduler interval handle
  private schedulerInterval?: NodeJS.Timeout;

  private constructor() {
    // Start the scheduler (check every 5 seconds)
    this.startScheduler(5000);
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
   * @param aggressive - Whether the task is aggressive (only run on workers that allow aggressive tasks)
   * @param schedulingType - How to schedule tasks
   * @param onSchedule - For CUSTOM mode: callback invoked at interval to create instances
   * @returns Promise resolving to the template ID
   */
  async registerTaskTemplate(
    moduleId: string,
    uniqueKey: string,
    name: string,
    description: string,
    content: TaskContent,
    interval: number,
    aggressive: boolean,
    schedulingType: "TARGET_BASED" | "GLOBAL" | "CUSTOM" = "TARGET_BASED",
    onSchedule?: (templateId: number) => void | Promise<void>,
    onManualTrigger?: (templateId: number, targetId: number) => void | Promise<void>
  ): Promise<number> {
    // Create or update template in database
    const templateId = await this.templateService.createTemplate(
      moduleId,
      uniqueKey,
      name,
      description,
      content,
      interval,
      aggressive,
      schedulingType
    );

    // Store onSchedule callback for CUSTOM mode
    if (schedulingType === "CUSTOM") {
      if (onSchedule) this.scheduleCallbacks.set(templateId, onSchedule);
      if (onManualTrigger) this.manualTriggerCallbacks.set(templateId, onManualTrigger);
    }

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

    // Remove schedule and manual trigger callbacks if exists
    this.scheduleCallbacks.delete(templateId);
    this.manualTriggerCallbacks.delete(templateId);

    // Delete template from database
    return await this.templateService.deleteTemplate(templateId);
  }

  /*
   * Run a task template immediately for a specific target
   */
  async runTemplateForTarget(templateId: number, targetId: number): Promise<boolean> {
    const template = await this.templateService.getTemplate(templateId);
    if (!template) return false;

    if (template.schedulingType === "TARGET_BASED") {
      // Find the specific scheduled task for this target
      const tasks = this.registry.getScheduledTasksByTemplate(templateId);
      const targetTask = tasks.find((t) => t.targetId === targetId);

      if (!targetTask) {
        logger.warn(`No scheduled task found for template ${templateId} and target ${targetId}`);
        return false;
      }

      // Force create execution
      this.createExecution(targetTask);
      return true;
    } else if (template.schedulingType === "CUSTOM") {
      // Check if the module registered a specific handler for this
      const callback = this.manualTriggerCallbacks.get(templateId);

      if (callback) {
        // Let the module handle the logic (preparing data, creating the instance)
        await callback(templateId, targetId);
        return true;
      } else {
        // The module did not register a handler
        logger.error(`No manual trigger callback registered for template ${templateId}`);
      }
    }

    return false;
  }

  /**
   * Run a task template immediately.
   *
   * - TARGET_BASED / GLOBAL: enqueues one execution per existing scheduled task (even if inactive)
   * - CUSTOM: triggers the onSchedule callback if registered
   *
   * Note: This does not change the template's activation status.
   */
  async runTemplateNow(templateId: number): Promise<boolean> {
    const template = await this.templateService.getTemplate(templateId);
    if (!template) return false;

    // CUSTOM scheduling: prefer calling onSchedule directly to create instances.
    if (template.schedulingType === "CUSTOM") {
      const callback = this.scheduleCallbacks.get(templateId);
      if (callback) {
        await callback(templateId);
        return true;
      }
      // If no callback, fall back to enqueuing any non-scheduler scheduled tasks (if any).
    }

    const scheduledTasks = this.registry.getScheduledTasksByTemplate(templateId);
    logger.info(
      `Running template ${templateId} now: found ${scheduledTasks.length} scheduled tasks`
    );

    for (const scheduledTask of scheduledTasks) {
      // Skip CUSTOM scheduler tasks in fallback mode.
      if (scheduledTask.customData?.__isScheduler) continue;
      this.createExecution(scheduledTask);
    }

    return true;
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

    // Get existing scheduled tasks for this template
    const existingTasks = this.registry.getScheduledTasksByTemplate(templateId);

    // Branch based on scheduling type
    switch (template.schedulingType) {
      case "TARGET_BASED": {
        // Get all targets where this task should run
        const targets = await this.templateService.getTargetsForTask(templateId);
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
            const baseTime = task.lastExecutedAt || new Date();
            const timeSinceLastExecution = Date.now() - baseTime.getTime();

            let nextExecutionAt: Date;
            if (task.interval !== template.interval) {
              if (timeSinceLastExecution >= template.interval * 1000) {
                nextExecutionAt = new Date(Date.now() + 5000);
              } else {
                const remainingTime = template.interval * 1000 - timeSinceLastExecution;
                nextExecutionAt = new Date(Date.now() + remainingTime);
              }
            } else {
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
        break;
      }

      case "GLOBAL": {
        // For GLOBAL tasks, ensure there's exactly ONE scheduled task without targetId
        const globalTasks = existingTasks.filter((t) => t.targetId === undefined);

        if (globalTasks.length === 0) {
          // Create the single global task
          const taskId = this.registry.generateTaskId();
          const now = new Date();
          const scheduledTask: ScheduledTask = {
            id: taskId,
            templateId,
            content: template.content,
            interval: template.interval,
            moduleId: template.moduleId,
            targetId: undefined,
            nextExecutionAt: new Date(now.getTime() + template.interval * 1000),
            active: true,
          };
          this.registry.registerScheduledTask(scheduledTask);
        } else {
          // Update the first global task, delete the rest (should never happen but handle it)
          const mainTask = globalTasks[0];
          const needsUpdate =
            mainTask.interval !== template.interval ||
            JSON.stringify(mainTask.content) !== JSON.stringify(template.content) ||
            mainTask.active !== template.active;

          if (needsUpdate) {
            const baseTime = mainTask.lastExecutedAt || new Date();
            const timeSinceLastExecution = Date.now() - baseTime.getTime();

            let nextExecutionAt: Date;
            if (mainTask.interval !== template.interval) {
              if (timeSinceLastExecution >= template.interval * 1000) {
                nextExecutionAt = new Date(Date.now() + 5000);
              } else {
                const remainingTime = template.interval * 1000 - timeSinceLastExecution;
                nextExecutionAt = new Date(Date.now() + remainingTime);
              }
            } else {
              nextExecutionAt = mainTask.nextExecutionAt;
            }

            this.registry.updateScheduledTask(mainTask.id, {
              content: template.content,
              interval: template.interval,
              active: template.active,
              nextExecutionAt,
            });
          }

          // Remove duplicate global tasks
          for (let i = 1; i < globalTasks.length; i++) {
            this.registry.deleteScheduledTask(globalTasks[i].id);
          }
        }

        // Remove any target-specific tasks that shouldn't exist for GLOBAL
        existingTasks.forEach((task) => {
          if (task.targetId !== undefined) {
            this.registry.deleteScheduledTask(task.id);
          }
        });
        break;
      }

      case "CUSTOM": {
        // For CUSTOM tasks, create ONE scheduler task that triggers the onSchedule callback
        // The callback then creates task instances via createTaskInstance
        // If interval <= 0, no scheduler task is created (manual mode only)
        const schedulerTasks = existingTasks.filter((t) => t.targetId === undefined);

        if (template.interval <= 0) {
          // Manual mode: no automatic scheduling, module uses createTaskInstance only
          // Remove any existing scheduler tasks
          schedulerTasks.forEach((task) => {
            this.registry.deleteScheduledTask(task.id);
          });
        } else if (schedulerTasks.length === 0) {
          // Create the scheduler task
          const taskId = this.registry.generateTaskId();
          const now = new Date();
          const scheduledTask: ScheduledTask = {
            id: taskId,
            templateId,
            content: template.content,
            interval: template.interval,
            moduleId: template.moduleId,
            targetId: undefined,
            nextExecutionAt: new Date(now.getTime() + template.interval * 1000),
            active: true,
            customData: { __isScheduler: true }, // Mark as scheduler task
          };
          this.registry.registerScheduledTask(scheduledTask);
        } else {
          // Update the scheduler task
          const mainTask = schedulerTasks[0];
          const needsUpdate =
            mainTask.interval !== template.interval ||
            JSON.stringify(mainTask.content) !== JSON.stringify(template.content) ||
            mainTask.active !== template.active;

          if (needsUpdate) {
            const baseTime = mainTask.lastExecutedAt || new Date();
            const timeSinceLastExecution = Date.now() - baseTime.getTime();

            let nextExecutionAt: Date;
            if (mainTask.interval !== template.interval) {
              if (timeSinceLastExecution >= template.interval * 1000) {
                nextExecutionAt = new Date(Date.now() + 5000);
              } else {
                const remainingTime = template.interval * 1000 - timeSinceLastExecution;
                nextExecutionAt = new Date(Date.now() + remainingTime);
              }
            } else {
              nextExecutionAt = mainTask.nextExecutionAt;
            }

            this.registry.updateScheduledTask(mainTask.id, {
              content: template.content,
              interval: template.interval,
              active: template.active,
              nextExecutionAt,
            });
          }

          // Remove duplicate scheduler tasks
          for (let i = 1; i < schedulerTasks.length; i++) {
            this.registry.deleteScheduledTask(schedulerTasks[i].id);
          }
        }

        // Remove any target-specific tasks (modules create these via createTaskInstance)
        existingTasks.forEach((task) => {
          if (task.targetId !== undefined || !task.customData?.__isScheduler) {
            // Don't delete manually created instances, only old non-scheduler tasks
            if (task.customData?.__isScheduler === undefined) {
              this.registry.deleteScheduledTask(task.id);
            }
          }
        });
        break;
      }
    }
  }

  /**
   * Create a task instance manually (for CUSTOM scheduling type)
   * Task instances always start immediately upon creation and are automatically deleted after execution.
   * If targetId is not provided, attempts to auto-detect it from domains found in the processed commands.
   * @param templateId - ID of the template to create an instance for
   * @param targetId - Optional target ID for this instance
   * @param customData - Optional custom data to attach to this instance
   * @returns The scheduled task ID
   */
  async createTaskInstance(
    templateId: number,
    targetId?: number,
    customData?: Record<string, any>
  ): Promise<number> {
    const template = await this.templateService.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    // Auto-detect targetId from processed commands if not provided
    if (!targetId) {
      // Process commands with customData placeholders first
      const processedCommands = await replaceCustomDataPlaceholders(
        template.content.commands,
        customData,
        undefined // No targetId yet
      );

      // Extract domains from the processed commands
      const domains = extractDomainsFromCommands(processedCommands);

      // Try to detect targetId from each extracted domain
      for (const domain of domains) {
        const detectedId = await detectTargetId(domain);
        if (detectedId) {
          targetId = detectedId;
          break;
        }
      }
    }

    // Verify this is a CUSTOM template
    if (template.schedulingType !== "CUSTOM") {
      throw new Error(`Cannot manually create instances for ${template.schedulingType} templates`);
    }

    const taskId = this.registry.generateTaskId();
    const now = new Date();

    // CUSTOM task instances are always one-time tasks
    // They execute immediately and are automatically deleted after execution
    const scheduledTask: ScheduledTask = {
      id: taskId,
      templateId,
      content: template.content,
      interval: template.interval,
      moduleId: template.moduleId,
      targetId,
      nextExecutionAt: now, // Always immediate for CUSTOM instances
      active: true,
      customData,
      oneTime: true, // Always true for manually created instances
    };

    this.registry.registerScheduledTask(scheduledTask);

    // Immediately create an execution and try to assign it
    this.createExecution(scheduledTask);

    // Mark as executed to prevent the scheduler from creating a duplicate execution
    // The scheduler will delete this task when it sees it's oneTime=true and already executed
    // We set nextExecutionAt to a very distant future to ensure the scheduler doesn't pick it up
    // before it's cleaned up by handleWorkerResult
    this.registry.updateScheduledTask(taskId, {
      lastExecutedAt: now,
      nextExecutionAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
    });

    return taskId;
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
   * Start the task scheduler
   * @param checkInterval - Interval in milliseconds between scheduler checks (default: 10000)
   * @private
   */
  private startScheduler(checkInterval: number = 10000) {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
    }
    this.schedulerInterval = setInterval(() => {
      this.checkDueTasks().catch((err) => {
        logger.error(`Error checking due tasks: ${err.message}`);
      });
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
  private async checkDueTasks() {
    const dueTasks = this.registry.getDueScheduledTasks();
    for (const scheduledTask of dueTasks) {
      // Skip inactive tasks
      if (!scheduledTask.active) {
        // Update next execution time even for inactive tasks (if not oneTime)
        if (!scheduledTask.oneTime) {
          const now = new Date();
          this.registry.updateScheduledTask(scheduledTask.id, {
            lastExecutedAt: now,
            nextExecutionAt: new Date(now.getTime() + scheduledTask.interval * 1000),
          });
        }
        continue;
      }

      // Check if this is a CUSTOM scheduler task
      if (scheduledTask.customData?.__isScheduler) {
        // Call the onSchedule callback instead of creating an execution
        const callback = this.scheduleCallbacks.get(scheduledTask.templateId);
        if (callback) {
          try {
            const result = callback(scheduledTask.templateId);
            if (result instanceof Promise) {
              result.catch((err) => {
                logger.error(
                  `Error in onSchedule callback for template ${scheduledTask.templateId}:`,
                  err
                );
              });
            }
          } catch (err) {
            logger.error(
              `Error in onSchedule callback for template ${scheduledTask.templateId}:`,
              err
            );
          }
        }

        // Update next execution time
        const now = new Date();
        this.registry.updateScheduledTask(scheduledTask.id, {
          lastExecutedAt: now,
          nextExecutionAt: new Date(now.getTime() + scheduledTask.interval * 1000),
        });
        continue;
      }

      // Regular task execution
      this.createExecution(scheduledTask);

      // Handle oneTime tasks: delete after execution
      if (scheduledTask.oneTime) {
        // Get template name before deleting for logging
        const templateName = scheduledTask.templateId
          ? (await this.templateService.getTemplate(scheduledTask.templateId))?.name || "unknown"
          : "unknown";
        this.registry.deleteScheduledTask(scheduledTask.id);
      } else {
        // Update next execution time for recurring tasks
        const now = new Date();
        this.registry.updateScheduledTask(scheduledTask.id, {
          lastExecutedAt: now,
          nextExecutionAt: new Date(now.getTime() + scheduledTask.interval * 1000),
        });
      }
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
      templateId: scheduledTask.templateId,
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
      customData: scheduledTask.customData,
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
   */
  async assignNextTask() {
    if (!this.transport) {
      return;
    }

    // If we are already assigning, mark that a new request came in so we run again later.
    if ((this as any)._assigning) {
      (this as any)._hasPendingRequest = true;
      return;
    }

    // Lock the scheduler
    (this as any)._assigning = true;
    (this as any)._hasPendingRequest = false;

    try {
      // Loop as long as there are pending requests (handles new tasks added during processing)
      do {
        (this as any)._hasPendingRequest = false; // Clear flag for this pass

        // Capture initial length to avoid infinite loops if we re-queue items
        let tasksToCheck = this.pendingQueue.length;

        if (tasksToCheck === 0) {
          continue;
        }

        while (tasksToCheck > 0) {
          tasksToCheck--;

          // Get fresh list of workers
          let workers = this.transport.listWorkers();

          // If no workers exist/have credits, stop.
          if (workers.length === 0) break;

          // Take the next task from the queue
          const nextExecutionId = this.pendingQueue.shift();
          if (nextExecutionId === undefined) break;

          const execution = this.registry.getTaskExecution(nextExecutionId);
          // If task is missing or no longer pending, skip it
          if (!execution || execution.status !== "pending") {
            continue;
          }

          // Filter for Aggressive Workers if needed
          let compatibleWorkers = workers;
          if (execution.templateId) {
            const template = await this.templateService.getTemplate(execution.templateId);
            if (template?.aggressive) {
              compatibleWorkers = workers.filter((w) => w.aggressiveTasksEnabled);
            }
          }

          // If task needs aggressive worker but none are available
          if (compatibleWorkers.length === 0) {
            // Re-queue execution for later
            this.pendingQueue.push(nextExecutionId);
            continue;
          }

          compatibleWorkers.sort((a, b) => {
            // Always prioritize the worker with fewer tasks (Load Balancing)
            const loadDiff = a.currentTasks.length - b.currentTasks.length;
            if (loadDiff !== 0) return loadDiff;

            // If loads are equal, prefer the worker that is not aggressive (save the aggressive one)
            return (a.aggressiveTasksEnabled ? 1 : 0) - (b.aggressiveTasksEnabled ? 1 : 0);
          });

          // Find a worker that isn't busy installing tools for this specific task
          let chosen: (typeof workers)[number] | undefined;
          let missingTools: Tool[] = [];

          for (const worker of compatibleWorkers) {
            const missing = getMissingTools(worker.availableTools, execution.content.requiredTools);
            const pendingSet = this.pendingInstallations.get(worker.id);
            const hasOverlap = pendingSet ? missing.some((t) => pendingSet.has(toolKey(t))) : false;

            if (!hasOverlap) {
              chosen = worker;
              missingTools = missing;
              break;
            }
          }

          // If all eligible workers are busy installing tools, re-queue execution
          if (!chosen) {
            this.pendingQueue.push(nextExecutionId);
            continue;
          }

          // Prepare execution object (handle tool installation injection)
          let executionToSend = execution;
          if (missingTools.length > 0) {
            const pendingSet = this.pendingInstallations.get(chosen.id) || new Set<string>();
            missingTools.forEach((tool) => pendingSet.add(toolKey(tool)));
            this.pendingInstallations.set(chosen.id, pendingSet);

            // Clone content to inject installation commands
            executionToSend = {
              ...execution,
              content: {
                ...execution.content,
                commands: [...execution.content.commands],
              },
            };
            executionToSend.content.commands = installToolsTask(
              missingTools,
              executionToSend.content
            );
          }

          // Replace placeholders (Tools, Targets, CustomData)
          executionToSend.content.commands = replaceToolPlaceholders(
            executionToSend.content.commands,
            executionToSend.content.requiredTools || []
          );
          executionToSend.content.commands = await replaceTargetPlaceholders(
            executionToSend.content.commands,
            executionToSend.targetId
          );
          executionToSend.content.commands = await replaceCustomDataPlaceholders(
            executionToSend.content.commands,
            executionToSend.customData,
            executionToSend.targetId
          );

          // Send to worker
          const sent = this.transport.sendTask(chosen.id, executionToSend);

          if (!sent) {
            // Sending failed - re-queue execution
            this.pendingQueue.push(nextExecutionId);
            continue;
          }

          // Success: update registry
          this.registry.updateTaskExecution(execution.executionId, {
            workerId: chosen.id,
            status: "running",
          });
          // Get template name for logging
          const scheduledTask = this.registry.getScheduledTask(execution.scheduledTaskId);
          const templateName = scheduledTask?.templateId
            ? (await this.templateService.getTemplate(scheduledTask.templateId))?.name
            : "unknown";

          logger.info(
            `Sending task execution ${execution.executionId} (${templateName}) to worker ${chosen.id}`
          );
        }
      } while ((this as any)._hasPendingRequest);
    } catch (err) {
      logger.error(`Error while assigning tasks: ${err}`);
    } finally {
      // Always unlock the scheduler
      (this as any)._assigning = false;
      (this as any)._hasPendingRequest = false;
    }
  }
  /**
   * Handle a worker disconnection
   * Requeues all running tasks from the disconnected worker
   * @param workerId - ID of the disconnected worker
   */
  handleWorkerDisconnect(workerId: number) {
    // Clear any pending install tracking for this worker
    this.pendingInstallations.delete(workerId);

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

    const targetId = execution.targetId ?? result.targetId;
    const templateId = execution.templateId ?? updatedExecution.templateId;

    if (result.success) {
      logger.info(
        `Task execution ${execution.executionId} completed: templateId=${templateId ?? "n/a"} scheduledTaskId=${result.scheduledTaskId} targetId=${targetId ?? "n/a"} workerId=${workerId}`
      );
    } else {
      logger.warn(
        `Task execution ${execution.executionId} failed: templateId=${templateId ?? "n/a"} scheduledTaskId=${result.scheduledTaskId} targetId=${targetId ?? "n/a"} workerId=${workerId}`
      );
    }

    // If a new tool was installed, update associated worker tool list and clear pending installs
    const taskRequiredTools = execution.content.requiredTools || [];
    if (taskRequiredTools.length > 0) {
      const pendingSet = this.pendingInstallations.get(workerId);
      if (pendingSet) {
        taskRequiredTools.forEach((tool) => pendingSet.delete(toolKey(tool)));
        if (pendingSet.size === 0) {
          this.pendingInstallations.delete(workerId);
        }
      }

      this.transport?.updateWorkerTools(workerId, taskRequiredTools);
    }

    // Enrich result with customData from execution
    const enrichedResult: TaskResult = {
      ...result,
      customData: execution.customData,
    };

    // Notify listeners
    this.completionListeners.forEach((cb) => {
      try {
        cb(updatedExecution, enrichedResult);
      } catch {}
    });

    // Cleanup one-time scheduled tasks
    // This ensures that manually created task instances are removed from the registry
    // after they have completed execution
    const scheduledTask = this.registry.getScheduledTask(execution.scheduledTaskId);
    if (scheduledTask && scheduledTask.oneTime) {
      this.registry.deleteScheduledTask(scheduledTask.id);
    }
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
