import { exec } from "child_process";
import { promisify } from "util";
import type { TaskExecution, TaskResult } from "@deepbounty/sdk/types";
import { createTaskResult, extractResult, replaceTempFilePlaceholders } from "./utils.js";

const execAsync = promisify(exec);

/**
 * Execute a single task
 * @param task The task to execute
 * @returns The task result
 */
export const executeTask = async (task: TaskExecution): Promise<TaskResult> => {
  console.log(`Executing task ${task.executionId}...`);

  // Replace temp file placeholders in commands
  const processedCommands = replaceTempFilePlaceholders(task.executionId, task.content.commands);
  // Combine commands into a single script to maintain context
  const combinedScript = processedCommands.join("\n");

  if (process.env.NODE_ENV !== "production") {
    // Log the combined script for debugging
    console.log(`Running combined commands: ${combinedScript}`);
  }

  try {
    const { stdout, stderr } = await execAsync(combinedScript, {
      cwd: "/tools",
      shell: "/bin/bash",
      maxBuffer: 100 * 1024 * 1024,
    });

    if (stderr) console.warn(`Command stderr: ${stderr}`);

    // Extract result if needed
    const output = extractResult(stdout, task.content.extractResult || false);
    console.log(`Task ${task.executionId} completed successfully`);
    return createTaskResult(task, true, output);
  } catch (error: any) {
    console.error(`Commands failed`, error);
    const combinedOutput = `${error?.stdout ?? ""}${error?.stderr ?? ""}`.trim() || undefined;
    return createTaskResult(
      task,
      false,
      combinedOutput,
      error?.message || "Command execution failed"
    );
  }
};

export type SendMessage = (type: string, data: any) => void;

export interface MessageHandlerOptions {
  sendMessage: SendMessage;
  maxConcurrency: number;
}

/**
 * Create a WebSocket message handler for the worker.
 *
 * The worker does minimal flow-control:
 * - Executes tasks up to maxConcurrency.
 * - If tasks arrive beyond capacity (shouldn't happen if server enforces), queues locally.
 * - Emits `worker:busy` when it has to queue.
 * - Emits `worker:ready {count: 1}` when a slot frees AND no local backlog exists.
 */
export const createMessageHandler = ({ sendMessage, maxConcurrency }: MessageHandlerOptions) => {
  let activeCount = 0;
  const localQueue: TaskExecution[] = [];

  const maybeStartNext = () => {
    while (activeCount < maxConcurrency && localQueue.length > 0) {
      const next = localQueue.shift();
      if (!next) break;
      runTask(next);
    }
  };

  const runTask = (task: TaskExecution) => {
    activeCount += 1;

    executeTask(task)
      .then((result) => {
        sendMessage("task:result", result);
      })
      .catch((error: any) => {
        // executeTask should not throw, but keep worker resilient.
        console.error("Unexpected task execution failure:", error);
        sendMessage(
          "task:result",
          createTaskResult(task, false, undefined, error?.message || "Task execution failed")
        );
      })
      .finally(() => {
        activeCount = Math.max(0, activeCount - 1);

        // Prefer draining local backlog first
        maybeStartNext();

        // If we're not busy and not backlogged, tell server we can accept one more task.
        if (localQueue.length === 0 && activeCount < maxConcurrency) {
          sendMessage("worker:ready", { count: 1 });
        }
      });
  };

  return (message: any) => {
    try {
      const parsed = JSON.parse(message.toString());
      const { type, data } = parsed;

      switch (type) {
        case "task:start": {
          const task: TaskExecution = data;

          if (activeCount >= maxConcurrency) {
            console.warn(
              `Received task ${task.executionId} while at capacity (${activeCount}/${maxConcurrency}). ` +
                `Queueing locally.`
            );
            localQueue.push(task);
            sendMessage("worker:busy", { queued: localQueue.length });
            return;
          }

          runTask(task);
          return;
        }
        case "ping": {
          sendMessage("pong", {});
          return;
        }
        case "system:shutdown": {
          console.log("Received shutdown command from server. Exiting...");
          process.exit(0);
        }
        default: {
          console.warn(`Unknown message type: ${type}`);
        }
      }
    } catch (error: any) {
      console.error("Error handling message:", error);
    }
  };
};
