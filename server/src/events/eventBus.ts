import Logger from "@/utils/logger.js";
import {
  CoreEvents,
  EventHandler,
  EventSubscription,
  IEventBus,
  EventMetadata,
} from "@deepbounty/sdk";
import pLimit from "p-limit";

const logger = new Logger("EventBus");

let eventBusInstance: EventBus | null = null;

/**
 * Centralized event bus for real-time module communication
 * Supports type-safe predefined events and flexible custom events
 */
export class EventBus implements IEventBus {
  private listeners: Map<string, Set<EventHandler>> = new Map();
  private limit: ReturnType<typeof pLimit>;

  constructor() {
    this.limit = pLimit(100);
  }

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
  subscribe<T = any>(event: string, handler: EventHandler<T>): EventSubscription;
  subscribe(event: string, handler: EventHandler): EventSubscription {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    this.listeners.get(event)!.add(handler);

    return {
      unsubscribe: () => {
        const handlers = this.listeners.get(event);
        if (handlers) {
          handlers.delete(handler);
          if (handlers.size === 0) {
            this.listeners.delete(event);
          }
        }
      },
    };
  }

  /**
   * Emit an event with data
   * Non-blocking, async execution with rate limiting and error isolation
   * Events from the global bus are marked with origin="server"
   * @param event - Event name
   * @param data - Event data
   */
  emit<K extends keyof CoreEvents>(event: K, data: CoreEvents[K]): void;
  emit<T = any>(event: string, data: T): void;
  emit(event: string, data: any): void {
    const handlers = this.listeners.get(event);
    if (!handlers || handlers.size === 0) return;

    // Wrap event data with metadata (origin="server" for global bus)
    const eventMetadata: EventMetadata<any> = {
      origin: "server",
      data,
    };

    // Process each handler with rate limiting and error isolation
    handlers.forEach((handler) => {
      this.limit(async () => {
        try {
          await handler(eventMetadata);
        } catch (error) {
          // Error isolation - log but don't throw to prevent cascading failures
          logger.error(`Error in handler for event '${event}':`, error);
        }
      });
    });
  }

  /**
   * Emit raw event data without wrapping (internal use only)
   * Used by ModuleEventBus to emit pre-wrapped events
   * @internal
   */
  emitRaw(event: string, eventMetadata: EventMetadata<any>): void {
    const handlers = this.listeners.get(event);
    if (!handlers || handlers.size === 0) return;

    // Process each handler with rate limiting and error isolation
    handlers.forEach((handler) => {
      this.limit(async () => {
        try {
          await handler(eventMetadata);
        } catch (error) {
          // Error isolation - log but don't throw to prevent cascading failures
          logger.error(`Error in handler for event '${event}':`, error);
        }
      });
    });
  }

  /**
   * Clear all listeners for a specific event or all events
   * @param event - Optional event name to clear (clears all if not provided)
   */
  clear(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

/**
 * Get the singleton EventBus instance
 * Reads concurrency limit from config or defaults to 100
 */
export function getEventBus(): EventBus {
  if (!eventBusInstance) {
    eventBusInstance = new EventBus();
  }
  return eventBusInstance;
}
