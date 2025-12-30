CREATE TABLE "module_callbacks" (
	"id" serial PRIMARY KEY NOT NULL,
	"uuid" text NOT NULL,
	"moduleId" text NOT NULL,
	"name" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"allowMultipleTriggers" boolean DEFAULT true NOT NULL,
	"triggerCount" integer DEFAULT 0 NOT NULL,
	"lastTriggeredAt" timestamp,
	"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"expiresAt" timestamp,
	CONSTRAINT "module_callbacks_uuid_unique" UNIQUE("uuid")
);
