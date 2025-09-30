import { Router } from "express";
import { validateBody } from "@/middlewares/validate.js";
import { setupPasswordSchema } from "@/schemas/setupSchemas.js";
import { login, logout, authInfo } from "@/controllers/auth.js";
import { rateLimit } from "express-rate-limit";

const rateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  limit: 15, // Limit each IP to 15 requests per 5 minutes
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  ipv6Subnet: 56,
});

const router = Router();

// POST /auth/login
router.post("/login", rateLimiter, validateBody(setupPasswordSchema), login);

// POST /auth/logout
router.post("/logout", logout);

// GET /auth/info
router.get("/info", authInfo);

export default router;
