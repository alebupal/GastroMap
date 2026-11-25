CREATE TABLE "place_list_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list_id" uuid NOT NULL,
	"place_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "place_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"icon" varchar(32) DEFAULT 'bookmark' NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"share_slug" varchar(120),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "place_lists_share_slug_unique" UNIQUE("share_slug")
);
--> statement-breakpoint
ALTER TABLE "place_list_items" ADD CONSTRAINT "place_list_items_list_id_place_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."place_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_list_items" ADD CONSTRAINT "place_list_items_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_lists" ADD CONSTRAINT "place_lists_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "place_list_items_unique_idx" ON "place_list_items" USING btree ("list_id","place_id");--> statement-breakpoint
CREATE INDEX "place_list_items_list_idx" ON "place_list_items" USING btree ("list_id");--> statement-breakpoint
CREATE INDEX "place_lists_owner_idx" ON "place_lists" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "place_lists_share_slug_idx" ON "place_lists" USING btree ("share_slug");