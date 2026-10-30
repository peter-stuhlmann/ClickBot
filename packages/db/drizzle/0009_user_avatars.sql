CREATE TABLE "user_avatars" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"content_type" text NOT NULL,
	"data" "bytea" NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "user_avatars_type" CHECK ("user_avatars"."content_type" in ('image/png', 'image/jpeg', 'image/webp')),
	CONSTRAINT "user_avatars_size" CHECK (octet_length("user_avatars"."data") <= 524288)
);
--> statement-breakpoint
ALTER TABLE "user_avatars" ADD CONSTRAINT "user_avatars_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;