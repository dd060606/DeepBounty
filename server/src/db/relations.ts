import { relations } from "drizzle-orm/relations";
import { targets, targetsSubdomains, targetsSettings, alerts } from "./schema";

export const targetsSubdomainsRelations = relations(targetsSubdomains, ({one}) => ({
	target: one(targets, {
		fields: [targetsSubdomains.targetId],
		references: [targets.id]
	}),
}));

export const targetsRelations = relations(targets, ({many}) => ({
	targetsSubdomains: many(targetsSubdomains),
	targetsSettings: many(targetsSettings),
	alerts: many(alerts),
}));

export const targetsSettingsRelations = relations(targetsSettings, ({one}) => ({
	target: one(targets, {
		fields: [targetsSettings.targetId],
		references: [targets.id]
	}),
}));

export const alertsRelations = relations(alerts, ({one}) => ({
	target: one(targets, {
		fields: [alerts.targetId],
		references: [targets.id]
	}),
}));