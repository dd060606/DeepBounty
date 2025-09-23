import { Request, Response } from "express";
import Logger from "@/utils/logger.js";
import { getLoadedModules } from "@/modules/loader.js";
import { query } from "@/utils/db.js";

const logger = new Logger("Modules");

// GET /modules - return list of modules
export const getModules = async (req: Request, res: Response) => {
  try {
    // Get settings for all modules
    const settings = await query(
      'SELECT "moduleId", "value" FROM modules_configs WHERE "key" = \'settings\''
    );
    // Modules with their info and settings
    const modules = getLoadedModules().map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      version: m.version,
      settings: settings.find((s) => s.moduleId === m.id)?.value || [],
    }));
    res.json(modules);
  } catch (error) {
    logger.error("Error fetching modules", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
