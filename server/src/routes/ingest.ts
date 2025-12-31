import { Router } from "express";
import { ingestTraffic } from "@/controllers/ingest.js";
import { requireAuthOrBurpsuiteKey } from "@/middlewares/auth.js";

const router = Router();

// POST /ingest
router.post("/", requireAuthOrBurpsuiteKey, ingestTraffic);

export default router;
