import { Request, Response } from "express";
import Logger from "@/utils/logger.js";
import config, { generateRandomKey } from "@/utils/config.js";
import { clearAllModuleDatabases, closeAllDatabases } from "@/modules/moduleStorage.js";
import { gracefulShutdown } from "@/server.js";
import { getTaskTemplateService } from "@/tasks/taskTemplateService.js";
import { clearAllModuleFiles } from "@/modules/moduleFiles.js";
import { query } from "@/db/database.js";
import { sql } from "drizzle-orm";

const logger = new Logger("Settings");

// GET /settings - return app configuration
export const getSettings = async (req: Request, res: Response) => {
  const { burpsuiteKey, enableSwaggerUi, workerKey, externalUrl } = config.get();
  res.json({
    burpsuiteKey,
    enableSwaggerUi,
    workerKey,
    externalUrl,
  });
};

// PATCH /settings - update settings
export const updateSettings = async (req: Request, res: Response) => {
  const { swaggerUi, restart, externalUrl } = req.body;
  if (swaggerUi !== undefined) {
    config.set({ enableSwaggerUi: swaggerUi });
  }
  if (externalUrl !== undefined) {
    // Strip trailing slash if present
    const formattedUrl = externalUrl.endsWith("/") ? externalUrl.slice(0, -1) : externalUrl;
    config.set({ externalUrl: formattedUrl });
  }
  res.sendStatus(200);
  if (restart) {
    logger.info("Settings updated, restarting server...");
    gracefulShutdown("RESTART");
  }
};

// POST /settings/regenerate/worker-key - regenerate worker key
export const regenerateWorkerKey = async (req: Request, res: Response) => {
  const newKey = generateRandomKey();
  config.set({
    workerKey: newKey,
  });
  logger.info("Worker key regenerated");
  res.json({ workerKey: newKey });
};

// POST /settings/regenerate/burpsuite-key - regenerate burpsuite key
export const regenerateBurpsuiteKey = async (req: Request, res: Response) => {
  const newKey = generateRandomKey();
  config.set({
    burpsuiteKey: newKey,
  });
  logger.info("Burp Suite key regenerated");
  res.json({ burpsuiteKey: newKey });
};

// POST /settings/reset-modules - reset all module data
export const resetModulesData = async (req: Request, res: Response) => {
  try {
    closeAllDatabases();
    await clearAllModuleDatabases();
    clearAllModuleFiles();
    // Clear all registered callback handlers
    await query(sql`DELETE FROM module_callbacks`);
    logger.info("All modules have been reset. Restarting server...");
    res.sendStatus(200);
  } catch (error) {
    logger.error("Error during modules reset:", error);
    res.status(500).json({ error: "Failed to reset modules" });
  } finally {
    gracefulShutdown("RESTART");
  }
};

// POST /settings/cleanup-tasks - cleanup registered tasks
export const cleanupTasks = async (req: Request, res: Response) => {
  try {
    await getTaskTemplateService().clearAllTemplatesAndOverrides();
    logger.info("All task templates and overrides have been cleared. Restarting server...");
    res.sendStatus(200);
    gracefulShutdown("RESTART");
  } catch (error) {
    logger.error("Error during tasks cleanup:", error);
    res.status(500).json({ error: "Failed to cleanup tasks" });
  }
};

// POST /settings/restart-server - restart the server
export const restartServer = async (req: Request, res: Response) => {
  logger.info("Server restart requested via API");
  res.sendStatus(200);
  gracefulShutdown("RESTART");
};
