import { Request, Response } from "express";
import Logger from "@/utils/logger.js";
import config, { generateRandomKey } from "@/utils/config.js";
import { clearAllDatabases } from "@/modules/moduleStorage.js";
import { gracefulShutdown } from "@/server.js";

const logger = new Logger("Settings");

// GET /settings - return app configuration
export const getSettings = async (req: Request, res: Response) => {
  const { burpsuiteKey, enableSwaggerUi, workerKey } = config.get();
  res.json({
    burpsuiteKey,
    enableSwaggerUi,
    workerKey,
  });
};

// PATCH /settings - update settings
export const updateSettings = async (req: Request, res: Response) => {
  const { swaggerUi } = req.body;
  if (swaggerUi !== undefined) {
    config.set({ enableSwaggerUi: swaggerUi });
  }
  res.sendStatus(200);
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

// POST /settings/reset-modules - reset all module databases
export const resetModulesDatabases = async (req: Request, res: Response) => {
  clearAllDatabases();
  logger.info("All module databases have been reset");
  res.sendStatus(200);
  gracefulShutdown("RESTART");
};
