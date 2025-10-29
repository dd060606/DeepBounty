import { ServerTask, Tool } from "@deepbounty/sdk/types";

// Add commands to install required tools to an existing task
export function installToolsTask(requiredTools: Tool[], existingTask: ServerTask): ServerTask {
  const installCommands: string[] = [];
  requiredTools.forEach((tool) => {
    // Add pre-install commands if any
    if (tool.preInstallCommands) {
      installCommands.push(...tool.preInstallCommands);
    }
    // Download the tool
    installCommands.push(`wget -q -P /tools/ ${tool.downloadUrl}`);
    // Add post-install commands if any
    if (tool.postInstallCommands) {
      installCommands.push(...tool.postInstallCommands);
    }
  });
  existingTask.commands.unshift(...installCommands);
  return existingTask;
}
