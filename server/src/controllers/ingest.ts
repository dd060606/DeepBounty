import { Request, Response } from "express";
import Logger from "@/utils/logger.js";

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

    // Log the received traffic data
    logger.info("Received Burp Suite traffic:");
    logger.info(`URL: ${traffic.url}`);
    logger.info(`Method: ${traffic.method}`);
    logger.info(`Status Code: ${traffic.statusCode}`);
    logger.info(`MIME Type: ${traffic.mimeType}`);
    logger.info(`Request Headers: ${JSON.stringify(traffic.requestHeaders, null, 2)}`);
    logger.info(`Response Headers: ${JSON.stringify(traffic.responseHeaders, null, 2)}`);
    logger.info(`Request Body: ${traffic.requestBody}`);
    logger.info(`Response Body: ${traffic.responseBody}`);

    res.status(200).json({ success: true, message: "Traffic data received" });
  } catch (error) {
    logger.error("Error processing Burp Suite traffic:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
