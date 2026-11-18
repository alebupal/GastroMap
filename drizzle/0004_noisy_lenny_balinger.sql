CREATE TABLE "place_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sharing_group_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sharing_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_places" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"place_id" uuid NOT NULL,
	"favorite" boolean DEFAULT false NOT NULL,
	"personal_status" varchar(20),
	"rating" double precision,
	"private_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "community_published" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "website" text;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "phone" varchar(50);--> statement-breakpoint
ALTER TABLE "place_comments" ADD CONSTRAINT "place_comments_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_comments" ADD CONSTRAINT "place_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sharing_group_members" ADD CONSTRAINT "sharing_group_members_group_id_sharing_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."sharing_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sharing_group_members" ADD CONSTRAINT "sharing_group_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sharing_groups" ADD CONSTRAINT "sharing_groups_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_places" ADD CONSTRAINT "user_places_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_places" ADD CONSTRAINT "user_places_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "place_comments_place_idx" ON "place_comments" USING btree ("place_id");--> statement-breakpoint
CREATE INDEX "place_comments_user_idx" ON "place_comments" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sharing_group_members_unique_idx" ON "sharing_group_members" USING btree ("group_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_places_user_place_idx" ON "user_places" USING btree ("user_id","place_id");--> statement-breakpoint
CREATE INDEX "user_places_user_idx" ON "user_places" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_places_place_idx" ON "user_places" USING btree ("place_id");