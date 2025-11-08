import {
  getAllTemplates,
  getTemplatesByModuleId,
  getTargetOverrides,
  removeOverrides,
  setOverrides,
  toggleTemplateActivation,
} from "@/controllers/tasks.js";
import { validateBody, validateParams } from "@/middlewares/validate.js";
import { idParamSchema, targetIdParamSchema } from "@/schemas/commonSchema.js";
import {
  templateIdsSchema,
  taskTemplateSchema,
  taskOverridesSchema,
  taskModuleIdSchema,
} from "@/schemas/taskSchema.js";
import { Router } from "express";

const router = Router();

// GET /tasks/templates
router.get("/templates", getAllTemplates);
// GET /tasks/templates/:moduleId
router.get("/templates/:moduleId", validateParams(taskModuleIdSchema), getTemplatesByModuleId);
// PATCH /tasks/templates/:id
router.patch(
  "/templates/:id",
  validateParams(idParamSchema),
  validateBody(taskTemplateSchema),
  toggleTemplateActivation
);
// GET /tasks/targets/:targetId/task-overrides
router.get(
  "/targets/:targetId/task-overrides",
  validateParams(targetIdParamSchema),
  getTargetOverrides
);
// PUT /tasks/targets/:targetId/task-overrides
router.put(
  "/targets/:targetId/task-overrides",
  validateParams(targetIdParamSchema),
  validateBody(taskOverridesSchema),
  setOverrides
);
// DELETE /tasks/targets/:targetId/task-overrides
router.delete(
  "/targets/:targetId/task-overrides",
  validateParams(targetIdParamSchema),
  validateBody(templateIdsSchema),
  removeOverrides
);

export default router;
