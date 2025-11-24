import { Router } from "express";
import { getNotificationServices, updateNotificationService } from "@/controllers/notifications.js";
import { validateBody, validateParams } from "@/middlewares/validate.js";
import { notificationServiceSchema, providerParamSchema } from "@/schemas/notificationSchema.js";

const router = Router();

// GET /notifications
router.get("/", getNotificationServices);

// PUT /notifications/:provider
router.put(
  "/:provider",
  validateParams(providerParamSchema),
  validateBody(notificationServiceSchema),
  updateNotificationService
);

export default router;
