ALTER TYPE "public"."step_status" ADD VALUE 'unclear' BEFORE 'failed';--> statement-breakpoint
ALTER TABLE "run_steps" ADD COLUMN "ai_verdict" jsonb;