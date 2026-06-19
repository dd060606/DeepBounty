import Logger from "./logger.js";

const logger = new Logger("EventLoop");

let timer: NodeJS.Timeout | null = null;

// Only warn for stalls long enough to actually hurt a request.
const DEFAULT_THRESHOLD_MS = 1000;

/**
 * Start monitoring event-loop lag. Warns when the loop is blocked beyond
 * `thresholdMs`.
 */
export function startEventLoopMonitor(intervalMs = 1000, thresholdMs = DEFAULT_THRESHOLD_MS): void {
  if (timer) return;
  let last = Date.now();
  timer = setInterval(() => {
    const now = Date.now();
    const lag = now - last - intervalMs;
    last = now;
    if (lag >= thresholdMs) {
      logger.warn(
        `Event loop blocked for ~${lag}ms (synchronous work is stalling request handling).`
      );
    }
  }, intervalMs);
  timer.unref?.();
}
