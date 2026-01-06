import { Alert, DiscordConfig } from "@deepbounty/sdk/types";
import { INotifier } from "./notifier.js";

export class DiscordNotifier implements INotifier {
  private webhookUrl?: string;
  private notificationRoleID?: string;

  constructor(config: DiscordConfig) {
    this.webhookUrl = config.webhookUrl;
    this.notificationRoleID = config.notificationRoleID;
  }

  async send(alertName: string, targetName: string): Promise<void> {
    await this.sendNotification(`${targetName} Alert`, alertName);
  }

  private async sendNotification(title: string, description: string): Promise<void> {
    // Check if webhookUrl is defined
    if (!this.webhookUrl) {
      throw new Error("webhookUrl is required.");
    }
    // Prepare role mention if notificationRoleID is provided
    const roleMention = this.notificationRoleID ? `<@&${this.notificationRoleID}>` : null;
    // Send the notification to Discord webhook
    try {
      const response = await fetch(this.webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: roleMention,
          embeds: [{ title, description, color: 1424001 }],
          attachments: [],
        }),
      });

      if (!response.ok) {
        throw new Error(`Discord notification failed: ${response.status} ${response.statusText}`);
      }
    } catch (error: any) {
      if (error instanceof Error) throw error;
      throw new Error("Discord notification failed: Unknown error");
    }
  }

  async test(): Promise<void> {
    await this.sendNotification(
      "Test Notification from DeepBounty",
      "This is a test message to verify your Discord configuration is working correctly."
    );
  }
}
