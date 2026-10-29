CREATE TYPE "public"."browser" AS ENUM('chromium', 'firefox', 'webkit');--> statement-breakpoint
DROP INDEX "runs_scheduled_start_unique";--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "browsers" "browser"[] DEFAULT ARRAY['chromium']::browser[] NOT NULL;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "browser" "browser" DEFAULT 'chromium' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "runs_scheduled_start_unique" ON "runs" USING btree ("job_id","slot_index","bot_nr","device","browser") WHERE "runs"."slot_index" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_browsers_not_empty" CHECK (cardinality("jobs"."browsers") > 0);