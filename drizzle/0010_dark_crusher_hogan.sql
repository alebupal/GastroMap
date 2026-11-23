ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "locale" varchar(10) DEFAULT 'es' NOT NULL;--> statement-breakpoint
ALTER TABLE "places" DROP COLUMN IF EXISTS "status";