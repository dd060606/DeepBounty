import { Request, Response } from "express";
import Logger from "@/utils/logger.js";
import { query, queryOne } from "@/db/database.js";
import { sql } from "drizzle-orm";
import { NotificationService } from "@deepbounty/sdk/types";

const logger = new Logger("Notifications");

// GET /notifications - get all notification services
export const getNotificationServices = async (req: Request, res: Response) => {
  try {
    const services = await query<NotificationService>(
      sql`SELECT provider, config, enabled FROM notification_services ORDER BY provider`
    );
    res.json(services);
  } catch (error) {
    logger.error("Error fetching notification services:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// PUT /notifications/:provider - create or update a notification service
export const updateNotificationService = async (req: Request, res: Response) => {
  try {
    const { provider } = req.params;
    const { config, enabled } = req.body;

    const service = await queryOne<NotificationService>(
      sql`INSERT INTO notification_services (provider, config, enabled)
          VALUES (${provider}, ${JSON.stringify(config)}, ${enabled})
          ON CONFLICT (provider) 
          DO UPDATE SET config = EXCLUDED.config, enabled = EXCLUDED.enabled
          RETURNING provider, config, enabled`
    );

    logger.info(`Notification service '${provider}' updated`);
    res.json(service);
  } catch (error) {
    logger.error("Error updating notification service:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
