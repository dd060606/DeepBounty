import { storeSubdomain } from "@/storage";
import { SUBFINDER } from "@/tools";
import { ServerAPI } from "@deepbounty/sdk";
import type { TaskContent, TaskResult } from "@deepbounty/sdk/types";

// Register a subfinder task with a callback to process results
export const FIND_SUBDOMAINS_TASK: TaskContent = {
	commands: [
		// Mark the start of the result we want to extract
		'echo "<<<RESULT_START>>>"',
		// tool:{subfinder} is automatically replaced with /tools/subfinder-2.9.0/subfinder
		"tool:{subfinder} -d {{TARGET_DOMAIN}}",
		// Mark the end of the result
		'echo "<<<RESULT_END>>>"',
	],
	requiredTools: [SUBFINDER],
	extractResult: true,
};

// Register a task with a temporary file
export const FIND_SUBDOMAINS_TASK_WITH_TEMPFILE: TaskContent = {
	commands: [
		// Store subdomains to file (task:tempfile will be replaced by a dedicated temp task file)
		"tool:{subfinder} -d {{TARGET_DOMAIN}} > task:tempfile",

		// Extract only the result we want
		'echo "<<<RESULT_START>>>"',
		"cat task:tempfile | head -n 5",
		'echo "<<<RESULT_END>>>"',

		// Cleanup
		"rm task:tempfile",
	],
	requiredTools: [SUBFINDER],
	extractResult: true,
};

export function subdomainsCallback(api: ServerAPI, result: TaskResult) {
	if (result.success && result.output) {
		// Extract the list of subdomains
		const subdomains = result.output[0]
			.split("\n")
			.filter((line: string) => line.trim().length > 0);

		api.logger.info(`Found ${subdomains.length} subdomains:`);
		for (let i = 0; i < 5; i++) {
			api.logger.info(`  - ${subdomains[i]}`);
			if (result.targetId) {
				storeSubdomain(api, result.targetId, subdomains[i]);
			}
		}
		// You can process the results further here
		// For example: store in database, trigger alerts, etc.
	} else {
		api.logger.error(
			`Subfinder task failed: ${result.error || "Unknown error"}`
		);
	}
}
