import {
  pgTable,
  serial,
  timestamp,
  text,
  boolean,
  foreignKey,
  integer,
  jsonb,
  smallint,
  unique,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Enum for task scheduling types
export const schedulingTypeEnum = pgEnum("scheduling_type", ["TARGET_BASED", "GLOBAL", "CUSTOM"]);

// Targets table
export const targets = pgTable(
  "targets",
  {
    id: serial().primaryKey().notNull(),
    name: text().notNull(),
    domain: text().notNull(),
    activeScan: boolean().default(true).notNull(),
    asns: jsonb().default([]).notNull(),
    createdAt: timestamp({ mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [index("targets_domain_idx").on(table.domain)]
);

// Subdomains table
export const targetsSubdomains = pgTable(
  "targets_subdomains",
  {
    id: serial().primaryKey().notNull(),
    targetId: integer().notNull(),
    subdomain: text().notNull(),
    isOutOfScope: boolean().default(false).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.targetId],
      foreignColumns: [targets.id],
      name: "targets_subdomains_targetId_fkey",
    }).onDelete("cascade"),
    index("targets_subdomains_subdomain_idx").on(table.subdomain),
    index("targets_subdomains_targetId_idx").on(table.targetId),
  ]
);

// Target packages table
export const targetsPackages = pgTable(
  "targets_packages",
  {
    id: serial().primaryKey().notNull(),
    targetId: integer().notNull(),
    packageName: text().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.targetId],
      foreignColumns: [targets.id],
      name: "targets_packages_targetId_fkey",
    }).onDelete("cascade"),
  ]
);

// Target settings table
export const targetsSettings = pgTable(
  "targets_settings",
  {
    id: serial().primaryKey().notNull(),
    targetId: integer().notNull(),
    settings: jsonb().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.targetId],
      foreignColumns: [targets.id],
      name: "targets_settings_targetId_fkey",
    }).onDelete("cascade"),
  ]
);

// Alerts table
export const alerts = pgTable(
  "alerts",
  {
    id: serial().primaryKey().notNull(),
    targetId: integer(),
    name: text().notNull(),
    subdomain: text().notNull(),
    score: smallint().notNull(),
    confirmed: boolean().notNull(),
    description: text().notNull(),
    endpoint: text().notNull(),
    createdAt: timestamp({ mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.targetId],
      foreignColumns: [targets.id],
      name: "alerts_targetId_fkey",
    }).onDelete("set null"),
    index("alerts_createdAt_id_idx").on(table.createdAt.desc(), table.id.desc()),
    index("alerts_targetId_idx").on(table.targetId),
  ]
);

// Modules configs table
export const modulesConfigs = pgTable(
  "modules_configs",
  {
    id: serial().primaryKey().notNull(),
    moduleId: text().notNull(),
    key: text().notNull(),
    value: jsonb().notNull(),
  },
  (table) => [unique("modules_configs_unique_module_key").on(table.moduleId, table.key)]
);

// Task templates table (task definitions registered by modules)
export const taskTemplates = pgTable(
  "task_templates",
  {
    id: serial().primaryKey().notNull(),
    moduleId: text().notNull(),
    // Unique identifier for the task within the module (e.g., "subdomain-scan")
    uniqueKey: text().notNull(),
    name: text().notNull(),
    description: text(),
    // Task content (commands and required tools)
    content: jsonb().notNull(),
    // Interval in seconds
    interval: integer().notNull(),
    // Scheduling type
    schedulingType: schedulingTypeEnum().default("TARGET_BASED").notNull(),
    // Global activation status
    active: boolean().default(true).notNull(),
    // Whether the task is marked as aggressive
    aggressive: boolean().default(false).notNull(),
  },
  (table) => [unique("task_templates_unique_key").on(table.moduleId, table.uniqueKey)]
);

// Target-specific task overrides (enable/disable tasks per target)
export const targetTaskOverrides = pgTable(
  "target_task_overrides",
  {
    id: serial().primaryKey().notNull(),
    targetId: integer().notNull(),
    taskTemplateId: integer().notNull(),
    // Override the global activation status for this specific target
    active: boolean().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.targetId],
      foreignColumns: [targets.id],
      name: "target_task_overrides_targetId_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.taskTemplateId],
      foreignColumns: [taskTemplates.id],
      name: "target_task_overrides_taskTemplateId_fkey",
    }).onDelete("cascade"),
    unique("target_task_overrides_unique").on(table.targetId, table.taskTemplateId),
    index("target_task_overrides_taskTemplateId_idx").on(table.taskTemplateId),
  ]
);

// Module callbacks for external exfiltration detection
export const moduleCallbacks = pgTable("module_callbacks", {
  id: serial().primaryKey().notNull(),
  // Unique identifier (UUID) for the callback URL
  uuid: text().notNull().unique(),
  // Module that registered this callback
  moduleId: text().notNull(),
  // Human-readable name for the callback
  name: text().notNull(),
  // Arbitrary metadata (target info, etc.)
  metadata: jsonb().default({}).notNull(),
  // Whether multiple triggers are allowed
  allowMultipleTriggers: boolean().default(true).notNull(),
  // Number of times this callback has been triggered
  triggerCount: integer().default(0).notNull(),
  // When the callback was last triggered
  lastTriggeredAt: timestamp({ mode: "string" }),
  // When the callback was created
  createdAt: timestamp({ mode: "string" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  // When the callback becomes active
  effectiveAt: timestamp({ mode: "string" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  // When the callback expires (null = never)
  expiresAt: timestamp({ mode: "string" }),
});

// Task execution history (performance analytics)
// One row per completed/failed task execution. No hard FK to task_templates
// so history survives template deletion. Pruned by a retention sweep.
export const taskExecutions = pgTable(
  "task_executions",
  {
    id: serial().primaryKey().notNull(),
    // Reference to the task template (nullable; kept even if template is deleted)
    templateId: integer(),
    // Module that owns the template
    moduleId: text(),
    // Target this execution ran for (if any)
    targetId: integer(),
    // Worker that executed the task
    workerId: integer(),
    // Final status: "completed" or "failed"
    status: text().notNull(),
    success: boolean().notNull(),
    // When the execution was created (queued)
    queuedAt: timestamp({ mode: "string" }),
    // When the execution was sent to a worker (started)
    startedAt: timestamp({ mode: "string" }),
    // When the result was received (completed/failed)
    completedAt: timestamp({ mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    // Queue wait = startedAt - queuedAt (ms)
    queueWaitMs: integer(),
    // End-to-end on worker = completedAt - startedAt (ms)
    totalMs: integer(),
    // Pure command runtime measured on the worker (ms)
    durationMs: integer(),
  },
  (table) => [
    index("task_executions_templateId_idx").on(table.templateId),
    index("task_executions_completedAt_idx").on(table.completedAt),
  ]
);

// Aggregated event throughput metrics (performance analytics)
// One row per event type per flush window. Written by a periodic flush of
// in-memory counters so write volume stays bounded regardless of event rate.
export const eventMetrics = pgTable(
  "event_metrics",
  {
    id: serial().primaryKey().notNull(),
    // Event type (e.g. "http:traffic", "http:js")
    eventType: text().notNull(),
    // Start of the aggregation window
    windowStart: timestamp({ mode: "string" }).notNull(),
    // End of the aggregation window
    windowEnd: timestamp({ mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    // Number of events emitted during the window
    count: integer().default(0).notNull(),
    // Average handler processing time during the window (ms)
    avgHandlerMs: integer().default(0).notNull(),
    // Max handler processing time during the window (ms)
    maxHandlerMs: integer().default(0).notNull(),
    // Number of handler errors during the window
    errors: integer().default(0).notNull(),
  },
  (table) => [index("event_metrics_windowEnd_idx").on(table.windowEnd)]
);
