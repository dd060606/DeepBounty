import { Router } from "express";
import { ingestBurpTraffic } from "@/controllers/ingest.js";
import { requireAuthOrBurpsuiteKey } from "@/middlewares/auth.js";

const router = Router();

// POST /ingest/burp
router.post("/burp", requireAuthOrBurpsuiteKey, ingestBurpTraffic);

export default router;
