import type { ServerAPI } from "@deepbounty/sdk";

/**
 * Example of using the ModuleStorage API
 * This demonstrates how to create tables and manage data in an isolated SQLite database
 */
export function initializeStorage(api: ServerAPI) {
	// Create a table for storing scan results
	api.storage.createTable(
		"scan_results",
		`
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_id INTEGER NOT NULL,
    subdomain TEXT NOT NULL,
    discovered_at INTEGER NOT NULL,
    UNIQUE(target_id, subdomain)
  `
	);

	// Create an index for better query performance
	api.storage.execute(
		"CREATE INDEX IF NOT EXISTS idx_scan_results_target ON scan_results(target_id)"
	);

	api.logger.info("Storage initialized with scan_results table");
}

/**
 * Store a newly discovered subdomain
 */
export function storeSubdomain(
	api: ServerAPI,
	targetId: number,
	subdomain: string
) {
	try {
		// Check if the subdomain already exists
		const exists = api.storage.query(
			"SELECT 1 FROM scan_results WHERE target_id = ? AND subdomain = ? LIMIT 1",
			[targetId, subdomain]
		);
		if (exists.length > 0) {
			// already present, nothing to do
			return;
		}

		api.storage.execute(
			"INSERT INTO scan_results (target_id, subdomain, discovered_at) VALUES (?, ?, ?)",
			[targetId, subdomain, Date.now()]
		);
	} catch (err: any) {
		api.logger.error("Failed to store subdomain", err);
	}
}

/**
 * Get all subdomains for a target
 */
export function getSubdomainsForTarget(
	api: ServerAPI,
	targetId: number
): Array<{ id: number; subdomain: string; discovered_at: number }> {
	return api.storage.query(
		"SELECT id, subdomain, discovered_at FROM scan_results WHERE target_id = ? ORDER BY discovered_at DESC",
		[targetId]
	);
}
