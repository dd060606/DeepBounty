import { TaskExecution } from "@deepbounty/sdk/types";

// Extract result between markers if present
export function extractResult(output: string, extractResult: boolean): string {
  if (!extractResult) {
    // Return full output as-is when extraction is not enabled
    return output;
  }

  const startMarker = "<<<RESULT_START>>>";
  const endMarker = "<<<RESULT_END>>>";

  const startIdx = output.indexOf(startMarker);
  const endIdx = output.indexOf(endMarker);

  if (startIdx === -1 || endIdx === -1 || startIdx >= endIdx) {
    // Markers not found or invalid - return full output
    return output;
  }

  // Extract ONLY the content between markers (excluding the markers themselves)
  const extracted = output.substring(startIdx + startMarker.length, endIdx).trim();
  return extracted;
}

// Replace task:{tempfile-name} placeholders with actual temp file paths
export function replaceTempFilePlaceholders(taskId: number, commands: string[]): string[] {
  return commands.map((cmd) =>
    cmd.replace(/task:{tempfile-([^}]+)}/g, (_, name) => `/tmp/task-${taskId}-${name}`)
  );
}

export function createTaskResult(
  taskExecution: TaskExecution,
  success: boolean,
  output?: string,
  error?: string
) {
  return {
    executionId: taskExecution.executionId,
    scheduledTaskId: taskExecution.scheduledTaskId,
    targetId: taskExecution.targetId,
    success,
    output,
    error,
  };
}
