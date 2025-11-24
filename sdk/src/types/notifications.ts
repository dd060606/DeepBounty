export type NotificationService =
	| {
			provider: "discord";
			config: DiscordConfig;
	  }
	| {
			provider: "ntfysh";
			config: ntfyshConfig;
	  };

// Specific configurations for each notification service
export interface DiscordConfig {
	webhookUrl: string;
}

export interface ntfyshConfig {
	topic: string;
	apiKey: string;
}
