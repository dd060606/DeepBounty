import { CoreEvents, EventHandler, EventSubscription, IEventBus } from "@deepbounty/sdk";
import pLimit from "p-limit";
import { EventBus } from "@/events/eventBus.js";
import Logger from "@/utils/logger.js";

/**
 * Secure proxy for the global EventBus
 * Provides isolation, resource limits, and automatic cleanup for modules
 */
export class ModuleEventBus implements IEventBus {
  private subscriptions: EventSubscription[] = [];
  private limit: ReturnType<typeof pLimit>;
  private logger: Logger;

  constructor(
    private globalBus: EventBus,
    private moduleId: string,
    concurrency: number = 50 // Limit concurrency per module
  ) {
    this.limit = pLimit(concurrency);
    this.logger = new Logger(`EventBus-${moduleId}`);
  }

  /**
   * Subscribe to an event
   * Wraps the handler to enforce module-specific concurrency limits
   */
  subscribe<K extends keyof CoreEvents>(
    event: K,
    handler: EventHandler<CoreEvents[K]>
  ): EventSubscription;
  subscribe<T = any>(event: string, handler: EventHandler<T>): EventSubscription;
  subscribe(event: string, handler: EventHandler): EventSubscription {
    // Wrap handler to use module-specific rate limit
    const safeHandler = async (data: any) => {
      // Check pending count to prevent memory overflow (backpressure)
      if (this.limit.pendingCount > 1000) {
        this.logger.warn(
          `Event queue full for module ${this.moduleId}. Dropping event '${event}'.`
        );
        return;
      }

      await this.limit(async () => {
        try {
          await handler(data);
        } catch (error) {
          this.logger.error(`Error in handler for event '${event}':`, error);
        }
      });
    };

    // Subscribe to global bus with the wrapped handler
    const subscription = this.globalBus.subscribe(event, safeHandler);
    this.subscriptions.push(subscription);

    // Return a subscription object that removes from both global bus and local tracking
    return {
      unsubscribe: () => {
        subscription.unsubscribe();
        const index = this.subscriptions.indexOf(subscription);
        if (index > -1) {
          this.subscriptions.splice(index, 1);
        }
      },
    };
  }

  /**
   * Emit an event
   * Passes through to global bus
   */
  emit<K extends keyof CoreEvents>(event: K, data: CoreEvents[K]): void;
  emit<T = any>(event: string, data: T): void;
  emit(event: string, data: any): void {
    this.globalBus.emit(event, data);
  }

  /**
   * Cleanup all subscriptions for this module
   * Called when module is stopped
   */
  cleanup() {
    this.logger.info(`Cleaning up ${this.subscriptions.length} subscriptions`);
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.subscriptions.length = 0;
  }

  // Not implemented for module bus
  clear(event?: string): void {}
}
