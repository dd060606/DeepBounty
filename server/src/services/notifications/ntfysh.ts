import { Alert } from "@deepbounty/sdk/types";
import { INotifier } from "./notifier.js";

export class ntfyshNotifier implements INotifier {
  private topic: string;

  constructor(config: { topic: string; apiKey: string }) {
    this.topic = config.topic;
  }

  async send(alert: Alert): Promise<void> {
    // Send a message to the ntfy.sh topic
  }
}
