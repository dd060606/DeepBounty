import { Task, Tool } from "@deepbounty/sdk/types";

// Add commands to install required tools to an existing task
export function installToolsTask(requiredTools: Tool[], existingTask: Task): Task {
  const installCommands: string[] = [];
  requiredTools.forEach((tool) => {
    // Add pre-install commands if any
    if (tool.preInstallCommands) {
      installCommands.push(...tool.preInstallCommands);
    }
    // Download the tool
    installCommands.push(`wget -P /tools/${tool.name}_${tool.version}/ ${tool.downloadUrl}`);
    // Add post-install commands if any
    if (tool.postInstallCommands) {
      installCommands.push(...tool.postInstallCommands);
    }
  });
  existingTask.commands.unshift(...installCommands);
  return existingTask;
}
