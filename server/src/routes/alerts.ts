import { Router } from "express";
import { getAlerts, addAlert, deleteAlert } from "@/controllers/alerts.js";
import { validateBody, validateParams } from "@/middlewares/validate.js";
import { idParamSchema } from "@/schemas/commonSchema.js";
import { addAlertSchema } from "@/schemas/alertSchema.js";

const router = Router();

// GET /alerts
router.get("/", getAlerts);

// POST /alerts
router.post("/", validateBody(addAlertSchema), addAlert);

// DELETE /alerts/:id
router.delete("/:id", validateParams(idParamSchema), deleteAlert);

export default router;
