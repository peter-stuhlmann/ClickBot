ALTER TABLE "jobs" ADD COLUMN "block_ads" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "ads_blocked" boolean;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "blocked_ad_requests" integer;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_blocked_ad_requests_not_negative" CHECK ("runs"."blocked_ad_requests" is null or "runs"."blocked_ad_requests" >= 0);