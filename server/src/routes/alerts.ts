import { Router } from "express";
import { getAlerts, addAlert, deleteAlert } from "@/controllers/alerts.js";
import { validateBody, validateParams, validateQuery } from "@/middlewares/validate.js";
import { idParamSchema } from "@/schemas/commonSchema.js";
import { addAlertSchema, getAlertsQuerySchema } from "@/schemas/alertSchema.js";

const router = Router();

// GET /alerts
router.get("/", validateQuery(getAlertsQuerySchema), getAlerts);

// POST /alerts
router.post("/", validateBody(addAlertSchema), addAlert);

// DELETE /alerts/:id
router.delete("/:id", validateParams(idParamSchema), deleteAlert);

export default router;
