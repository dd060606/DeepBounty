import { TrafficContext, HttpTraffic } from "./types/burpsuite";

/**
 * Predefined core events emitted by the server
 * Modules can also emit custom events for inter-module communication
 */
export interface CoreEvents {
	// HTTP traffic events (Burp Suite, etc.)
	"http:traffic": HttpTraffic;
	// JavaScript code detected in HTTP responses
	"http:js": { context: TrafficContext; js: string };
}

/**
 * Event handler function signature
 */
export type EventHandler<T = any> = (data: T) => void | Promise<void>;

/**
 * Subscription object returned when subscribing to events
 */
export interface EventSubscription {
	unsubscribe: () => void;
}

export interface IEventBus {
	/**
	 * Subscribe to an event
	 * @param event - Event name (type-safe for CoreEvents, flexible for custom events)
	 * @param handler - Async handler function called when event is emitted
	 * @returns Subscription object with unsubscribe method
	 */
	subscribe<K extends keyof CoreEvents>(
		event: K,
		handler: EventHandler<CoreEvents[K]>
	): EventSubscription;
	subscribe<T = any>(
		event: string,
		handler: EventHandler<T>
	): EventSubscription;

	/**
	 * Emit an event with data
	 * Non-blocking, async execution with rate limiting and error isolation
	 * @param event - Event name
	 * @param data - Event data
	 */
	emit<K extends keyof CoreEvents>(event: K, data: CoreEvents[K]): void;
	emit<T = any>(event: string, data: T): void;

	/**
	 * Clear all listeners for a specific event or all events
	 * @param event - Optional event name to clear (clears all if not provided)
	 */
	clear(event?: string): void;
}
