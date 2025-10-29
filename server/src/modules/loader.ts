import fs from "fs";
import path from "path";
import yaml from "yaml";
import { createRequire } from "module";
import Logger from "@/utils/logger.js";
import { ModuleConfig, validateSettings } from "./moduleConfig.js";
import { LoadedModule, Module } from "@deepbounty/sdk/types";
import { validateTools } from "./moduleTools.js";

const logger = new Logger("Modules-Loader");

let loadedModules: LoadedModule[] = [];

export function getLoadedModules(): LoadedModule[] {
  return loadedModules;
}

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
function buildModuleSDK(moduleId: string, moduleName: string) {
  return Object.freeze({
    version: "1.0.0",
    logger: new Logger(`Module-${moduleName}`),
    config: new ModuleConfig(moduleId),
  });
}

export async function loadModules(baseDir: string): Promise<LoadedModule[]> {
  const modules: LoadedModule[] = [];

  logger.info(`Loading modules...`);

  if (!fs.existsSync(baseDir)) {
    logger.warn(`Module directory not found: ${baseDir}`);
    return modules;
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
      // Validate tools structure if any
      if (parsed.tools && !validateTools(parsed.tools)) {
        logger.warn(`Invalid tools structure in module '${parsed.id}'`);
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

      // Add to loaded modules list
      modules.push({
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

  logger.info(`Total modules loaded: ${modules.length}`);

  return modules;
}

export async function initModules(baseDir: string): Promise<void> {
  try {
    // Load modules from disk
    loadedModules = await loadModules(baseDir);
  } catch (e) {
    logger.error("Error while loading modules", e);
  }
  for (const m of loadedModules) {
    // Initialize the module
    m.run().catch((e) => {
      logger.error(`Error running module (${m.id})`, e);
    });
  }
}
