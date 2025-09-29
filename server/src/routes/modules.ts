import { getModules, updateModuleSettings } from "@/controllers/modules.js";
import { validateBody, validateParams } from "@/middlewares/validate.js";
import { moduleSettingsSchema, moduleIdSchema } from "@/schemas/moduleSchema.js";
import { Router } from "express";

const router = Router();

// GET /modules
router.get("/", getModules);

// POST /modules/:id/settings
router.post(
  "/:id/settings",
  validateParams(moduleIdSchema),
  validateBody(moduleSettingsSchema),
  updateModuleSettings
);

export default router;
