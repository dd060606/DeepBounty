import { query } from "@/db/database.js";
import Logger from "../utils/logger.js";
import { sql } from "drizzle-orm";

const logger = new Logger("Analytics");

// Default retention window for raw execution rows / event metrics (days)
const DEFAULT_RETENTION_DAYS = 30;

export interface ExecutionRecord {
  templateId?: number | null;
  moduleId?: string | null;
  targetId?: number | null;
  workerId?: number | null;
  status: "completed" | "failed";
  success: boolean;
  queuedAt?: Date | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  queueWaitMs?: number | null;
  totalMs?: number | null;
  durationMs?: number | null;
}

export interface TaskTimingStat {
  templateId: number | null;
  name: string | null;
  moduleId: string | null;
  runs: number;
  successes: number;
  failures: number;
  avgMs: number | null;
  minMs: number | null;
  maxMs: number | null;
  p95Ms: number | null;
  avgQueueMs: number | null;
}

export interface EventStat {
  eventType: string;
  totalCount: number;
  avgHandlerMs: number | null;
  maxHandlerMs: number | null;
  errors: number;
  // Per-window time series (oldest first) for charting throughput over time
  series: {
    windowEnd: string;
    count: number;
    avgHandlerMs: number;
    maxHandlerMs: number;
  }[];
}

const toIso = (d?: Date | null): string | null =>
  d ? new Date(d).toISOString() : null;

/**
 * Persist a single task execution record.
 * Fire-and-forget safe: never throws so task completion is never blocked or broken.
 */
export async function recordExecution(record: ExecutionRecord): Promise<void> {
  try {
    await query(sql`
      INSERT INTO task_executions
        ("templateId", "moduleId", "targetId", "workerId", status, success,
         "queuedAt", "startedAt", "completedAt", "queueWaitMs", "totalMs", "durationMs")
      VALUES (
        ${record.templateId ?? null},
        ${record.moduleId ?? null},
        ${record.targetId ?? null},
        ${record.workerId ?? null},
        ${record.status},
        ${record.success},
        ${toIso(record.queuedAt)},
        ${toIso(record.startedAt)},
        ${toIso(record.completedAt) ?? sql`CURRENT_TIMESTAMP`},
        ${record.queueWaitMs ?? null},
        ${record.totalMs ?? null},
        ${record.durationMs ?? null}
      )
    `);
  } catch (error) {
    logger.error("Failed to record task execution analytics:", error);
  }
}

/**
 * Per-template timing statistics over the last `days` days.
 */
export async function getTaskTimingStats(days: number = 7): Promise<TaskTimingStat[]> {
  const rows = await query<{
    templateId: number | null;
    name: string | null;
    moduleId: string | null;
    runs: string | number;
    successes: string | number;
    failures: string | number;
    avg_ms: string | number | null;
    min_ms: string | number | null;
    max_ms: string | number | null;
    p95_ms: string | number | null;
    avg_queue_ms: string | number | null;
  }>(sql`
    SELECT te."templateId",
           tt.name,
           COALESCE(tt."moduleId", te."moduleId") AS "moduleId",
           COUNT(*) AS runs,
           COUNT(*) FILTER (WHERE te.success) AS successes,
           COUNT(*) FILTER (WHERE NOT te.success) AS failures,
           AVG(te."durationMs") AS avg_ms,
           MIN(te."durationMs") AS min_ms,
           MAX(te."durationMs") AS max_ms,
           percentile_cont(0.95) WITHIN GROUP (ORDER BY te."durationMs") AS p95_ms,
           AVG(te."queueWaitMs") AS avg_queue_ms
    FROM task_executions te
    LEFT JOIN task_templates tt ON tt.id = te."templateId"
    WHERE te."completedAt" > NOW() - (${days}::int * INTERVAL '1 day')
    GROUP BY te."templateId", tt.name, COALESCE(tt."moduleId", te."moduleId")
    ORDER BY avg_ms DESC NULLS LAST
  `);

  const num = (v: string | number | null): number | null =>
    v === null || v === undefined ? null : Math.round(Number(v));

  return rows.map((r) => ({
    templateId: r.templateId,
    name: r.name,
    moduleId: r.moduleId,
    runs: Number(r.runs),
    successes: Number(r.successes),
    failures: Number(r.failures),
    avgMs: num(r.avg_ms),
    minMs: num(r.min_ms),
    maxMs: num(r.max_ms),
    p95Ms: num(r.p95_ms),
    avgQueueMs: num(r.avg_queue_ms),
  }));
}

/**
 * Event throughput statistics over the last `days` days, grouped by event type,
 * each with a per-window time series for charting.
 */
export async function getEventStats(days: number = 1): Promise<EventStat[]> {
  const rows = await query<{
    eventType: string;
    windowEnd: string;
    count: string | number;
    avgHandlerMs: string | number;
    maxHandlerMs: string | number;
    errors: string | number;
  }>(sql`
    SELECT "eventType", "windowEnd", count, "avgHandlerMs", "maxHandlerMs", errors
    FROM event_metrics
    WHERE "windowEnd" > NOW() - (${days}::int * INTERVAL '1 day')
    ORDER BY "eventType" ASC, "windowEnd" ASC
  `);

  const byType = new Map<string, EventStat>();
  for (const r of rows) {
    const count = Number(r.count);
    const avgHandlerMs = Number(r.avgHandlerMs);
    const maxHandlerMs = Number(r.maxHandlerMs);
    const errors = Number(r.errors);

    let stat = byType.get(r.eventType);
    if (!stat) {
      stat = {
        eventType: r.eventType,
        totalCount: 0,
        avgHandlerMs: null,
        maxHandlerMs: null,
        errors: 0,
        series: [],
      };
      byType.set(r.eventType, stat);
    }
    stat.totalCount += count;
    stat.errors += errors;
    stat.maxHandlerMs = Math.max(stat.maxHandlerMs ?? 0, maxHandlerMs);
    stat.series.push({
      windowEnd: new Date(r.windowEnd).toISOString(),
      count,
      avgHandlerMs,
      maxHandlerMs,
    });
  }

  // Compute count-weighted average handler time across windows
  for (const stat of byType.values()) {
    const weighted = stat.series.reduce((acc, w) => acc + w.avgHandlerMs * w.count, 0);
    stat.avgHandlerMs = stat.totalCount > 0 ? Math.round(weighted / stat.totalCount) : 0;
  }

  return Array.from(byType.values());
}

/**
 * Delete execution rows and event metrics older than the retention window.
 */
export async function cleanupOldAnalytics(
  retentionDays: number = DEFAULT_RETENTION_DAYS
): Promise<void> {
  try {
    await query(sql`
      DELETE FROM task_executions
      WHERE "completedAt" < NOW() - (${retentionDays}::int * INTERVAL '1 day')
    `);
    await query(sql`
      DELETE FROM event_metrics
      WHERE "windowEnd" < NOW() - (${retentionDays}::int * INTERVAL '1 day')
    `);
  } catch (error) {
    logger.error("Failed to clean up old analytics:", error);
  }
}

let cleanupTimer: NodeJS.Timeout | null = null;

/**
 * Start a daily retention sweep. Safe to call once during startup.
 */
export function startAnalyticsCleanup(retentionDays: number = DEFAULT_RETENTION_DAYS): void {
  if (cleanupTimer) return;
  // Run once shortly after boot, then daily
  void cleanupOldAnalytics(retentionDays);
  cleanupTimer = setInterval(
    () => void cleanupOldAnalytics(retentionDays),
    24 * 60 * 60 * 1000
  );
  // Don't keep the process alive solely for this timer
  cleanupTimer.unref?.();
}
