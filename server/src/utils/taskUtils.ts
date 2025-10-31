import { Tool } from "@deepbounty/sdk/types";

// Check which tools are missing on a worker for a given task
export function getMissingTools(workerTools: Tool[], taskTools?: Tool[]): Tool[] {
  if (!taskTools || taskTools.length === 0) {
    return [];
  }

  const missingTools: Tool[] = [];
  for (const requiredTool of taskTools) {
    const hasToolInstalled = workerTools.some(
      (wt) => wt.name === requiredTool.name && wt.version === requiredTool.version
    );
    if (!hasToolInstalled) {
      missingTools.push(requiredTool);
    }
  }
  return missingTools;
}
