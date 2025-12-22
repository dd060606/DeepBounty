import { Request, Response } from "express";
import Logger from "@/utils/logger.js";
import getRegistry from "@/utils/registry.js";
import { query, queryOne } from "@/db/database.js";
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

// POST /modules/:id/settings - update module settings
export const updateModuleSettings = async (req: Request, res: Response) => {
  const moduleId = req.params.id;

  try {
    // Update or insert the module settings in the database
    await query(
      sql`INSERT INTO modules_configs ("moduleId", "key", "value")
       VALUES (${moduleId}, 'settings', ${JSON.stringify(req.body)}::jsonb)
       ON CONFLICT ("moduleId", "key")
       DO UPDATE SET "value" = EXCLUDED."value"`
    );

    res.status(204).send();
  } catch (error) {
    logger.error("Error updating module settings", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
