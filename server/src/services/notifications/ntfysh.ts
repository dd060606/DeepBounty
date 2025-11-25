import { Alert } from "@deepbounty/sdk/types";
import { INotifier } from "./notifier.js";

export class ntfyshNotifier implements INotifier {
  private serverRootUrl: string;
  private topic: string;
  private username?: string;
  private password?: string;
  private token?: string;

  constructor(config: {
    serverRootUrl: string;
    topic: string;
    username?: string;
    password?: string;
    token?: string;
  }) {
    this.serverRootUrl = config.serverRootUrl;
    this.topic = config.topic;
    this.username = config.username;
    this.password = config.password;
    this.token = config.token;
  }

  async send(alert: Alert): Promise<void> {
    // Send a message to the ntfy.sh topic
  }
}
