import { query } from "@/db/database.js";
import Logger from "@/utils/logger.js";
import { sql } from "drizzle-orm";

const logger = new Logger("EventMetrics");

// How often the in-memory counters are flushed to the database
const FLUSH_INTERVAL_MS = 60 * 1000;

interface Counter {
  // Number of times the event was emitted
  count: number;
  // Number of handler invocations (an emit with N subscribers counts N)
  handlerCount: number;
  totalHandlerMs: number;
  maxHandlerMs: number;
  errors: number;
}

/**
 * Lightweight in-memory collector for event-bus throughput and handler timing.
 *
 * Counters are kept in memory (no per-event DB writes, which would themselves be
 * a bottleneck under high event volume) and flushed to `event_metrics` on a fixed
 * interval, so write volume stays bounded regardless of event rate.
 */
class EventMetricsCollector {
  private counters: Map<string, Counter> = new Map();
  private windowStart: Date = new Date();
  private flushTimer: NodeJS.Timeout | null = null;

  private getCounter(eventType: string): Counter {
    let c = this.counters.get(eventType);
    if (!c) {
      c = { count: 0, handlerCount: 0, totalHandlerMs: 0, maxHandlerMs: 0, errors: 0 };
      this.counters.set(eventType, c);
    }
    return c;
  }

  /** Record that one event of `eventType` was emitted. */
  recordEmit(eventType: string): void {
    this.getCounter(eventType).count++;
  }

  /** Record a single handler invocation's duration (ms) and whether it errored. */
  recordHandler(eventType: string, durationMs: number, errored: boolean): void {
    const c = this.getCounter(eventType);
    c.handlerCount++;
    c.totalHandlerMs += durationMs;
    if (durationMs > c.maxHandlerMs) c.maxHandlerMs = durationMs;
    if (errored) c.errors++;
  }

  /** Begin the periodic flush. Safe to call once at startup. */
  start(): void {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => void this.flush(), FLUSH_INTERVAL_MS);
    this.flushTimer.unref?.();
  }

  /** Flush accumulated counters to the database and reset the window. */
  async flush(): Promise<void> {
    if (this.counters.size === 0) {
      this.windowStart = new Date();
      return;
    }

    const snapshot = this.counters;
    const windowStart = this.windowStart;
    // Swap in a fresh window before awaiting any I/O
    this.counters = new Map();
    this.windowStart = new Date();
    const windowEnd = new Date();

    try {
      for (const [eventType, c] of snapshot) {
        // Average per handler invocation (not per emit) so it never exceeds the max
        const avgHandlerMs =
          c.handlerCount > 0 ? Math.round(c.totalHandlerMs / c.handlerCount) : 0;
        await query(sql`
          INSERT INTO event_metrics
            ("eventType", "windowStart", "windowEnd", count, "avgHandlerMs", "maxHandlerMs", errors)
          VALUES (
            ${eventType},
            ${windowStart.toISOString()},
            ${windowEnd.toISOString()},
            ${c.count},
            ${avgHandlerMs},
            ${Math.round(c.maxHandlerMs)},
            ${c.errors}
          )
        `);
      }
    } catch (error) {
      logger.error("Failed to flush event metrics:", error);
    }
  }
}

let instance: EventMetricsCollector | null = null;

export function getEventMetrics(): EventMetricsCollector {
  if (!instance) {
    instance = new EventMetricsCollector();
  }
  return instance;
}
