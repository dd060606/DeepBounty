import {
  getAllTemplates,
  getTargetOverrides,
  removeOverrides,
  setOverrides,
  toggleTemplateActivation,
} from "@/controllers/tasks.js";
import { validateBody, validateParams } from "@/middlewares/validate.js";
import { idParamSchema, targetIdParamSchema } from "@/schemas/commonSchema.js";
import { templateIdsSchema, taskTemplateSchema } from "@/schemas/taskSchema.js";
import { Router } from "express";

const router = Router();

// GET /api/tasks/templates
router.get("/templates", getAllTemplates);
// PATCH /api/tasks/templates/:id
router.patch(
  "/templates/:id",
  validateParams(idParamSchema),
  validateBody(taskTemplateSchema),
  toggleTemplateActivation
);
// GET /api/targets/:targetId/task-overrides
router.get(
  "/targets/:targetId/task-overrides",
  validateParams(targetIdParamSchema),
  getTargetOverrides
);
// PUT /api/targets/:targetId/task-overrides
router.put(
  "/targets/:targetId/task-overrides",
  validateParams(targetIdParamSchema),
  validateBody(templateIdsSchema),
  validateBody(taskTemplateSchema),
  setOverrides
);
// DELETE /api/targets/:targetId/task-overrides
router.delete(
  "/targets/:targetId/task-overrides",
  validateParams(targetIdParamSchema),
  validateBody(templateIdsSchema),
  removeOverrides
);

export default router;
