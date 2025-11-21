import { disconnectWorker, getWorkers } from "@/controllers/workers.js";
import { validateParams } from "@/middlewares/validate.js";
import { idParamSchema } from "@/schemas/commonSchema.js";
import { Router } from "express";

const router = Router();
// GET /workers
router.get("/", getWorkers);

// POST /workers/:id/disconnect
router.post("/:id/disconnect", validateParams(idParamSchema), disconnectWorker);

export default router;
