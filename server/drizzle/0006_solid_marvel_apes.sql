ALTER TABLE "alerts" DROP CONSTRAINT "alerts_targetId_fkey";
--> statement-breakpoint
ALTER TABLE "alerts" ALTER COLUMN "targetId" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "public"."targets"("id") ON DELETE set null ON UPDATE no action;