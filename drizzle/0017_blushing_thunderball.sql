ALTER TABLE "place_lists" ADD COLUMN "is_auto" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "place_lists" ADD COLUMN "filter_criteria" jsonb;