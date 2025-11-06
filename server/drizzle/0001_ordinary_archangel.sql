CREATE TABLE "target_task_overrides" (
	"id" serial PRIMARY KEY NOT NULL,
	"targetId" integer NOT NULL,
	"taskTemplateId" integer NOT NULL,
	"active" boolean NOT NULL,
	"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "target_task_overrides_unique" UNIQUE("targetId","taskTemplateId")
);
--> statement-breakpoint
CREATE TABLE "task_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"moduleId" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"content" jsonb NOT NULL,
	"interval" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "target_task_overrides" ADD CONSTRAINT "target_task_overrides_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "public"."targets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "target_task_overrides" ADD CONSTRAINT "target_task_overrides_taskTemplateId_fkey" FOREIGN KEY ("taskTemplateId") REFERENCES "public"."task_templates"("id") ON DELETE cascade ON UPDATE no action;