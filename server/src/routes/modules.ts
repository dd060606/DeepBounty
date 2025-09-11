import { getModules } from "@/controllers/modules.js";
import { Router } from "express";

const router = Router();

// GET /modules
router.get("/", getModules);

export default router;
