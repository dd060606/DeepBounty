import { exec } from "child_process";
import { promisify } from "util";
import type { TaskExecution, TaskResult } from "@deepbounty/sdk/types";
import { extractResult, replaceTempFilePlaceholders } from "./utils.js";

const execAsync = promisify(exec);

/**
 * Execute a single task
 * @param task The task to execute
 * @returns The task result
 */
export const executeTask = async (task: TaskExecution): Promise<TaskResult> => {
  console.log(`Executing task ${task.executionId}...`);

  try {
    const results: string[] = [];

    // Replace temp file placeholders
    const processedCommands = replaceTempFilePlaceholders(task.executionId, task.content.commands);

    // Combine all commands into a single bash script to maintain context
    // This allows cd commands to affect subsequent commands
    const combinedScript = processedCommands.join(" && ");

    console.log(`Running combined commands: ${combinedScript}`);

    try {
      const { stdout, stderr } = await execAsync(combinedScript, {
        // Execute commands in the tools directory as base
        cwd: "/tools",
        // Use bash to support all shell features
        shell: "/bin/bash",
      });

      if (stderr) {
        console.warn(`Command stderr: ${stderr}`);
      }

      // Extract result if markers are used
      const finalOutput = extractResult(stdout, task.content.extractResult || false);
      results.push(finalOutput);
    } catch (error: any) {
      console.error(`Commands failed`, error);

      return {
        executionId: task.executionId,
        scheduledTaskId: task.scheduledTaskId,
        success: false,
        error: error.message || error,
        output: results.length > 0 ? results : undefined,
      };
    }

    console.log(`Task ${task.executionId} completed successfully`);

    return {
      executionId: task.executionId,
      scheduledTaskId: task.scheduledTaskId,
      success: true,
      output: results,
    };
  } catch (error: any) {
    console.error(`Task ${task.executionId} execution error:`, error);

    return {
      executionId: task.executionId,
      scheduledTaskId: task.scheduledTaskId,
      success: false,
      error: error.message || "Unknown error occurred",
    };
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
      default: {
        console.warn(`Unknown message type: ${type}`);
      }
    }
  } catch (error: any) {
    console.error("Error handling message:", error);
  }
};
