import { Request, Response } from "express";
import Logger from "@/utils/logger.js";
import getRegistry from "@/utils/registry.js";
import { query } from "@/utils/db.js";
import { sql } from "drizzle-orm";

const logger = new Logger("Modules");

// GET /modules - return list of modules
export const getModules = async (req: Request, res: Response) => {
  try {
    // Get settings for all modules
    const settings = await query<{ moduleId: string; value: string }>(
      sql`SELECT "moduleId", "value" FROM modules_configs WHERE "key" = 'settings'`
    );
    // Modules with their info and settings
    const modules = getRegistry()
      .getLoadedModules()
      .map((m) => ({
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

export const updateModuleSettings = async (req: Request, res: Response) => {
  const moduleId = req.params.id;

  try {
    // Update the module settings in the database
    const result = await query(
      sql`UPDATE modules_configs SET "value" = ${JSON.stringify(req.body)} WHERE "moduleId" = ${moduleId} AND "key" = 'settings' RETURNING "moduleId"`
    );
    if (result.length === 0) {
      return res.status(404).json({ error: "Target not found" });
    }
    logger.info(`Updated settings for module ID '${moduleId}'`);
    res.status(204).send();
  } catch (error) {
    logger.error("Error updating module settings", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
