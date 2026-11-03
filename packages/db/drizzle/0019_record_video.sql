ALTER TABLE "jobs" ADD COLUMN "record_video" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "video_path" text;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "video_cues" jsonb;