import {
  getTargets,
  addTarget,
  editTarget,
  deleteTarget,
  getTargetSubdomains,
  setTargetSubdomains,
  getTargetSettings,
  setTargetSettings,
  getTargetsFull,
} from "@/controllers/targets.js";
import { validateBody, validateParams } from "@/middlewares/validate.js";
import { idParamSchema, targetIdParamSchema } from "@/schemas/commonSchema.js";
import { addSubdomainsSchema, addTargetSchema } from "@/schemas/targetSchema.js";
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

// GET /targets/subdomains/:targetId
router.get("/subdomains/:targetId", validateParams(targetIdParamSchema), getTargetSubdomains);

// POST /targets/subdomains/:targetId
router.post(
  "/subdomains/:targetId",
  validateParams(targetIdParamSchema),
  validateBody(addSubdomainsSchema),
  setTargetSubdomains
);

// GET /targets/settings/:targetId
router.get("/settings/:targetId", validateParams(targetIdParamSchema), getTargetSettings);

// POST /targets/settings/:targetId
router.post("/settings/:targetId", validateParams(targetIdParamSchema), setTargetSettings);

export default router;
