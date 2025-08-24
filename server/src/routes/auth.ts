import { Router } from "express";
import { validateBody } from "@/middlewares/validate.js";
import { requireAuth } from "@/middlewares/auth.js";
import { setupPasswordSchema } from "@/schemas/setupSchemas.js";
import { login, logout, authInfo } from "@/controllers/auth.js";

const router = Router();

// POST /auth/login
router.post("/login", validateBody(setupPasswordSchema), login);

// POST /auth/logout
router.post("/logout", logout);

// GET /auth/info
router.get("/info", authInfo);

export default router;
