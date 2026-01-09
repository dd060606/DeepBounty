import fs from "fs";
import path from "path";
import yaml from "yaml";
import { createRequire } from "module";
import Logger from "@/utils/logger.js";
import { ModuleConfig } from "./moduleConfig.js";
import { closeAllDatabases, ModuleStorage } from "./moduleStorage.js";
import { ModuleFiles } from "./moduleFiles.js";
import { ServerAPI } from "@deepbounty/sdk";
import { getTaskAPI } from "@/tasks/taskAPI.js";
import getRegistry from "@/utils/registry.js";
import { MODULES_DIR } from "@/utils/constants.js";
import { validateModule } from "./validateModule.js";
import { createAlert } from "@/services/alerts.js";
import { getEventBus } from "@/events/eventBus.js";
import { ModuleEventBus } from "@/events/moduleEventBus.js";
import { isHostnameInScope } from "@/utils/domains.js";
import { getTargetsWithDetails } from "@/services/targets.js";
import {
  createCallback,
  getCallback,
  listCallbacks,
  deleteCallback,
  deleteAllCallbacks,
  registerCallbackHandler,
  unregisterCallbackHandler,
} from "@/services/callbacks.js";

const logger = new Logger("Modules-Loader");
const registry = getRegistry();
const moduleEventBuses = new Map<string, ModuleEventBus>();

function readFirstExistingFile(files: string[]): string | null {
  for (const f of files) if (fs.existsSync(f)) return f;
  return null;
}

// Build the SDK object passed to modules
function buildModuleSDK(moduleId: string, moduleName: string): ServerAPI {
  const taskAPI = getTaskAPI(moduleId);
  const storage = new ModuleStorage(moduleId);
  const files = new ModuleFiles(moduleId);

  // Create a secure, isolated event bus for this module
  const moduleBus = new ModuleEventBus(getEventBus(), moduleId);
  moduleEventBuses.set(moduleId, moduleBus);

  return Object.freeze({
    version: "1.0.0",
    logger: new Logger(`Module-${moduleName}`),
    config: new ModuleConfig(moduleId),
    storage: {
      query: storage.query.bind(storage),
      queryOne: storage.queryOne.bind(storage),
      execute: storage.execute.bind(storage),
      createTable: storage.createTable.bind(storage),
      dropTable: storage.dropTable.bind(storage),
    },
    files: files,
    events: moduleBus,
    targets: {
      getTargets: async () => {
        return await getTargetsWithDetails();
      },
    },
    isHostnameInScope: async (hostname) => {
      return await isHostnameInScope(hostname);
    },
    registerTaskTemplate: async (
      uniqueKey,
      name,
      description,
      taskContent,
      interval,
      schedulingType,
      onComplete,
      onSchedule
    ) => {
      return await taskAPI.registerTaskTemplate(
        uniqueKey,
        name,
        description,
        taskContent,
        interval,
        schedulingType,
        onComplete,
        onSchedule
      );
    },
    unregisterTaskTemplate: async (templateId) => {
      return await taskAPI.unregisterTaskTemplate(templateId);
    },
    createTaskInstance: async (templateId, targetId, customData) => {
      return await taskAPI.createTaskInstance(templateId, targetId, customData);
    },
    registerTool(tool) {
      registry.registerTool(tool);
    },
    createAlert: async (
      name: string,
      subdomainOrTargetId: string | number,
      score: number,
      description: string,
      endpoint: string,
      confirmed: boolean = false
    ) => {
      if (typeof subdomainOrTargetId === "number") {
        return await createAlert({
          name,
          targetId: subdomainOrTargetId,
          score,
          description,
          endpoint,
          confirmed,
        });
      }

      return await createAlert({
        name,
        subdomain: subdomainOrTargetId,
        score,
        description,
        endpoint,
        confirmed,
      });
    },
    callbacks: {
      create: async (name, metadata, options) => {
        return await createCallback(moduleId, name, metadata, options);
      },
      onTrigger: (handler) => {
        registerCallbackHandler(moduleId, handler);
      },
      get: async (uuid) => {
        return await getCallback(moduleId, uuid);
      },
      list: async (includeExpired) => {
        return await listCallbacks(moduleId, includeExpired);
      },
      delete: async (uuid) => {
        return await deleteCallback(moduleId, uuid);
      },
      deleteAll: async () => {
        return await deleteAllCallbacks(moduleId);
      },
    },
  } as ServerAPI);
}

// Load modules from disk
async function loadModules(baseDir: string): Promise<void> {
  logger.info(`Loading modules...`);

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

      // Validate module definition
      if (!validateModule(parsed, dir, manifestPath)) {
        continue;
      }

      // Initialize module settings
      await new ModuleConfig(parsed.id).initSettings(parsed.settings);

      // Check entrypoint exists
      const entry = path.join(moduleDir, parsed.entry);
      if (!fs.existsSync(entry)) {
        logger.warn(`Entrypoint not found for module '${parsed.id}': ${entry}`);
        continue;
      }
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
      // Normalize stop() method
      let stop: (() => void) | undefined;
      if (typeof instance?.stop === "function") {
        stop = instance.stop.bind(instance);
      }
      // Register the module in global registry
      registry.registerModule({
        id: parsed.id,
        name: parsed.name,
        description: parsed.description,
        version: parsed.version,
        entry: entry,
        run,
        stop,
      });

      logger.info(`Module loaded: ${parsed.name} (${parsed.id}) v${parsed.version}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to load '${dir}': ${msg}`);
    }
  }

  logger.info(`Total modules loaded: ${registry.moduleCount()}`);
}

export async function initModules(): Promise<void> {
  try {
    // If the modules directory does not exist, create it
    if (!fs.existsSync(MODULES_DIR)) {
      logger.info("Creating modules directory...");
      fs.mkdirSync(MODULES_DIR, { recursive: true });
    }
    // Load modules from disk
    await loadModules(MODULES_DIR);
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

export function shutdownModules(): void {
  try {
    closeAllDatabases();
    registry.getLoadedModules().forEach((m) => {
      // Call stop() method if defined
      if (typeof m.stop === "function") {
        m.stop();
      }

      // Cleanup event listeners for this module
      const moduleBus = moduleEventBuses.get(m.id);
      if (moduleBus) {
        moduleBus.cleanup();
        moduleEventBuses.delete(m.id);
      }

      // Cleanup callback handlers for this module
      unregisterCallbackHandler(m.id);
    });
  } catch (e) {
    logger.error("Error while shutting down modules", e);
  }
}
