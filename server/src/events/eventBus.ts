import Logger from "@/utils/logger.js";
import {
  CoreEvents,
  EventHandler,
  EventSubscription,
  IEventBus,
  EventMetadata,
} from "@deepbounty/sdk";
import { getEventMetrics } from "./eventMetrics.js";

const logger = new Logger("EventBus");

let eventBusInstance: EventBus | null = null;

/**
 * Centralized event bus for real-time module communication
 * Supports type-safe predefined events and flexible custom events
 */
export class EventBus implements IEventBus {
  private listeners: Map<string, Set<EventHandler>> = new Map();

  // Bounded-concurrency runner.
  private readonly maxConcurrency: number = Number(process.env.EVENT_HANDLER_CONCURRENCY) || 20;
  private activeHandlers = 0;
  private handlerQueue: Array<() => Promise<void>> = [];
  // Observability: warn (once per burst) when producers outpace handlers and the
  // queue grows large. We never drop events (that would be a lost finding), so
  // the real backpressure lives in the producers (module loops yield between
  // emits).
  private readonly queueWarnThreshold = Number(process.env.EVENT_QUEUE_WARN) || 1000;
  private queueDepthWarned = false;

  constructor() {}

  private enqueueHandler(task: () => Promise<void>): void {
    this.handlerQueue.push(task);
    if (this.handlerQueue.length >= this.queueWarnThreshold && !this.queueDepthWarned) {
      this.queueDepthWarned = true;
      logger.warn(
        `Event handler queue depth high (${this.handlerQueue.length}); a producer is outpacing handlers (concurrency=${this.maxConcurrency}).`
      );
    }
    this.drainHandlers();
  }

  private drainHandlers(): void {
    while (this.activeHandlers < this.maxConcurrency && this.handlerQueue.length > 0) {
      const task = this.handlerQueue.shift()!;
      this.activeHandlers++;
      task().finally(() => {
        this.activeHandlers--;
        this.drainHandlers();
      });
    }
    if (this.handlerQueue.length === 0) this.queueDepthWarned = false;
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
    // Wrap event data with metadata (origin="server" for global bus)
    const eventMetadata: EventMetadata<any> = {
      origin: "server",
      data,
    };
    this.dispatch(event, eventMetadata);
  }

  /**
   * Emit raw event data without wrapping (internal use only)
   * Used by ModuleEventBus to emit pre-wrapped events
   * @internal
   */
  emitRaw(event: string, eventMetadata: EventMetadata<any>): void {
    this.dispatch(event, eventMetadata);
  }

  /**
   * Dispatch an event to all handlers with error isolation and metrics.
   * Always counts the emit (even with no listeners) so throughput reflects
   * real event volume; handler timing is recorded per invocation.
   */
  private dispatch(event: string, eventMetadata: EventMetadata<any>): void {
    const metrics = getEventMetrics();
    metrics.recordEmit(event);

    const handlers = this.listeners.get(event);
    if (!handlers || handlers.size === 0) return;

    // Process each handler with error isolation, under the concurrency cap.
    handlers.forEach((handler) => {
      this.enqueueHandler(async () => {
        const start = Date.now();
        let errored = false;
        try {
          await handler(eventMetadata);
        } catch (error) {
          errored = true;
          // Error isolation - log but don't throw to prevent cascading failures
          logger.error(`Error in handler for event '${event}':`, error);
        } finally {
          metrics.recordHandler(event, Date.now() - start, errored);
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
