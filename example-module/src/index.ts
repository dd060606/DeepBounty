import type { ServerAPI, PluginLifecycle } from "@deepbounty/sdk";
import { sendTestRequest } from "./utils";
import {
	FIND_SUBDOMAINS_TASK,
	FIND_SUBDOMAINS_TASK_WITH_TEMPFILE,
	subdomainsCallback,
} from "./tasks/subfinder";
import { SUBFINDER } from "./tools";

export default class ExamplePlugin implements PluginLifecycle {
	constructor(private api: ServerAPI) {}

	private registerTools() {
		// Register tools
		this.api.registerTool(SUBFINDER);
	}

	private registerTasks() {
		// Register tasks
		// this.api.registerScheduledTask(FIND_SUBDOMAINS_TASK, 30, (res) =>
		// 	subdomainsCallback(this.api, res)
		// ); // every 30 seconds
		this.api.registerScheduledTask(
			FIND_SUBDOMAINS_TASK_WITH_TEMPFILE,
			30,
			(res) => subdomainsCallback(this.api, res)
		); // every 30 seconds
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
