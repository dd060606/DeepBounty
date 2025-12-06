import { Request, Response } from "express";
import Logger from "@/utils/logger.js";
import { getEventBus } from "@/events/eventBus.js";

const logger = new Logger("Ingest");

interface TrafficData {
  url: string;
  method: string;
  statusCode: number;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
  requestBody: string;
  responseBody: string;
  mimeType: string;
}

export async function ingestBurpTraffic(req: Request, res: Response) {
  try {
    const traffic: TrafficData = req.body;

    // Respond immediately to avoid blocking Burp Suite
    res.status(200).json({ success: true });

    // Emit event asynchronously for modules to process
    setImmediate(() => {
      try {
        getEventBus().emit("http:traffic", {
          ...traffic,
          timestamp: new Date(),
          targetId: undefined, // TODO: Match target by domain if needed
        });
      } catch (error) {
        logger.error("Error emitting http:traffic event:", error);
      }
    });
  } catch (error) {
    logger.error("Error processing Burp Suite traffic:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
