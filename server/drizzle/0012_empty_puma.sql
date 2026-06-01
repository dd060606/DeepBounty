CREATE TABLE "event_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"eventType" text NOT NULL,
	"windowStart" timestamp NOT NULL,
	"windowEnd" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"avgHandlerMs" integer DEFAULT 0 NOT NULL,
	"maxHandlerMs" integer DEFAULT 0 NOT NULL,
	"errors" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_executions" (
	"id" serial PRIMARY KEY NOT NULL,
	"templateId" integer,
	"moduleId" text,
	"targetId" integer,
	"workerId" integer,
	"status" text NOT NULL,
	"success" boolean NOT NULL,
	"queuedAt" timestamp,
	"startedAt" timestamp,
	"completedAt" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"queueWaitMs" integer,
	"totalMs" integer,
	"durationMs" integer
);
--> statement-breakpoint
CREATE INDEX "event_metrics_windowEnd_idx" ON "event_metrics" USING btree ("windowEnd");--> statement-breakpoint
CREATE INDEX "task_executions_templateId_idx" ON "task_executions" USING btree ("templateId");--> statement-breakpoint
CREATE INDEX "task_executions_completedAt_idx" ON "task_executions" USING btree ("completedAt");