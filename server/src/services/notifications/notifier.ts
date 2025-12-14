import { Alert, NotificationProvider, NotificationService } from "@deepbounty/sdk/types";
import { DiscordNotifier } from "./discord.js";
import { ntfyshNotifier } from "./ntfysh.js";
import config from "@/utils/config.js";
import Logger from "@/utils/logger.js";

const logger = new Logger("Notifier");

export const NOTIFICATION_PROVIDERS: Record<NotificationService["provider"], NotificationProvider> =
  {
    discord: {
      label: "Discord",
      fields: [
        {
          name: "webhookUrl",
          type: "text",
          placeholder: "https://discord.com/api/webhooks/...",
          required: true,
        },
        {
          name: "notificationRoleID",
          type: "text",
          placeholder: "1444704415763398797",
          required: false,
        },
      ],
    },
    ntfysh: {
      label: "ntfy.sh",
      fields: [
        {
          name: "serverRootUrl",
          type: "text",
          placeholder: "https://ntfy.sh",
          required: true,
        },
        {
          name: "topic",
          type: "text",
          placeholder: "/my-topic",
          required: true,
        },
        {
          name: "username",
          type: "text",
          placeholder: "username1234",
          required: false,
        },
        {
          name: "password",
          type: "password",
          placeholder: "password1234",
          required: false,
        },
        {
          name: "token",
          type: "password",
          placeholder: "tk_AgQdq7mVBoFD37zQVN29RhuMzNIz2",
          required: false,
        },
      ],
    },
  };

export interface INotifier {
  send(alertName: string, targetName: string): Promise<void>;
  test(): Promise<void>;
}

export class NotificationBuilder {
  static create(service: NotificationService): INotifier {
    switch (service.provider) {
      case "discord":
        return new DiscordNotifier(service.config);
      case "ntfysh":
        return new ntfyshNotifier(service.config);
    }
  }
}

/**
 * Send an alert notification to all configured and enabled notification providers
 * @param alert - The alert to send
 * @returns Promise that resolves when all notifications are sent (or failed)
 */
export async function sendAlertNotification(alertName: string, targetName: string): Promise<void> {
  const configuration = config.get();
  const notificationServices = configuration.notificationServices || [];

  // Filter enabled services
  const enabledServices = notificationServices.filter((service) => service.enabled);

  if (enabledServices.length === 0) {
    return;
  }

  // Send to all enabled providers in parallel
  await Promise.allSettled(
    enabledServices.map(async (service) => {
      try {
        const notifier = NotificationBuilder.create(service);
        await notifier.send(alertName, targetName);
      } catch (error) {
        logger.error(`Failed to send notification via ${service.provider}:`, error);
      }
    })
  );
}
