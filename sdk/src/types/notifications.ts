export type NotificationService =
	| {
			provider: "discord";
			config: DiscordConfig;
			enabled: boolean;
	  }
	| {
			provider: "ntfysh";
			config: ntfyshConfig;
			enabled: boolean;
	  };

// Specific configurations for each notification service
export interface DiscordConfig {
	webhookUrl: string;
}

export interface ntfyshConfig {
	serverRootUrl: string;
	topic: string;
	username?: string;
	password?: string;
	token?: string;
}

// Common interfaces for notification providers
export interface NotificationConfigField {
	name: string;
	type: "text" | "password";
	placeholder?: string;
	required?: boolean;
}

export interface NotificationProvider {
	label: string;
	fields: NotificationConfigField[];
}
