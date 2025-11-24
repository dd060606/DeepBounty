import { Alert } from "@deepbounty/sdk/types";
import { INotifier } from "./notifier.js";

export class DiscordNotifier implements INotifier {
  private webhookUrl: string;

  constructor(config: { webhookUrl: string }) {
    this.webhookUrl = config.webhookUrl;
  }

  async send(alert: Alert): Promise<void> {
    // Send a message to the Discord webhook
  }
}
