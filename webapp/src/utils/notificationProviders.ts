import type { NotificationService } from "@deepbounty/sdk/types";

export interface NotificationConfig {
  provider: NotificationService["provider"];
  enabled: boolean;
  config: Record<string, string>;
}

export interface NotificationConfigField {
  name: string;
  label: string;
  type: "text" | "password" | "number";
  placeholder?: string;
}

export interface ProviderInfo {
  label: string;
  fields: NotificationConfigField[];
}

export const NOTIFICATION_PROVIDERS: Record<NotificationService["provider"], ProviderInfo> = {
  discord: {
    label: "Discord",
    fields: [
      {
        name: "webhookUrl",
        label: "webhookUrl",
        type: "text",
        placeholder: "https://discord.com/api/webhooks/...",
      },
    ],
  },
  ntfysh: {
    label: "ntfy.sh",
    fields: [
      {
        name: "topic",
        label: "topic",
        type: "text",
        placeholder: "your-topic",
      },
    ],
  },
};

export const PROVIDER_ORDER: NotificationService["provider"][] = ["discord", "ntfysh"];
