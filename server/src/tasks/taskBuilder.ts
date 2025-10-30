import { TaskContent, Tool } from "@deepbounty/sdk/types";

// Get the tool directory path
function getToolDir(tool: Tool): string {
  return `/tools/${tool.name}-${tool.version}`;
}

// Get the tool binary path
function getToolBinaryPath(tool: Tool): string {
  return `${getToolDir(tool)}/${tool.name}`;
}

// Replace tool:{name} placeholders with actual tool binary paths
// E.g., tool:{subfinder} -> /tools/subfinder-2.9.0/subfinder
export function replaceToolPlaceholders(commands: string[], tools: Tool[]): string[] {
  return commands.map((cmd) => {
    let replaced = cmd;

    // Replace each tool placeholder
    tools.forEach((tool) => {
      const placeholder = `tool:{${tool.name}}`;
      if (replaced.includes(placeholder)) {
        replaced = replaced.replace(new RegExp(placeholder, "g"), getToolBinaryPath(tool));
      }
    });

    return replaced;
  });
}

// Return commands to install required tools
export function installToolsTask(requiredTools: Tool[], taskContent: TaskContent): string[] {
  const installCommands: string[] = [];

  requiredTools.forEach((tool) => {
    const toolDir = getToolDir(tool);

    // Create tool directory
    installCommands.push(`mkdir -p ${toolDir}`);

    // Change to tool directory for all installation commands
    installCommands.push(`cd ${toolDir}`);

    // Add pre-install commands if any (executed in tool directory)
    if (tool.preInstallCommands) {
      installCommands.push(...tool.preInstallCommands);
    }

    // Download the tool to the tool directory
    installCommands.push(`wget -q ${tool.downloadUrl}`);

    // Add post-install commands if any (executed in tool directory)
    if (tool.postInstallCommands) {
      installCommands.push(...tool.postInstallCommands);
    }

    // Make binary executable
    installCommands.push(`chmod +x ${tool.name}`);
  });

  return [...installCommands, ...taskContent.commands];
}
