import type { ServerAPI } from "@deepbounty/sdk";
import type {
	ModuleCallback,
	CallbackTriggerData,
} from "@deepbounty/sdk/types";

/**
 * Example: Callback API Usage
 *
 * This demonstrates how to use the callbacks API to detect out-of-band
 * exploitation.
 */
export function setupCallbacksExample(api: ServerAPI) {
	// Register a callback handler
	// This handler is called whenever any callback for this module is triggered
	api.callbacks.onTrigger(
		async (callback: ModuleCallback, triggerData: CallbackTriggerData) => {
			api.logger.info(` Callback triggered: ${callback.name}`);
			api.logger.info(`   Remote IP: ${triggerData.remoteIp}`);
			api.logger.info(`   User-Agent: ${triggerData.userAgent}`);
			api.logger.info(`   Body: ${JSON.stringify(triggerData.body)}`);
			api.logger.info(
				`   Metadata: ${JSON.stringify(callback.metadata)}`
			);

			const { targetId } = callback.metadata as {
				targetId: number;
			};

			if (targetId) {
				await api.createAlert(
					`Vulnerability Confirmed - ${targetId}`,
					targetId,
					4, // Critical severity
					`The command was executed on a host.
        
Remote IP: ${triggerData.remoteIp}
Hostname: ${triggerData.body.hostname || "unknown"}
User: ${triggerData.body.user || "unknown"}
Triggered at: ${triggerData.triggeredAt}`,
					`/cb/${callback.uuid}`,
					true // Confirmed vulnerability
				);
			}
		}
	);
}

/**
 * Example: Create a callback for a specific attack
 */
export async function createCallback(
	api: ServerAPI,
	targetId: number
): Promise<{ uuid: string; url: string }> {
	// Create a callback with metadata
	const { uuid, url } = await api.callbacks.create(
		`attack-${targetId}`,
		{
			targetId,
			createdBy: "attack-detector",
		},
		{
			expiresIn: 86400 * 30, // Expire after 30 days
			allowMultipleTriggers: true, // Allow multiple triggers
		}
	);

	api.logger.info(`Created callback for ${targetId}: ${url}`);

	return { uuid, url };
}

/**
 * Example: List all active callbacks
 */
export async function listActiveCallbacks(api: ServerAPI) {
	const callbacks = await api.callbacks.list();
	api.logger.info(`Active callbacks: ${callbacks.length}`);

	for (const cb of callbacks) {
		api.logger.info(`  - ${cb.name} (${cb.uuid})`);
		api.logger.info(`    Triggered: ${cb.triggerCount} times`);
		api.logger.info(`    Expires: ${cb.expiresAt || "never"}`);
	}

	return callbacks;
}

/**
 * Example: Cleanup old callbacks
 */
export async function cleanupCallbacks(api: ServerAPI) {
	// List including expired
	const allCallbacks = await api.callbacks.list(true);

	// Delete callbacks that have been triggered and are older than 7 days
	const now = new Date();
	const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

	let deleted = 0;
	for (const cb of allCallbacks) {
		const createdAt = new Date(cb.createdAt);
		if (cb.triggerCount > 0 && createdAt < sevenDaysAgo) {
			await api.callbacks.delete(cb.uuid);
			deleted++;
		}
	}

	api.logger.info(`Cleaned up ${deleted} old callbacks`);
}
