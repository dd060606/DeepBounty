import type { ServerAPI, PluginLifecycle } from "@deepbounty/sdk";
import { sendTestRequest } from "./utils";
import { FIND_SUBDOMAINS_TASK, subdomainsCallback } from "./tasks/subfinder";
import { SUBFINDER } from "./tools";
import { initializeStorage } from "./storage";

export default class ExamplePlugin implements PluginLifecycle {
	constructor(private api: ServerAPI) {}

	private registerTools() {
		// Register tools
		this.api.registerTool(SUBFINDER);
	}

	private registerTasks() {
		// Register tasks
		this.api.registerTaskTemplate(
			"subdomain-scan",
			"Subdomain Discovery",
			"Find subdomains using subfinder for all active targets",
			FIND_SUBDOMAINS_TASK,
			500, // every 5 minutes
			(res) => subdomainsCallback(this.api, res)
		);
	}

	async run() {
		// Initialize module storage
		initializeStorage(this.api);
		this.registerTools();
		this.registerTasks();

		this.api.logger.info("Example plugin: run");

		// Send a web request using a external library (axios)
		const response = await sendTestRequest();
		this.api.logger.info(`Google status: ${response.status}`);

		// Example of using the ModuleConfig
		await this.api.config.set(
			"examplePluginLastRun",
			new Date().toISOString()
		);
		this.api.config.getAll().then((cfg) => {
			this.api.logger.info(`Current config: ${JSON.stringify(cfg)}`);
		});
		/*
		this.api.createAlert(
			1,
			"Test Alert",
			"sub.example.com",
			2,
			"This is a test alert",
			"/test-endpoint",
			true
		);
		*/

		// Subscribe to events
		this.api.events.subscribe("http:traffic", async (data) => {
			this.api.logger.info(
				`Received HTTP traffic event: ${data.method} ${data.url} - ${data.statusCode}`
			);
			// Process the HTTP traffic data as needed
		});
	}

	async stop() {
		this.api.logger.info("Example plugin: stop");
	}
}
