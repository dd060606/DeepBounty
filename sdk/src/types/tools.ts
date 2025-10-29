export interface Tool {
	// Tool details
	name: string;
	version: string;
	description?: string;
	// Direct URL to download the tool
	downloadUrl: string;
	// Before downloading the tool, execute pre installation commands
	preInstallCommands?: string[];
	// After downloading the tool, execute post installation commands
	postInstallCommands?: string[];
}
