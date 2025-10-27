import { Task, TaskResult } from "@deepbounty/sdk/types";

// Transport interface for TaskManager to interact with workers
interface TaskTransport {
  listWorkers(): Array<{
    id: number;
    currentTasks: Task[];
    availableTools: any[];
    loadFactor: number;
  }>;
  sendTask(workerId: number, task: Task): boolean;
  onRequeueNeeded?(taskIds: number[]): void;
}

// Listener for task completion events
type TaskCompletionListener = (task: Task, result: TaskResult) => void;

class TaskManager {
  private tasks: Map<number, Task> = new Map();
  // Queue of pending task IDs
  private pendingQueue: number[] = [];
  private transport?: TaskTransport;
  private completionListeners: TaskCompletionListener[] = [];

  registerTransport(transport: TaskTransport) {
    this.transport = transport;
  }

  onTaskComplete(listener: TaskCompletionListener) {
    this.completionListeners.push(listener);
  }

  // Add a new task to the queue
  enqueue(task: Task) {
    // Check for existing task with same ID
    if (this.tasks.has(task.id)) {
      const existing = this.tasks.get(task.id)!;
      if (existing.status === "running" || existing.status === "pending") {
        throw new Error(`Task ${task.id} already queued or running`);
      }
    }
    // Normalize fields
    task.status = "pending";
    task.createdAt = task.createdAt || new Date();
    // Not assigned yet
    task.workerId = 0;
    this.tasks.set(task.id, task);
    this.pendingQueue.push(task.id);
    this.assignNextTask();
  }

  // Attempt to assign the next pending task to an available worker
  assignNextTask(): boolean {
    if (!this.transport) return false;
    let assigned = false;

    // Try to fill as many tasks as possible while workers are available
    for (let safety = 0; safety < 1000; safety++) {
      const nextTaskId = this.pendingQueue[0];
      // Pending queue empty
      if (nextTaskId == null) break;

      const task = this.tasks.get(nextTaskId);
      // Pending task missing or not pending anymore
      if (!task || task.status !== "pending") {
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

      // Assign task to chosen worker
      task.workerId = chosen.id;
      task.status = "running";
      const sent = this.transport.sendTask(chosen.id, task);
      if (sent) {
        this.pendingQueue.shift();
        assigned = true;
        continue;
      } else {
        // Could not send; mark back to pending & break to avoid tight loop
        task.status = "pending";
        task.workerId = 0;
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
    // Requeue tasks that were running on that worker
    const toRequeue: number[] = [];
    this.tasks.forEach((task) => {
      // Only requeue tasks that were running on the disconnected worker
      if (task.workerId === workerId && task.status === "running") {
        task.status = "pending";
        task.workerId = 0;
        if (!this.pendingQueue.includes(task.id)) {
          this.pendingQueue.unshift(task.id);
        }
        toRequeue.push(task.id);
      }
    });
    if (toRequeue.length) {
      this.transport?.onRequeueNeeded?.(toRequeue);
      // Attempt immediate reassignment
      this.assignNextTask();
    }
  }

  handleWorkerResult(workerId: number, result: TaskResult) {
    const task = this.tasks.get(result.taskId);
    if (!task) return;
    if (task.workerId !== workerId) {
      // Stale or duplicated result (ignore)
      return;
    }
    task.status = result.success ? "completed" : "failed";
    // Notify listeners
    this.completionListeners.forEach((cb) => {
      try {
        cb(task, result);
      } catch {}
    });
  }
}

export default TaskManager;
