import fs from "fs";
import path from "path";
import Logger from "@/utils/logger.js";

const logger = new Logger("AlertQueue");

// Durable, on-disk dead-letter queue for alerts whose INSERT could not be
// committed. Alerts are security findings and must
// never be silently dropped, so a failed write is persisted here and retried in
// the background until it succeeds, surviving process restarts.
const dataDir = path.join(process.cwd(), "data");
const filePath = path.join(dataDir, "pending-alerts.json");

export interface PendingAlertRow {
  targetId: number | null;
  name: string;
  subdomain: string;
  score: number;
  confirmed: boolean;
  description: string;
  endpoint: string;
  enqueuedAt: string;
}

// Re-inserts a single pending row. Must throw on failure so the row is kept.
type AlertInserter = (row: PendingAlertRow) => Promise<void>;

let pending: PendingAlertRow[] = [];
let loaded = false;
let flushing = false;
let flushTimer: NodeJS.Timeout | null = null;
let inserter: AlertInserter | null = null;

const FLUSH_INTERVAL_MS = 30_000;

function ensureLoaded(): void {
  if (loaded) return;
  loaded = true;
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf8").trim();
      pending = raw ? (JSON.parse(raw) as PendingAlertRow[]) : [];
      if (pending.length) {
        logger.warn(`Loaded ${pending.length} pending alert(s) from durable queue.`);
      }
    }
  } catch (error) {
    logger.error("Failed to load pending alerts from disk:", error);
    pending = [];
  }
}

// Atomic write (temp + rename) so a crash mid-write can't corrupt the queue.
function persistToDisk(): void {
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    const tmp = `${filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(pending));
    fs.renameSync(tmp, filePath);
  } catch (error) {
    logger.error("Failed to persist pending alerts to disk:", error);
  }
}

/**
 * Persist an alert whose write to the database failed. The row is retried in the
 * background until it commits, so the finding is never lost.
 */
export function enqueueFailedAlert(row: Omit<PendingAlertRow, "enqueuedAt">): void {
  ensureLoaded();
  pending.push({ ...row, enqueuedAt: new Date().toISOString() });
  persistToDisk();
  logger.warn(
    `Alert "${row.name}" (${row.subdomain}) could not be committed; saved to durable queue (size=${pending.length}). Will retry.`
  );
}

/** Attempt to flush all pending alerts. Survivors are kept for the next cycle. */
async function flush(): Promise<void> {
  if (flushing || !inserter) return;
  ensureLoaded();
  if (pending.length === 0) return;

  flushing = true;
  try {
    const survivors: PendingAlertRow[] = [];
    for (const row of pending) {
      try {
        await inserter(row);
      } catch {
        survivors.push(row); // keep for next attempt
      }
    }
    const flushed = pending.length - survivors.length;
    pending = survivors;
    persistToDisk();
    if (flushed > 0) {
      logger.info(
        `Re-committed ${flushed} previously-failed alert(s); ${pending.length} still pending.`
      );
    }
  } finally {
    flushing = false;
  }
}

/**
 * Start the durable alert queue. Loads any persisted alerts, retries them once
 * immediately, then on a fixed interval.
 */
export function startAlertQueue(insertFn: AlertInserter): void {
  inserter = insertFn;
  ensureLoaded();
  void flush();
  if (!flushTimer) {
    flushTimer = setInterval(() => void flush(), FLUSH_INTERVAL_MS);
    flushTimer.unref?.();
  }
}
