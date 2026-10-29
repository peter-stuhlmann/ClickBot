CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"name" text NOT NULL,
	"starts_on" date,
	"ends_on" date,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaigns_id_customer_unique" UNIQUE("id","customer_id"),
	CONSTRAINT "campaigns_period" CHECK ("campaigns"."ends_on" IS NULL OR "campaigns"."starts_on" IS NULL OR "campaigns"."ends_on" >= "campaigns"."starts_on")
);
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "campaign_id" uuid;--> statement-breakpoint
-- Every existing project gets the campaign "Allgemein"; its jobs move there.
INSERT INTO "campaigns" ("customer_id", "name") SELECT "id", 'Allgemein' FROM "customers";--> statement-breakpoint
UPDATE "jobs" SET "campaign_id" = "campaigns"."id" FROM "campaigns" WHERE "campaigns"."customer_id" = "jobs"."customer_id" AND "campaigns"."name" = 'Allgemein';--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "campaign_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "campaigns_customer_name_unique" ON "campaigns" USING btree ("customer_id",lower("name"));--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_campaign_fk" FOREIGN KEY ("campaign_id","customer_id") REFERENCES "public"."campaigns"("id","customer_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "jobs_campaign_idx" ON "jobs" USING btree ("campaign_id");