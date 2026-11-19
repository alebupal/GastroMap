ALTER TABLE "group_invitations" ADD COLUMN "max_uses" integer;--> statement-breakpoint
ALTER TABLE "group_invitations" ADD COLUMN "never_expires" boolean DEFAULT false NOT NULL;