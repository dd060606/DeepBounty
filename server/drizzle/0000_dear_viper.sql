CREATE TABLE "alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"targetId" integer NOT NULL,
	"name" text NOT NULL,
	"subdomain" text NOT NULL,
	"score" smallint NOT NULL,
	"confirmed" boolean NOT NULL,
	"description" text NOT NULL,
	"endpoint" text NOT NULL,
	"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modules_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"moduleId" text NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	CONSTRAINT "modules_configs_unique_module_key" UNIQUE("moduleId","key")
);
--> statement-breakpoint
CREATE TABLE "targets" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"domain" text NOT NULL,
	"activeScan" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "targets_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"targetId" integer NOT NULL,
	"settings" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "targets_subdomains" (
	"id" serial PRIMARY KEY NOT NULL,
	"targetId" integer NOT NULL,
	"subdomain" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "public"."targets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "targets_settings" ADD CONSTRAINT "targets_settings_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "public"."targets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "targets_subdomains" ADD CONSTRAINT "targets_subdomains_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "public"."targets"("id") ON DELETE cascade ON UPDATE no action;