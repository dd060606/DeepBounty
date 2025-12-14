import { Alert, DiscordConfig } from "@deepbounty/sdk/types";
import { INotifier } from "./notifier.js";
import axios from "axios";

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
      await axios.post(this.webhookUrl, {
        content: roleMention,
        embeds: [{ title, description, color: 1424001 }],
        attachments: [],
      });
    } catch (error: any) {
      throw new Error(
        `Discord notification failed: ${error.response?.status} ${error.response?.statusText}`
      );
    }
  }

  async test(): Promise<void> {
    await this.sendNotification(
      "Test Notification from DeepBounty",
      "This is a test message to verify your Discord configuration is working correctly."
    );
  }
}
