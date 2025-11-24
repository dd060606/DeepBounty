import { Alert, NotificationService } from "@deepbounty/sdk/types";
import { DiscordNotifier } from "./discord.js";
import { ntfyshNotifier } from "./ntfysh.js";

export interface INotifier {
  send(alert: Alert): Promise<void>;
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
