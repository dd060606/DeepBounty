import {
  getTargets,
  addTarget,
  editTarget,
  deleteTarget,
  getTargetSubdomains,
  setTargetSubdomains,
  getTargetPackages,
  setTargetPackages,
  getTargetSettings,
  setTargetSettings,
  getTargetsFull,
} from "@/controllers/targets.js";
import { validateBody, validateParams } from "@/middlewares/validate.js";
import { idParamSchema } from "@/schemas/commonSchema.js";
import { addSubdomainsSchema, addTargetSchema, addPackagesSchema } from "@/schemas/targetSchema.js";
import { Router } from "express";

const router = Router();

// GET /targets
router.get("/", getTargets);

// GET /targets/full
router.get("/full", getTargetsFull);

// POST /targets
router.post("/", validateBody(addTargetSchema), addTarget);

// PATCH /targets/:id
router.patch("/:id", validateParams(idParamSchema), validateBody(addTargetSchema), editTarget);

// DELETE /targets/:id
router.delete("/:id", validateParams(idParamSchema), deleteTarget);

// GET /targets/:id/subdomains
router.get("/:id/subdomains", validateParams(idParamSchema), getTargetSubdomains);

// POST /targets/:id/subdomains
router.post(
  "/:id/subdomains",
  validateParams(idParamSchema),
  validateBody(addSubdomainsSchema),
  setTargetSubdomains
);

// GET /targets/:id/packages
router.get("/:id/packages", validateParams(idParamSchema), getTargetPackages);

// POST /targets/:id/packages
router.post(
  "/:id/packages",
  validateParams(idParamSchema),
  validateBody(addPackagesSchema),
  setTargetPackages
);

// GET /targets/:id/settings
router.get("/:id/settings", validateParams(idParamSchema), getTargetSettings);

// POST /targets/:id/settings
router.post("/:id/settings", validateParams(idParamSchema), setTargetSettings);

export default router;
