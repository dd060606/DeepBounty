CREATE INDEX IF NOT EXISTS "alerts_createdAt_id_idx" ON "alerts" USING btree ("createdAt" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "alerts_targetId_idx" ON "alerts" USING btree ("targetId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "target_task_overrides_taskTemplateId_idx" ON "target_task_overrides" USING btree ("taskTemplateId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "targets_domain_idx" ON "targets" USING btree ("domain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "targets_subdomains_subdomain_idx" ON "targets_subdomains" USING btree ("subdomain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "targets_subdomains_targetId_idx" ON "targets_subdomains" USING btree ("targetId");