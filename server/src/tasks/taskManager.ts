import { ScheduledTask, TaskContent, TaskExecution, TaskResult, Tool } from "@deepbounty/sdk/types";
import { installToolsTask, replaceToolPlaceholders } from "./taskBuilder.js";
import getRegistry from "../utils/registry.js";

// Transport interface for TaskManager to interact with workers
interface TaskTransport {
  listWorkers(): Array<{
    id: number;
    currentTasks: TaskExecution[];
    availableTools: Tool[];
    loadFactor: number;
  }>;
  sendTask(workerId: number, execution: TaskExecution): boolean;
  onRequeueNeeded?(executionIds: number[]): void;
}

// Listener for task completion events
type TaskCompletionListener = (execution: TaskExecution, result: TaskResult) => void;

class TaskManager {
  private static instance: TaskManager | null = null;
  private readonly registry = getRegistry();
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

  // Get the singleton instance
  public static getInstance(): TaskManager {
    if (!TaskManager.instance) {
      TaskManager.instance = new TaskManager();
    }
    return TaskManager.instance;
  }

  registerTransport(transport: TaskTransport) {
    this.transport = transport;
  }

  onTaskComplete(listener: TaskCompletionListener) {
    this.completionListeners.push(listener);
  }

  // Check which tools are missing on a worker for a given task
  private getMissingTools(content: TaskContent, workerTools: Tool[]): Tool[] {
    if (!content.requiredTools || content.requiredTools.length === 0) {
      return [];
    }

    const missingTools: Tool[] = [];
    for (const requiredTool of content.requiredTools) {
      const hasToolInstalled = workerTools.some(
        (wt) => wt.name === requiredTool.name && wt.version === requiredTool.version
      );
      if (!hasToolInstalled) {
        missingTools.push(requiredTool);
      }
    }
    return missingTools;
  }

  // Register a scheduled task
  registerTask(content: TaskContent, interval: number, moduleId: string): number {
    const taskId = this.registry.generateTaskId();
    const now = new Date();
    const scheduledTask: ScheduledTask = {
      id: taskId,
      content,
      interval,
      moduleId,
      nextExecutionAt: new Date(now.getTime() + interval * 1000),
    };
    this.registry.registerScheduledTask(scheduledTask);
    return taskId;
  }

  // Unregister a scheduled task
  unregisterTask(taskId: number): boolean {
    if (!this.registry.hasScheduledTask(taskId)) {
      return false;
    }
    this.registry.deleteScheduledTask(taskId);
    return true;
  }

  // Start the scheduler
  private startScheduler(checkInterval: number = 10000) {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
    }
    this.schedulerInterval = setInterval(() => {
      this.checkDueTasks();
    }, checkInterval);
  }

  // Stop the scheduler
  stopScheduler() {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = undefined;
    }
  }

  // Check for due tasks and create executions
  private checkDueTasks() {
    const dueTasks = this.registry.getDueScheduledTasks();
    for (const scheduledTask of dueTasks) {
      this.createExecution(scheduledTask);
      // Update next execution time
      const now = new Date();
      this.registry.updateScheduledTask(scheduledTask.id, {
        lastExecutedAt: now,
        nextExecutionAt: new Date(now.getTime() + scheduledTask.interval * 1000),
      });
    }
  }

  // Create a task execution from a scheduled task
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
    };
    this.registry.registerTaskExecution(execution);
    this.pendingQueue.push(executionId);
    this.assignNextTask();
  }

  // Attempt to assign the next pending execution to an available worker
  assignNextTask(): boolean {
    if (!this.transport) return false;
    let assigned = false;

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

      // Compute a dynamic load factor if not provided
      const enriched = workers.map((w) => ({
        ...w,
        effectiveLoad:
          isFinite(w.loadFactor) && w.loadFactor > 0 ? w.loadFactor : w.currentTasks.length,
      }));
      enriched.sort((a, b) => a.effectiveLoad - b.effectiveLoad);
      // Select the worker with the lowest effective load
      const chosen = enriched[0];
      if (!chosen) break;

      // Check if the worker has all required tools
      const missingTools = this.getMissingTools(execution.content, chosen.availableTools);
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
            extractResult: execution.content.extractResult, // Preserve extractResult
          },
        };
        // Add installation commands for missing tools
        executionToSend.content.commands = installToolsTask(missingTools, executionToSend.content);
      }
      // Replace tool placeholders in commands before sending
      executionToSend.content.commands = replaceToolPlaceholders(
        executionToSend.content.commands,
        executionToSend.content.requiredTools || []
      );

      // Assign execution to chosen worker
      this.registry.updateTaskExecution(execution.executionId, {
        workerId: chosen.id,
        status: "running",
      });
      const sent = this.transport.sendTask(chosen.id, executionToSend);
      if (sent) {
        this.pendingQueue.shift();
        assigned = true;
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
    return assigned;
  }

  handleWorkerConnect(_workerId: number) {
    // Try to dispatch tasks when a new worker arrives
    this.assignNextTask();
  }

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
      this.assignNextTask();
    }
  }

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

    // Notify listeners
    this.completionListeners.forEach((cb) => {
      try {
        cb(updatedExecution, result);
      } catch {}
    });
  }

  // Helper methods to query scheduled tasks
  getScheduledTask(id: number): ScheduledTask | undefined {
    return this.registry.getScheduledTask(id);
  }

  getAllScheduledTasks(): ScheduledTask[] {
    return this.registry.getAllScheduledTasks();
  }

  getScheduledTasksByModule(moduleId: string): ScheduledTask[] {
    return this.registry.getScheduledTasksByModule(moduleId);
  }

  // Helper methods to query executions
  getTaskExecution(executionId: number): TaskExecution | undefined {
    return this.registry.getTaskExecution(executionId);
  }

  getAllTaskExecutions(): TaskExecution[] {
    return this.registry.getAllTaskExecutions();
  }

  getTaskExecutionsByStatus(status: TaskExecution["status"]): TaskExecution[] {
    return this.registry.getTaskExecutionsByStatus(status);
  }

  getPendingExecutions(): TaskExecution[] {
    return this.registry.getTaskExecutionsByStatus("pending");
  }

  getRunningExecutions(): TaskExecution[] {
    return this.registry.getTaskExecutionsByStatus("running");
  }

  // Get execution statistics
  getExecutionStats() {
    return this.registry.getExecutionStats();
  }

  // Clear old completed/failed executions
  clearOldExecutions(olderThan: Date): number {
    return this.registry.clearOldExecutions(olderThan);
  }
}

export default TaskManager.getInstance;
