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
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Enum for task scheduling types
export const schedulingTypeEnum = pgEnum("scheduling_type", ["TARGET_BASED", "GLOBAL", "CUSTOM"]);

// Targets table
export const targets = pgTable("targets", {
  id: serial().primaryKey().notNull(),
  name: text().notNull(),
  domain: text().notNull(),
  activeScan: boolean().default(true).notNull(),
  createdAt: timestamp({ mode: "string" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

// Subdomains table
export const targetsSubdomains = pgTable(
  "targets_subdomains",
  {
    id: serial().primaryKey().notNull(),
    targetId: integer().notNull(),
    subdomain: text().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.targetId],
      foreignColumns: [targets.id],
      name: "targets_subdomains_targetId_fkey",
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
  // When the callback expires (null = never)
  expiresAt: timestamp({ mode: "string" }),
});
