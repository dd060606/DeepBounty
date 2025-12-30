import { Request, Response } from "express";
import Logger from "@/utils/logger.js";
import { triggerCallback } from "@/services/callbacks.js";
import { CallbackTriggerData } from "@deepbounty/sdk/types";

const logger = new Logger("Callbacks");

/**
 * POST /cb/:uuid - Public endpoint to trigger a callback
 * This endpoint is called by external systems
 */
export const handleCallback = async (req: Request, res: Response) => {
  const { uuid } = req.params;

  if (!uuid) {
    return res.status(400).json({ error: "Missing callback UUID" });
  }

  // Extract trigger data from the request
  const triggerData: CallbackTriggerData = {
    body: req.body ?? {},
    headers: extractHeaders(req),
    remoteIp: getRemoteIp(req),
    userAgent: req.headers["user-agent"] ?? "unknown",
    triggeredAt: new Date().toISOString(),
  };

  logger.info(`Callback triggered: ${uuid} from ${triggerData.remoteIp}`);

  const result = await triggerCallback(uuid, triggerData);

  if (!result.success) {
    logger.warn(`Callback trigger failed: ${uuid} - ${result.error}`);
  }

  // Always return 200 OK with minimal response
  res.sendStatus(200);
};

/**
 * Extract relevant headers (excluding sensitive ones)
 */
function extractHeaders(req: Request): Record<string, string> {
  const headers: Record<string, string> = {};
  const includeHeaders = [
    "host",
    "user-agent",
    "content-type",
    "accept",
    "accept-language",
    "accept-encoding",
    "x-forwarded-for",
    "x-real-ip",
    "x-forwarded-host",
    "x-forwarded-proto",
    "origin",
    "referer",
  ];

  for (const header of includeHeaders) {
    const value = req.headers[header];
    if (value) {
      headers[header] = Array.isArray(value) ? value.join(", ") : value;
    }
  }

  return headers;
}

/**
 * Get the remote IP address, considering proxies
 */
function getRemoteIp(req: Request): string {
  // Check X-Forwarded-For header (set by proxies/load balancers)
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0];
    return ips.trim();
  }

  // Check X-Real-IP header (used by nginx)
  const realIp = req.headers["x-real-ip"];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }

  // Fall back to socket remote address
  return req.socket.remoteAddress ?? "unknown";
}
