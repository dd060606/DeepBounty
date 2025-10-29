import { Tool } from "@deepbounty/sdk/types";

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
