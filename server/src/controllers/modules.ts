import { Request, Response } from "express";
import Logger from "@/utils/logger.js";
import { getLoadedModules } from "@/modules/loader.js";

const logger = new Logger("Modules");

// GET /modules - return list of modules
export const getModules = async (req: Request, res: Response) => {
  try {
    const modules = getLoadedModules().map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      version: m.version,
    }));
    res.json(modules);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};
