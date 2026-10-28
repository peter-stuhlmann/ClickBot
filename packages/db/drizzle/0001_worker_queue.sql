CREATE TABLE "worker_heartbeats" (
	"worker_id" text PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "runs_scheduled_start_unique" ON "runs" USING btree ("job_id","slot_index","bot_nr","device") WHERE "runs"."slot_index" IS NOT NULL;