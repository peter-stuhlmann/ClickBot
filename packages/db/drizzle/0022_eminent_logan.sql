CREATE TABLE "ai_model_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" "ai_provider_kind" NOT NULL,
	"model" text NOT NULL,
	"input_per_million" double precision NOT NULL,
	"output_per_million" double precision NOT NULL,
	"cached_per_million" double precision,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_model_prices_model_unique" UNIQUE("provider","model"),
	CONSTRAINT "ai_model_prices_not_negative" CHECK ("ai_model_prices"."input_per_million" >= 0 AND "ai_model_prices"."output_per_million" >= 0 AND ("ai_model_prices"."cached_per_million" IS NULL OR "ai_model_prices"."cached_per_million" >= 0)),
	CONSTRAINT "ai_model_prices_model_filled" CHECK (length(btrim("ai_model_prices"."model")) > 0)
);
--> statement-breakpoint
CREATE TABLE "run_ai_usage" (
	"run_id" uuid PRIMARY KEY NOT NULL,
	"provider" "ai_provider_kind" NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer NOT NULL,
	"output_tokens" integer NOT NULL,
	"cached_tokens" integer NOT NULL,
	CONSTRAINT "run_ai_usage_not_negative" CHECK ("run_ai_usage"."input_tokens" >= 0 AND "run_ai_usage"."output_tokens" >= 0 AND "run_ai_usage"."cached_tokens" >= 0)
);
--> statement-breakpoint
ALTER TABLE "run_ai_usage" ADD CONSTRAINT "run_ai_usage_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;