CREATE TABLE "targets_packages" (
	"id" serial PRIMARY KEY NOT NULL,
	"targetId" integer NOT NULL,
	"packageName" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "targets_packages" ADD CONSTRAINT "targets_packages_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "public"."targets"("id") ON DELETE cascade ON UPDATE no action;