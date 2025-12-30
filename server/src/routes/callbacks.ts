import { Router } from "express";
import { handleCallback } from "@/controllers/callbacks.js";

const router = Router();

// POST /cb/:uuid - Public endpoint to trigger a callback (no authentication required)
router.post("/:uuid", handleCallback);

export default router;
