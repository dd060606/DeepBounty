import { exec } from "child_process";
import { promisify } from "util";
import type { Task, TaskResult } from "@deepbounty/sdk/types";

const execAsync = promisify(exec);

/**
 * Execute a single task
 * @param task The task to execute
 * @returns The task result
 */
export const executeTask = async (task: Task): Promise<TaskResult> => {
  console.log(`Executing task ${task.id}...`);

  try {
    const results: string[] = [];

    // Execute each command sequentially
    for (const command of task.commands) {
      console.log(`Running command: ${command}`);

      try {
        const { stdout, stderr } = await execAsync(command, {
          // Execute commands in the tools directory
          cwd: "/tools",
        });

        if (stderr) {
          console.warn(`Command stderr: ${stderr}`);
        }

        results.push(stdout);
      } catch (error: any) {
        console.error(`Command failed: ${command}`, error);

        return {
          taskId: task.id,
          success: false,
          error: error.message || error,
          output: results.length > 0 ? results : undefined,
        };
      }
    }

    console.log(`Task ${task.id} completed successfully`);

    return {
      taskId: task.id,
      success: true,
      output: results,
    };
  } catch (error: any) {
    console.error(`Task ${task.id} execution error:`, error);

    return {
      taskId: task.id,
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
        const task: Task = data;

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
