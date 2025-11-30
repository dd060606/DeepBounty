import { Alert, ntfyshConfig } from "@deepbounty/sdk/types";
import { INotifier } from "./notifier.js";
import axios from "axios";

export class ntfyshNotifier implements INotifier {
  private serverRootUrl?: string;
  private topic?: string;
  private username?: string;
  private password?: string;
  private token?: string;

  constructor(config: ntfyshConfig) {
    this.serverRootUrl = config.serverRootUrl;
    this.topic = config.topic;
    this.username = config.username;
    this.password = config.password;
    this.token = config.token;
  }

  async send(alert: Alert): Promise<void> {
    await this.sendNotification(`${alert.targetName} Alert`, alert.name);
  }

  private async sendNotification(title: string, description: string): Promise<void> {
    // Check if serverRootUrl and topic are defined
    if (!this.serverRootUrl) {
      throw new Error("serverRootUrl is required.");
    }
    if (!this.topic) {
      throw new Error("topic is required.");
    }
    // Strip trailing slash from serverRootUrl if present
    const serverUrl = this.serverRootUrl?.endsWith("/")
      ? this.serverRootUrl.slice(0, -1)
      : this.serverRootUrl;
    // Add leading slash to topic if missing
    this.topic = this.topic?.startsWith("/") ? this.topic : `/${this.topic}`;
    const url = `${serverUrl}${this.topic}`;
    // Set up headers for authentication if provided
    const headers: Record<string, string> = {
      Title: title,
      Priority: "high",
      // Basic auth if username and password are provided
      ...(this.username && this.password
        ? {
            Authorization:
              "Basic " + Buffer.from(`${this.username}:${this.password}`).toString("base64"),
          }
        : // Bearer token auth if token is provided
          this.token
          ? { Authorization: `Bearer ${this.token}` }
          : {}),
    };
    // Send the notification to ntfy.sh
    try {
      await axios.post(url, description, { headers });
    } catch (error: any) {
      throw new Error(
        `ntfy.sh notification failed: ${error.response?.status} ${error.response?.statusText}`
      );
    }
  }

  async test(): Promise<void> {
    await this.sendNotification(
      "Test Notification from DeepBounty",
      "This is a test message to verify your ntfy.sh configuration is working correctly."
    );
  }
}
