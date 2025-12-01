import { Router } from "express";
import { getScope, getScopeVersion } from "@/controllers/scope.js";
import { requireAuthOrBurpsuiteKey } from "@/middlewares/auth.js";

const router = Router();

// GET /scope/version
router.get("/version", requireAuthOrBurpsuiteKey, getScopeVersion);

// GET /scope
router.get("/", requireAuthOrBurpsuiteKey, getScope);

export default router;
