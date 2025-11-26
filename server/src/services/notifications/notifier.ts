import { Alert, NotificationProvider, NotificationService } from "@deepbounty/sdk/types";
import { DiscordNotifier } from "./discord.js";
import { ntfyshNotifier } from "./ntfysh.js";

export const NOTIFICATION_PROVIDERS: Record<string, NotificationProvider> = {
  discord: {
    label: "Discord",
    fields: [
      {
        name: "webhookUrl",
        type: "text",
        placeholder: "https://discord.com/api/webhooks/...",
        required: true,
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
  send(alert: Alert): Promise<void>;
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
