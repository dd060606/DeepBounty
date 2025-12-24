import { ServerAPI } from "@deepbounty/sdk";
import { Tool } from "@deepbounty/sdk/types";

// Function to register tools
export function registerTools(api: ServerAPI) {
	// Register tools
	api.registerTool(SUBFINDER);
}

export const SUBFINDER: Tool = {
	name: "subfinder",
	version: "2.9.0",
	downloadUrl:
		"https://github.com/projectdiscovery/subfinder/releases/download/v2.9.0/subfinder_2.9.0_linux_amd64.zip",
	description: "Subdomain discovery tool",
	// Installation commands are automatically executed in /tools/{tool-name}-{tool-version}/
	preInstallCommands: ['echo "Preparing to install Subfinder"'],
	postInstallCommands: [
		"unzip -o subfinder_2.9.0_linux_amd64.zip",
		"rm subfinder_2.9.0_linux_amd64.zip",
		'echo "Subfinder installation complete"',
	],
};
