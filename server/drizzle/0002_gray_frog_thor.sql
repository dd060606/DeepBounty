ALTER TABLE "task_templates" ADD COLUMN "uniqueKey" text NOT NULL;--> statement-breakpoint
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_unique_key" UNIQUE("moduleId","uniqueKey");