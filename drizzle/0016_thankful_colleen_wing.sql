CREATE TABLE "api_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope_key" varchar(80) NOT NULL,
	"provider" varchar(40) DEFAULT 'google_places' NOT NULL,
	"period" varchar(10) NOT NULL,
	"requests" integer DEFAULT 0 NOT NULL,
	"cache_hits" integer DEFAULT 0 NOT NULL,
	"blocked" integer DEFAULT 0 NOT NULL,
	"last_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_join_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"invitation_id" uuid,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"decided_by_id" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "places_api_cache" (
	"query_key" varchar(320) PRIMARY KEY NOT NULL,
	"google_place_id" varchar(255),
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "group_invitations" ADD COLUMN "revoked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "google_place_id" varchar(255);--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "maps_url_key" varchar(255);--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sharing_groups" ADD COLUMN "google_places_api_key_enc" text;--> statement-breakpoint
ALTER TABLE "sharing_groups" ADD COLUMN "places_api_monthly_quota" integer;--> statement-breakpoint
ALTER TABLE "sharing_groups" ADD COLUMN "require_join_approval" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "group_join_requests" ADD CONSTRAINT "group_join_requests_group_id_sharing_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."sharing_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_join_requests" ADD CONSTRAINT "group_join_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_join_requests" ADD CONSTRAINT "group_join_requests_invitation_id_group_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."group_invitations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_join_requests" ADD CONSTRAINT "group_join_requests_decided_by_id_users_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "api_usage_scope_provider_period_idx" ON "api_usage" USING btree ("scope_key","provider","period");--> statement-breakpoint
CREATE UNIQUE INDEX "group_join_requests_group_user_idx" ON "group_join_requests" USING btree ("group_id","user_id");--> statement-breakpoint
CREATE INDEX "group_join_requests_group_status_idx" ON "group_join_requests" USING btree ("group_id","status");--> statement-breakpoint
CREATE INDEX "places_api_cache_expires_idx" ON "places_api_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "places_google_place_id_idx" ON "places" USING btree ("google_place_id");--> statement-breakpoint
CREATE INDEX "places_maps_url_key_idx" ON "places" USING btree ("maps_url_key");--> statement-breakpoint
CREATE INDEX "places_deleted_at_idx" ON "places" USING btree ("deleted_at");