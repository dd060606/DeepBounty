import { getTaskAnalytics, getEventAnalytics } from "@/controllers/analytics.js";
import { validateQuery } from "@/middlewares/validate.js";
import { analyticsRangeSchema } from "@/schemas/analyticsSchema.js";
import { Router } from "express";

const router = Router();

// GET /metrics/tasks - Per-template task execution timing statistics
router.get("/tasks", validateQuery(analyticsRangeSchema), getTaskAnalytics);
// GET /metrics/evts - Event throughput and handler timing statistics
router.get("/events", validateQuery(analyticsRangeSchema), getEventAnalytics);

export default router;
