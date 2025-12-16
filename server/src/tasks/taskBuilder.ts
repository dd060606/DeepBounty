import { queryOne } from "@/db/database.js";
import { Target, TaskContent, Tool } from "@deepbounty/sdk/types";
import { sql } from "drizzle-orm";

// Get the tool directory path
function getToolDir(tool: Tool): string {
  return `/tools/${tool.name}@${tool.version}`;
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

// Replace target placeholders with actual target data
export async function replaceTargetPlaceholders(
  commands: string[],
  targetId: number | undefined
): Promise<string[]> {
  // For GLOBAL or CUSTOM tasks without target, return commands as-is
  if (!targetId) return Promise.resolve(commands);

  // Fetch target from database
  const target = await queryOne<Target>(sql`SELECT * FROM targets WHERE id = ${targetId}`);
  if (!target) return Promise.resolve(commands);

  // Fetch target settings
  const targetSettings = await queryOne<{ settings: Record<string, any> } | undefined>(
    sql`SELECT settings FROM targets_settings WHERE "targetId" = ${targetId}`
  );

  const settings = targetSettings?.settings || {};
  const userAgent = settings.userAgent || "";
  const customHeader = settings.customHeader || "";

  return commands.map((cmd) =>
    cmd
      .replace(/\{\{TARGET_DOMAIN\}\}/g, target.domain)
      .replace(/\{\{TARGET_ID\}\}/g, String(target.id))
      .replace(/\{\{TARGET_NAME\}\}/g, target.name)
      .replace(/\{\{USER_AGENT\}\}/g, userAgent)
      .replace(/\{\{CUSTOM_HEADER\}\}/g, customHeader)
  );
}

// Replace custom data placeholders with actual custom data
// Also replaces USER_AGENT and CUSTOM_HEADER if targetId is provided
export async function replaceCustomDataPlaceholders(
  commands: string[],
  customData: Record<string, any> | undefined,
  targetId?: number
): Promise<string[]> {
  if (!customData && !targetId) return commands;

  // Fetch target settings if targetId is provided
  let userAgent = "";
  let customHeader = "";
  if (targetId) {
    const targetSettings = await queryOne<{ settings: Record<string, any> } | undefined>(
      sql`SELECT settings FROM targets_settings WHERE "targetId" = ${targetId}`
    );
    const settings = targetSettings?.settings || {};
    userAgent = settings.userAgent || "";
    customHeader = settings.customHeader || "";
  }

  return commands.map((cmd) => {
    let replaced = cmd;

    // Replace custom data placeholders
    if (customData) {
      Object.keys(customData).forEach((key) => {
        const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, "g");
        const value = customData[key];

        // Handle different value types
        if (Array.isArray(value)) {
          // Join arrays with spaces for shell commands
          replaced = replaced.replace(placeholder, value.join(" "));
        } else if (typeof value === "object") {
          // Stringify objects
          replaced = replaced.replace(placeholder, JSON.stringify(value));
        } else {
          // Convert to string for primitives
          replaced = replaced.replace(placeholder, String(value));
        }
      });
    }

    // Replace target-specific placeholders if targetId was provided
    if (targetId) {
      replaced = replaced
        .replace(/\{\{USER_AGENT\}\}/g, userAgent)
        .replace(/\{\{CUSTOM_HEADER\}\}/g, customHeader);
    }

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
