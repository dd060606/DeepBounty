import { Request, Response } from "express";
import Logger from "@/utils/logger.js";
import config from "@/utils/config.js";
import { NotificationService } from "@deepbounty/sdk/types";
import { NOTIFICATION_PROVIDERS, NotificationBuilder } from "@/services/notifications/notifier.js";

const logger = new Logger("Notifications");

// GET /notifications - get all notification providers with their current configuration
export const getNotificationServices = async (req: Request, res: Response) => {
  const { notificationServices } = config.get();

  // Create a map of configured services by provider
  const configuredServices = new Map(
    notificationServices.map((service) => [service.provider, service])
  );

  // Merge providers with their current configuration or default values
  const result = Object.entries(NOTIFICATION_PROVIDERS).reduce(
    (acc, [key, provider]) => {
      const configured = configuredServices.get(key as NotificationService["provider"]);

      acc[key] = {
        ...provider,
        config: configured?.config || {},
        enabled: configured?.enabled ?? false,
      };

      return acc;
    },
    {} as Record<string, any>
  );

  res.status(200).json(result);
};

// PUT /notifications/:provider - create or update a notification service
export const updateNotificationService = async (req: Request, res: Response) => {
  try {
    const { provider } = req.params;
    const { config: serviceConfig, enabled } = req.body;

    const currentConfig = config.get();
    const services = currentConfig.notificationServices || [];

    // Find existing service or create new one
    const existingIndex = services.findIndex((s) => s.provider === provider);

    const updatedService: NotificationService = {
      provider: provider as any,
      config: serviceConfig,
      enabled,
    };

    if (existingIndex >= 0) {
      services[existingIndex] = updatedService;
    } else {
      services.push(updatedService);
    }

    config.set({ notificationServices: services });

    logger.info(`Notification service '${provider}' updated`);
    res.json(updatedService);
  } catch (error) {
    logger.error("Error updating notification service:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// POST /notifications/:provider/test - test a notification service
export const testNotificationService = async (req: Request, res: Response) => {
  const { provider } = req.params;

  try {
    // Get the service configuration from config
    const { notificationServices } = config.get();
    const service = notificationServices.find((s) => s.provider === provider);

    if (!service || !service.config) {
      return res.status(404).json({
        error: `Notification service not configured for provider ${provider}`,
      });
    }
    const notifier = NotificationBuilder.create(service);

    // Send test notification
    await notifier.test();

    logger.info(`Test notification sent successfully for provider '${provider}'`);
    res.json({ success: true, message: "Test notification sent successfully" });
  } catch (error) {
    logger.error(`Error testing notification service '${provider}':`, error);
    res.status(400).json({
      error: "Failed to send test notification",
    });
  }
};
