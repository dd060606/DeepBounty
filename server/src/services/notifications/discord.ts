import { Alert, DiscordConfig } from "@deepbounty/sdk/types";
import { INotifier } from "./notifier.js";

export class DiscordNotifier implements INotifier {
  private webhookUrl: string;

  constructor(config: DiscordConfig) {
    this.webhookUrl = config.webhookUrl;
  }

  async send(alert: Alert): Promise<void> {
    // Send a message to the Discord webhook
  }

  async test(): Promise<void> {
    const testPayload = {
      content:
        "🔔 **Test Notification from DeepBounty**\n\nThis is a test message to verify your Discord webhook configuration is working correctly.",
    };

    const response = await fetch(this.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(testPayload),
    });

    if (!response.ok) {
      throw new Error(`Discord webhook test failed: ${response.status} ${response.statusText}`);
    }
  }
}
