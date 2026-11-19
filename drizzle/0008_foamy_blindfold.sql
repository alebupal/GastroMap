CREATE TABLE "group_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"token" varchar(64) NOT NULL,
	"created_by_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "group_invitations" ADD CONSTRAINT "group_invitations_group_id_sharing_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."sharing_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_invitations" ADD CONSTRAINT "group_invitations_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "group_invitations_token_idx" ON "group_invitations" USING btree ("token");--> statement-breakpoint
CREATE INDEX "group_invitations_group_idx" ON "group_invitations" USING btree ("group_id");