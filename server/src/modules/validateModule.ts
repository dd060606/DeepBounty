import fs from "fs";
import path from "path";
import Logger from "@/utils/logger.js";
import { Module, ModuleSetting } from "@deepbounty/sdk/types";

const logger = new Logger("Modules-Loader");

export function validateModule(
  parsedManifest: any,
  moduleDir: string,
  manifestPath: string
): boolean {
  // Validate manifest structure
  if (!validateManifest(parsedManifest)) {
    logger.warn(`Invalid manifest for ${moduleDir}, file: ${path.basename(manifestPath)}`);
    return false;
  }
  // Sanitize module ID
  if (!/^[a-zA-Z0-9_-]+$/.test(parsedManifest.id)) {
    logger.warn(
      `Invalid module ID "${parsedManifest.id}" in module '${moduleDir}'. Only alphanumeric characters, hyphens, and underscores are allowed.`
    );
    return false;
  }
  // Check if the module directory matches the module ID
  if (parsedManifest.id !== moduleDir) {
    logger.warn(
      `Module directory name "${moduleDir}" does not match module ID "${parsedManifest.id}". They must be the same.`
    );
    return false;
  }

  // Validate settings structure if any
  if (parsedManifest.settings && !validateSettings(parsedManifest.settings)) {
    logger.warn(`Invalid settings structure in module '${parsedManifest.id}'`);
    return false;
  }
  return true;
}

// Check required fields in manifest
function validateManifest(m: any): m is Module {
  return (
    m &&
    typeof m.id === "string" &&
    typeof m.name === "string" &&
    typeof m.version === "string" &&
    typeof m.entry === "string"
  );
}

// Check settings structure
function validateSettings(settings: any): settings is ModuleSetting[] {
  if (!Array.isArray(settings)) return false;
  for (const s of settings) {
    if (!validateSingleSetting(s)) return false;
  }
  return true;
}

// Validate a single setting structure
function validateSingleSetting(setting: any): setting is ModuleSetting {
  if (typeof setting !== "object" || setting === null) return false;
  if (typeof setting.name !== "string") return false;
  if (!["checkbox", "text", "select", "info"].includes(setting.type)) return false;
  if (typeof setting.label !== "string") return false;
  if (setting.type === "checkbox" && typeof setting.default !== "boolean") return false;
  if (setting.type === "text" && typeof setting.default !== "string") return false;
  if (
    setting.type === "select" &&
    (!Array.isArray(setting.options) || typeof setting.default !== "string")
  ) {
    return false;
  }
  return true;
}
