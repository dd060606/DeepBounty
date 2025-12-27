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
  console.log(`Running combined commands: ${combinedScript}`);

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

/**
 * Handle incoming WebSocket messages
 * @param message The received message data
 * @param sendMessage Callback to send messages back to the server
 */
export const handleMessage = async (
  message: any,
  sendMessage: (type: string, data: any) => void
) => {
  try {
    const parsed = JSON.parse(message.toString());
    const { type, data } = parsed;

    console.log(`Received message type: ${type}`);

    switch (type) {
      // Execute assigned task
      case "task:start": {
        const task: TaskExecution = data;

        // Execute the task
        const result = await executeTask(task);

        // Send result back to server
        sendMessage("task:result", result);
        break;
      }
      // Respond to ping with pong
      case "ping": {
        sendMessage("pong", {});
        break;
      }
      // Shutdown the worker
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
