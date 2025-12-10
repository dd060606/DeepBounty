import { Request, Response } from "express";
import Logger from "@/utils/logger.js";
import { getEventBus } from "@/events/eventBus.js";
import { HttpTraffic, TrafficContext } from "@deepbounty/sdk/types/burpsuite";

const logger = new Logger("Ingest");

export async function ingestBurpTraffic(req: Request, res: Response) {
  try {
    const traffic: HttpTraffic = req.body;
    const context: TrafficContext = {
      method: traffic.method,
      url: traffic.url,
      mimeType: traffic.mimeType,
      statusCode: traffic.statusCode,
    };

    // Respond immediately to avoid blocking Burp Suite
    res.status(200).json({ success: true });

    // Emit event asynchronously for modules to process
    setImmediate(() => {
      try {
        getEventBus().emit("http:traffic", traffic);

        // Detect specific MIME types for further processing
        if (traffic.mimeType === "SCRIPT") {
          getEventBus().emit("http:js", { js: traffic.responseBody, context });
        }
        if (traffic.mimeType === "HTML") {
          getEventBus().emit("http:html", { html: traffic.responseBody, context });
        }
      } catch (error) {
        logger.error("Error emitting http events:", error);
      }
    });
  } catch (error) {
    logger.error("Error processing Burp Suite traffic:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
