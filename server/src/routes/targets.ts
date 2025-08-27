import { getTargets, addTarget, editTarget, deleteTarget } from "@/controllers/targets.js";
import { validateBody, validateParams } from "@/middlewares/validate.js";
import { idParamSchema } from "@/schemas/commonSchema.js";
import { addTargetSchema } from "@/schemas/targetSchema.js";
import { Router } from "express";

const router = Router();

// GET /targets
router.get("/", getTargets);

// POST /targets
router.post("/", validateBody(addTargetSchema), addTarget);

// PATCH /targets/:id
router.patch("/:id", validateParams(idParamSchema), validateBody(addTargetSchema), editTarget);

// DELETE /targets/:id
router.delete("/:id", validateParams(idParamSchema), deleteTarget);

export default router;
