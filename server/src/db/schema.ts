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
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

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
    targetId: integer().notNull(),
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
    }).onDelete("cascade"),
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
