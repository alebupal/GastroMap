CREATE TABLE "place_occasions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_id" uuid NOT NULL,
	"occasion" varchar(50) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "place_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_id" uuid NOT NULL,
	"tag" varchar(50) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "places" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"address" text,
	"city" varchar(100),
	"latitude" double precision,
	"longitude" double precision,
	"google_maps_url" text,
	"price_range" varchar(10) DEFAULT '???' NOT NULL,
	"notes" text,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "place_occasions" ADD CONSTRAINT "place_occasions_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_tags" ADD CONSTRAINT "place_tags_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "place_occasions_place_idx" ON "place_occasions" USING btree ("place_id");--> statement-breakpoint
CREATE INDEX "place_occasions_occasion_idx" ON "place_occasions" USING btree ("occasion");--> statement-breakpoint
CREATE INDEX "place_tags_place_idx" ON "place_tags" USING btree ("place_id");--> statement-breakpoint
CREATE INDEX "place_tags_tag_idx" ON "place_tags" USING btree ("tag");--> statement-breakpoint
CREATE INDEX "places_created_by_idx" ON "places" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "places_coords_idx" ON "places" USING btree ("latitude","longitude");