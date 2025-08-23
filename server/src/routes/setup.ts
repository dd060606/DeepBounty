import { isSetupComplete, setupPassword } from "@/controllers/setup.js";
import { validateBody } from "@/middlewares/validate.js";
import { setupPasswordSchema } from "@/schemas/setupSchemas.js";
import { Router } from "express";

const router = Router();

router.post("/password", validateBody(setupPasswordSchema), setupPassword);

router.get("/complete", isSetupComplete);

export default router;
