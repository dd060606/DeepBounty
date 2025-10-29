import type { ServerAPI, PluginLifecycle } from "@deepbounty/sdk";
import { sendTestRequest } from "./utils";
import { findSubdomains } from "./tasks/subfinder";

export default class ExamplePlugin implements PluginLifecycle {
	constructor(private api: ServerAPI) {}

	async run() {
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

		// Task submission example
		findSubdomains(this.api);

		// Error test
		throw new Error("Test error from ExamplePlugin");
	}

	async stop() {
		this.api.logger.info("Example plugin: stop");
	}
}
