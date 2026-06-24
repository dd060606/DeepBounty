import Logger from "./logger.js";

const logger = new Logger("EventLoop");

let timer: NodeJS.Timeout | null = null;

// Only warn for stalls long enough to actually hurt a request.
const DEFAULT_THRESHOLD_MS = 1000;

// Periodic memory snapshot cadence (ms).
const MEM_LOG_INTERVAL_MS = Number(process.env.MEM_LOG_INTERVAL_MS) || 60000;

function memSnapshot(): string {
  const m = process.memoryUsage();
  const mb = (n: number) => Math.round(n / (1024 * 1024));
  return `rss=${mb(m.rss)}MB heapUsed=${mb(m.heapUsed)}MB heapTotal=${mb(m.heapTotal)}MB external=${mb(
    m.external
  )}MB`;
}

/**
 * Start monitoring event-loop lag. Warns when the loop is blocked beyond
 * `thresholdMs`, and logs a periodic memory snapshot so stalls can be
 * correlated with RSS/heap growth.
 */
export function startEventLoopMonitor(intervalMs = 1000, thresholdMs = DEFAULT_THRESHOLD_MS): void {
  if (timer) return;
  let last = Date.now();
  let lastMemLog = 0;
  timer = setInterval(() => {
    const now = Date.now();
    const lag = now - last - intervalMs;
    last = now;
    if (lag >= thresholdMs) {
      logger.warn(
        `Event loop blocked for ~${lag}ms (synchronous work is stalling request handling). ${memSnapshot()}`
      );
    }
    if (MEM_LOG_INTERVAL_MS > 0 && now - lastMemLog >= MEM_LOG_INTERVAL_MS) {
      lastMemLog = now;
      logger.info(`Memory: ${memSnapshot()}`);
    }
  }, intervalMs);
  timer.unref?.();
}
