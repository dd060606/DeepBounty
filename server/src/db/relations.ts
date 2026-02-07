import { relations } from "drizzle-orm/relations";
import {
  targets,
  targetsSubdomains,
  targetsPackages,
  targetsSettings,
  alerts,
  taskTemplates,
  targetTaskOverrides,
} from "./schema.js";

export const targetsSubdomainsRelations = relations(targetsSubdomains, ({ one }) => ({
  target: one(targets, {
    fields: [targetsSubdomains.targetId],
    references: [targets.id],
  }),
}));

export const targetsRelations = relations(targets, ({ many }) => ({
  targetsSubdomains: many(targetsSubdomains),
  targetsPackages: many(targetsPackages),
  targetsSettings: many(targetsSettings),
  alerts: many(alerts),
  targetTaskOverrides: many(targetTaskOverrides),
}));

export const targetsPackagesRelations = relations(targetsPackages, ({ one }) => ({
  target: one(targets, {
    fields: [targetsPackages.targetId],
    references: [targets.id],
  }),
}));

export const targetsSettingsRelations = relations(targetsSettings, ({ one }) => ({
  target: one(targets, {
    fields: [targetsSettings.targetId],
    references: [targets.id],
  }),
}));

export const alertsRelations = relations(alerts, ({ one }) => ({
  target: one(targets, {
    fields: [alerts.targetId],
    references: [targets.id],
  }),
}));

export const taskTemplatesRelations = relations(taskTemplates, ({ many }) => ({
  targetTaskOverrides: many(targetTaskOverrides),
}));

export const targetTaskOverridesRelations = relations(targetTaskOverrides, ({ one }) => ({
  target: one(targets, {
    fields: [targetTaskOverrides.targetId],
    references: [targets.id],
  }),
  taskTemplate: one(taskTemplates, {
    fields: [targetTaskOverrides.taskTemplateId],
    references: [taskTemplates.id],
  }),
}));
