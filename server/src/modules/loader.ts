import fs from "fs";
import path from "path";
import yaml from "yaml";
import { createRequire } from "module";
import Logger from "@/utils/logger.js";
import { ModuleConfig, validateSettings } from "./moduleConfig.js";
import { Module, TaskContent, TaskResult } from "@deepbounty/sdk/types";
import { ServerAPI } from "@deepbounty/sdk";
import { getTaskAPI } from "@/tasks/taskAPI.js";
import getRegistry from "@/utils/registry.js";

const logger = new Logger("Modules-Loader");
const registry = getRegistry();

function readFirstExistingFile(files: string[]): string | null {
  for (const f of files) if (fs.existsSync(f)) return f;
  return null;
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

// Build the SDK object passed to modules
function buildModuleSDK(moduleId: string, moduleName: string): ServerAPI {
  const taskAPI = getTaskAPI(moduleId);

  return Object.freeze({
    version: "1.0.0",
    logger: new Logger(`Module-${moduleName}`),
    config: new ModuleConfig(moduleId),
    registerTaskTemplate: async (name, description, taskContent, interval, onComplete) => {
      return await taskAPI.registerTaskTemplate(
        name,
        description,
        taskContent,
        interval,
        onComplete
      );
    },

    unregisterTaskTemplate: async (templateId) => {
      return await taskAPI.unregisterTaskTemplate(templateId);
    },
    registerTool(tool) {
      registry.registerTool(tool);
    },
  } as ServerAPI);
}

// Load modules from disk
async function loadModules(baseDir: string): Promise<void> {
  logger.info(`Loading modules...`);

  if (!fs.existsSync(baseDir)) {
    logger.warn(`Module directory not found: ${baseDir}`);
    return;
  }
  // For each subdirectory, look for a manifest file
  for (const dir of fs.readdirSync(baseDir)) {
    try {
      const moduleDir = path.join(baseDir, dir);
      const manifestPath = readFirstExistingFile([
        path.join(moduleDir, "module.yaml"),
        path.join(moduleDir, "module.yml"),
      ]);

      // If no manifest, it's not a module -> skip
      if (!manifestPath) continue;

      const manifestRaw = fs.readFileSync(manifestPath, "utf8");
      const parsed = yaml.parse(manifestRaw) as any;
      // Validate manifest structure
      if (!validateManifest(parsed)) {
        logger.warn(`Invalid manifest for ${dir}, file: ${path.basename(manifestPath)}`);
        continue;
      }
      // Check entrypoint exists
      const entry = path.join(moduleDir, parsed.entry);
      if (!fs.existsSync(entry)) {
        logger.warn(`Entrypoint not found for module '${parsed.id}': ${entry}`);
        continue;
      }

      // Validate settings structure if any
      if (parsed.settings && !validateSettings(parsed.settings)) {
        logger.warn(`Invalid settings structure in module '${parsed.id}'`);
        continue;
      }

      // Initialize module settings
      await new ModuleConfig(parsed.id).initSettings(parsed.settings);

      // Load the module
      const require = createRequire(import.meta.url);
      const mod = require(entry);
      const exported = mod?.default ?? mod;

      const api = buildModuleSDK(parsed.id, parsed.name);
      let instance = new exported(api);

      // Normalize run() method
      let run: () => Promise<any>;
      if (typeof instance?.run === "function") {
        run = instance.run.bind(instance);
      } else {
        logger.warn(`The module '${parsed.id}' does not expose a run() method.`);
        continue;
      }

      // Register the module in global registry
      registry.registerModule({
        id: parsed.id,
        name: parsed.name,
        description: parsed.description,
        version: parsed.version,
        entry: entry,
        run,
      });

      logger.info(`Module loaded: ${parsed.name} (${parsed.id}) v${parsed.version}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to load '${dir}': ${msg}`);
    }
  }

  logger.info(`Total modules loaded: ${registry.moduleCount()}`);
}

export async function initModules(baseDir: string): Promise<void> {
  try {
    // Load modules from disk
    await loadModules(baseDir);

    // Initialize each module
    for (const m of registry.getLoadedModules()) {
      m.run().catch((e: any) => {
        logger.error(`Error running module (${m.id})`, e);
      });
    }
  } catch (e) {
    logger.error("Error while loading modules", e);
  }
}
