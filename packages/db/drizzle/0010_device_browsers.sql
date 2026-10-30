ALTER TABLE "jobs" ADD COLUMN "device_browsers" jsonb DEFAULT '{"desktop":["chromium"]}'::jsonb NOT NULL;--> statement-breakpoint
-- Every existing job keeps the runs it had: each device in the chosen browsers it can run in
-- (as runTargets did with one list for all devices), iPhone and iPad in Safari.
UPDATE "jobs" SET "device_browsers" = (
  SELECT jsonb_object_agg(d::text, CASE
    WHEN d IN ('iphone', 'ipad') THEN '["webkit"]'::jsonb
    ELSE COALESCE(
      (SELECT jsonb_agg(b::text ORDER BY array_position(ARRAY['chromium', 'firefox', 'webkit']::browser[], b))
         FROM unnest("jobs"."browsers") AS b
        WHERE d = 'desktop' OR b IN ('chromium', 'firefox')),
      '["chromium"]'::jsonb)
  END)
  FROM unnest("jobs"."devices") AS d
);--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_device_browsers_object" CHECK (jsonb_typeof("jobs"."device_browsers") = 'object');--> statement-breakpoint
ALTER TABLE "jobs" DROP CONSTRAINT "jobs_browsers_not_empty";--> statement-breakpoint
ALTER TABLE "jobs" DROP COLUMN "browsers";
