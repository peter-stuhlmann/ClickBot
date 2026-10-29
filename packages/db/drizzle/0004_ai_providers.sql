CREATE TYPE "public"."ai_provider_kind" AS ENUM('gemini', 'openai', 'perplexity', 'anthropic', 'custom');--> statement-breakpoint
CREATE TABLE "ai_providers" (
	"kind" "ai_provider_kind" PRIMARY KEY NOT NULL,
	"model" text NOT NULL,
	"base_url" text,
	"api_key_enc" text,
	"api_key_hint" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_providers_base_url" CHECK (("ai_providers"."kind" = 'custom') = ("ai_providers"."base_url" IS NOT NULL)),
	CONSTRAINT "ai_providers_key" CHECK ("ai_providers"."kind" = 'custom' OR ("ai_providers"."api_key_enc" IS NOT NULL AND "ai_providers"."api_key_hint" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ai_providers_one_default" ON "ai_providers" USING btree ("is_default") WHERE "ai_providers"."is_default";