import Logger from "@/utils/logger.js";
import { Tool } from "@deepbounty/sdk/types";

const logger = new Logger("ModuleTools");

// Global registry of tools from all modules: toolName -> Tool
const toolRegistry: Map<string, Tool> = new Map();

export function registerTool(tool: Tool): void {
  if (toolRegistry.has(tool.name)) {
    logger.warn(`Tool '${tool.name}' is already registered. Overwriting.`);
  }
  toolRegistry.set(tool.name, tool);
  logger.info(`Registered tool: ${tool.name} v${tool.version}`);
}

// Check tools structure
export function validateTools(tools: any): tools is Tool[] {
  if (!Array.isArray(tools)) return false;
  for (const t of tools) {
    if (!validateSingleTool(t)) return false;
  }
  return true;
}

// Validate a single tool structure
function validateSingleTool(tool: any): tool is Tool {
  if (typeof tool !== "object" || tool === null) return false;

  // Required fields
  if (typeof tool.name !== "string") return false;
  if (typeof tool.version !== "string") return false;
  if (typeof tool.downloadUrl !== "string") return false;

  // Optional description must be a string if present
  if ("description" in tool && typeof tool.description !== "string") return false;

  // Optional preInstallCommands and postInstallCommands must be arrays of strings if present
  if ("preInstallCommands" in tool) {
    if (!Array.isArray(tool.preInstallCommands)) return false;
    for (const cmd of tool.preInstallCommands) {
      if (typeof cmd !== "string") return false;
    }
  }
  if ("postInstallCommands" in tool) {
    if (!Array.isArray(tool.postInstallCommands)) return false;
    for (const cmd of tool.postInstallCommands) {
      if (typeof cmd !== "string") return false;
    }
  }

  return true;
}

// Get a registered tool by name
export function getToolByName(toolName: string): Tool | undefined {
  return toolRegistry.get(toolName);
}

// Get all registered tools
export function getAllTools(): Tool[] {
  return Array.from(toolRegistry.values());
}

/**
 * Resolve tool names to full Tool objects
 * @param requiredTools Array of tool names or Tool objects
 * @returns Array of resolved Tool objects
 */
export function resolveTools(requiredTools?: (Tool | string)[]): Tool[] | undefined {
  if (!requiredTools || requiredTools.length === 0) {
    return undefined;
  }

  const resolved: Tool[] = [];
  const missingTools: string[] = [];

  for (const toolRef of requiredTools) {
    // If it's already a full Tool object, use it as is
    if (typeof toolRef === "object" && toolRef !== null) {
      resolved.push(toolRef as Tool);
      continue;
    }

    // If it's a string, resolve it from the tool registry
    if (typeof toolRef === "string") {
      const tool = getToolByName(toolRef);
      if (tool) {
        resolved.push(tool);
        logger.info(`Resolved tool '${toolRef}' to ${tool.name} v${tool.version}`);
      } else {
        missingTools.push(toolRef);
      }
    }
  }

  // Warn about missing tools but don't fail
  if (missingTools.length > 0) {
    logger.warn(
      `Could not resolve the following tools: ${missingTools.join(", ")}. ` +
        `Make sure they are defined in a module's tools section.`
    );
  }

  return resolved.length > 0 ? resolved : undefined;
}
