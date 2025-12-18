import type { ServerAPI } from "@deepbounty/sdk";

/**
 * Example demonstrating the Files API for managing module files
 */
export function filesApiExample(api: ServerAPI) {
	api.logger.info("Files API Example - Demonstrating file management");

	// 1. Create a cache directory (auto-created if doesn't exist)
	const cache = api.files.getDirectory("cache");

	// 2. Write and read text files
	cache.writeFileText(
		"config.json",
		JSON.stringify({ version: 1, enabled: true }, null, 2)
	);
	const config = JSON.parse(cache.readFileText("config.json"));
	api.logger.info(`Loaded config: version ${config.version}`);

	// 3. Write binary files (e.g., images, archives)
	const imageData = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG header
	cache.writeFile("thumbnail.png", imageData);

	// 4. Work with nested directory structures
	const exports = api.files.getDirectory("exports");
	exports.writeFileText("data/results.csv", "id,name,score\n1,test,100");
	api.logger.info(`Wrote CSV with nested path`);

	// 5. Create and use subdirectories
	const logs = api.files.getDirectory("logs");
	const archiveLogs = logs.getSubdirectory("archive");
	archiveLogs.writeFileText(
		`scan-${Date.now()}.log`,
		`Scan completed at ${new Date().toISOString()}\n`
	);

	// 6. List files in a directory
	const cacheFiles = cache.listFiles();
	api.logger.info(`Files in cache: ${cacheFiles.join(", ")}`);

	// 7. Check file existence and delete
	if (cache.fileExists("config.json")) {
		api.logger.info("Config file exists");
		// Uncomment to delete: cache.deleteFile("config.json");
	}

	// 8. Create nested directory structure explicitly
	const processing = api.files.getDirectory("processing");
	processing.writeFileText(
		"queue/pending/task1.json",
		JSON.stringify({ taskId: 1 })
	);

	// 9. Organize screenshots
	const screenshots = api.files.getDirectory("screenshots");
	const targetId = 123;
	screenshots.writeFileText(
		`target-${targetId}/screenshot-${Date.now()}.json`,
		JSON.stringify(
			{
				timestamp: new Date().toISOString(),
				content: "<html>...</html>",
			},
			null,
			2
		)
	);

	api.logger.info("Files API Example - Completed successfully");
}
