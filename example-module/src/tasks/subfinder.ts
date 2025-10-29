import { ServerAPI } from "@deepbounty/sdk";
import type { TaskContent } from "@deepbounty/sdk/types";

export function findSubdomains(api: ServerAPI) {
	// Submit a task to find subdomains using subfinder
	const taskContent: TaskContent = {
		commands: ["./subfinder -d example.com"],
		requiredTools: ["subfinder"],
	};
	api.tasks
		.submit(taskContent)
		.then((result) => {
			api.logger.info(`Subfinder result: ${result.output}`);
		})
		.catch((error) => {
			api.logger.error(`Subfinder task failed: ${error}`);
		});
}
