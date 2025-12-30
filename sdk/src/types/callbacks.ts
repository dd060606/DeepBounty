/**
 * Callback types for external exfiltration detection
 * Used by modules to register callbacks that can be triggered by external HTTP requests
 */

/**
 * Options for creating a callback
 */
export interface CreateCallbackOptions {
	/** Time-to-live in seconds. If not set, the callback never expires */
	expiresIn?: number;
	/** Whether the callback can be triggered multiple times (default: true) */
	allowMultipleTriggers?: boolean;
}

/**
 * Data stored with a callback
 */
export interface ModuleCallback {
	/** Unique identifier (UUID) for the callback */
	uuid: string;
	/** Module that registered this callback */
	moduleId: string;
	/** Human-readable name for the callback */
	name: string;
	/** Arbitrary metadata associated with this callback (e.g., target info) */
	metadata: Record<string, any>;
	/** When the callback was created */
	createdAt: string;
	/** When the callback expires (null = never) */
	expiresAt: string | null;
	/** Whether multiple triggers are allowed */
	allowMultipleTriggers: boolean;
	/** Number of times this callback has been triggered */
	triggerCount: number;
	/** When the callback was last triggered (null = never) */
	lastTriggeredAt: string | null;
}

/**
 * Data received when a callback is triggered
 */
export interface CallbackTriggerData {
	/** The request body sent by the external caller */
	body: Record<string, any>;
	/** HTTP headers from the request */
	headers: Record<string, string>;
	/** IP address of the caller */
	remoteIp: string;
	/** User agent of the caller */
	userAgent: string;
	/** When this trigger occurred */
	triggeredAt: string;
}

/**
 * Handler function called when a callback is triggered
 */
export type CallbackHandler = (
	callback: ModuleCallback,
	triggerData: CallbackTriggerData
) => void | Promise<void>;
