import { isSetupComplete, setupPassword } from "@/controllers/setup.js";
import { validateBody } from "@/middlewares/validate.js";
import { setupPasswordSchema } from "@/schemas/setupSchemas.js";
import { Router } from "express";

const router = Router();

// POST /setup/password
router.post("/password", validateBody(setupPasswordSchema), setupPassword);

// GET /setup/complete
router.get("/complete", isSetupComplete);

export default router;
