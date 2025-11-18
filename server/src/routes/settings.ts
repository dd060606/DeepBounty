import {
  getSettings,
  regenerateBurpsuiteKey,
  regenerateWorkerKey,
  resetModulesDatabases,
  updateSettings,
} from "@/controllers/settings.js";
import { validateBody } from "@/middlewares/validate.js";
import { updateSettingsSchema } from "@/schemas/settingSchema.js";
import { Router } from "express";

const router = Router();

// GET /settings
router.get("/", getSettings);

// PATCH /settings
router.patch("/", validateBody(updateSettingsSchema), updateSettings);

// POST /settings/regenerate/worker-key
router.post("/regenerate/worker-key", regenerateWorkerKey);
// POST /settings/regenerate/burpsuite-key
router.post("/regenerate/burpsuite-key", regenerateBurpsuiteKey);

// POST /settings/reset-modules
router.post("/reset-modules", resetModulesDatabases);

export default router;
