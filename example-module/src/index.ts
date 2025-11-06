import type { ServerAPI, PluginLifecycle } from "@deepbounty/sdk";
import { sendTestRequest } from "./utils";
import { FIND_SUBDOMAINS_TASK, subdomainsCallback } from "./tasks/subfinder";
import { SUBFINDER } from "./tools";

export default class ExamplePlugin implements PluginLifecycle {
	constructor(private api: ServerAPI) {}

	private registerTools() {
		// Register tools
		this.api.registerTool(SUBFINDER);
	}

	private registerTasks() {
		// Register tasks
		this.api.registerTaskTemplate(
			"Subdomain Discovery",
			"Find subdomains using subfinder for all active targets",
			FIND_SUBDOMAINS_TASK,
			30, // every 30 seconds
			(res) => subdomainsCallback(this.api, res)
		);
	}

	async run() {
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

		// Error test
		throw new Error("Test error from ExamplePlugin");
	}

	async stop() {
		this.api.logger.info("Example plugin: stop");
	}
}
