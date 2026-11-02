ALTER TABLE "jobs" ADD COLUMN "wizard_state" jsonb;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_wizard_state_size" CHECK (octet_length("jobs"."wizard_state"::text) <= 262144);