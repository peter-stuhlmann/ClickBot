CREATE TYPE "public"."device" AS ENUM('desktop', 'iphone', 'android', 'ipad');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('draft', 'active', 'paused', 'finished');--> statement-breakpoint
CREATE TYPE "public"."proxy_kind" AS ENUM('datacenter', 'residential');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('queued', 'running', 'passed', 'warning', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."step_status" AS ENUM('passed', 'healed', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'member');--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo_url" text,
	"weekly_report" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_slug_format" CHECK ("customers"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"name" text NOT NULL,
	"start_url" text NOT NULL,
	"flow" jsonb NOT NULL,
	"schedule" jsonb NOT NULL,
	"devices" "device"[] DEFAULT ARRAY['desktop']::device[] NOT NULL,
	"status" "job_status" DEFAULT 'draft' NOT NULL,
	"run_counter" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jobs_devices_not_empty" CHECK (cardinality("jobs"."devices") > 0)
);
--> statement-breakpoint
CREATE TABLE "location_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"country" char(2) NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"locale" text NOT NULL,
	"timezone" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "location_profiles_country_upper" CHECK ("location_profiles"."country" ~ '^[A-Z]{2}$'),
	CONSTRAINT "location_profiles_latitude" CHECK ("location_profiles"."latitude" BETWEEN -90 AND 90),
	CONSTRAINT "location_profiles_longitude" CHECK ("location_profiles"."longitude" BETWEEN -180 AND 180)
);
--> statement-breakpoint
CREATE TABLE "proxies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"country" char(2) NOT NULL,
	"city" text,
	"kind" "proxy_kind" NOT NULL,
	"url_enc" text NOT NULL,
	"last_checked_at" timestamp with time zone,
	"last_check_ip" text,
	"last_check_country" char(2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proxies_country_upper" CHECK ("proxies"."country" ~ '^[A-Z]{2}$')
);
--> statement-breakpoint
CREATE TABLE "run_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"step_index" integer NOT NULL,
	"step_id" text NOT NULL,
	"status" "step_status" NOT NULL,
	"duration_ms" integer NOT NULL,
	"message" text,
	"screenshot_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "run_steps_duration_positive" CHECK ("run_steps"."duration_ms" >= 0)
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"run_nr" integer NOT NULL,
	"slot_index" integer,
	"bot_nr" integer DEFAULT 1 NOT NULL,
	"device" "device" NOT NULL,
	"location_profile_id" uuid,
	"proxy_id" uuid,
	"status" "run_status" DEFAULT 'queued' NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "runs_bot_nr_positive" CHECK ("runs"."bot_nr" > 0),
	CONSTRAINT "runs_finished_after_start" CHECK ("runs"."finished_at" IS NULL OR "runs"."started_at" IS NULL OR "runs"."finished_at" >= "runs"."started_at")
);
--> statement-breakpoint
CREATE TABLE "secrets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid,
	"name" text NOT NULL,
	"value_enc" text NOT NULL,
	"allowed_domains" text[] NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "secrets_customer_name_unique" UNIQUE NULLS NOT DISTINCT("customer_id","name"),
	CONSTRAINT "secrets_name_format" CHECK ("secrets"."name" ~ '^[a-z0-9]+([-_][a-z0-9]+)*$'),
	CONSTRAINT "secrets_domains_not_empty" CHECK (cardinality("secrets"."allowed_domains") > 0)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"totp_secret_enc" text,
	"role" "user_role" DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_steps" ADD CONSTRAINT "run_steps_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_location_profile_id_location_profiles_id_fk" FOREIGN KEY ("location_profile_id") REFERENCES "public"."location_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_proxy_id_proxies_id_fk" FOREIGN KEY ("proxy_id") REFERENCES "public"."proxies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secrets" ADD CONSTRAINT "secrets_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "customers_slug_unique" ON "customers" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "jobs_customer_idx" ON "jobs" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "location_profiles_name_unique" ON "location_profiles" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "proxies_name_unique" ON "proxies" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "run_steps_run_step_unique" ON "run_steps" USING btree ("run_id","step_index");--> statement-breakpoint
CREATE UNIQUE INDEX "runs_job_run_nr_unique" ON "runs" USING btree ("job_id","run_nr");--> statement-breakpoint
CREATE INDEX "runs_status_scheduled_idx" ON "runs" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree (lower("email"));