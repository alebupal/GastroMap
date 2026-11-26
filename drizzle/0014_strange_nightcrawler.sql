ALTER TABLE "occasions" ADD COLUMN IF NOT EXISTS "scope_key" varchar(80) DEFAULT 'global' NOT NULL;--> statement-breakpoint
ALTER TABLE "tags" ADD COLUMN IF NOT EXISTS "scope_key" varchar(80) DEFAULT 'global' NOT NULL;--> statement-breakpoint
ALTER TABLE "place_lists" ADD COLUMN IF NOT EXISTS "group_id" uuid;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN IF NOT EXISTS "group_id" uuid;--> statement-breakpoint
ALTER TABLE "saved_filters" ADD COLUMN IF NOT EXISTS "group_id" uuid;--> statement-breakpoint
ALTER TABLE "sharing_group_members" ADD COLUMN IF NOT EXISTS "role" varchar(20) DEFAULT 'member' NOT NULL;--> statement-breakpoint
ALTER TABLE "sharing_groups" ADD COLUMN IF NOT EXISTS "icon" varchar(50) DEFAULT '🍻' NOT NULL;--> statement-breakpoint
ALTER TABLE "sharing_groups" ADD COLUMN IF NOT EXISTS "description" text;--> statement-breakpoint
DO $$
DECLARE
  v_occ_pk text;
  v_tag_pk text;
BEGIN
  SELECT constraint_name INTO v_occ_pk
  FROM information_schema.table_constraints
  WHERE table_schema = 'public'
    AND table_name = 'occasions'
    AND constraint_type = 'PRIMARY KEY'
  LIMIT 1;

  IF v_occ_pk IS NOT NULL AND v_occ_pk <> 'occasions_scope_key_id_pk' THEN
    EXECUTE format('ALTER TABLE "occasions" DROP CONSTRAINT %I', v_occ_pk);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'occasions'
      AND constraint_name = 'occasions_scope_key_id_pk'
  ) THEN
    ALTER TABLE "occasions" ADD CONSTRAINT "occasions_scope_key_id_pk" PRIMARY KEY ("scope_key", "id");
  END IF;

  SELECT constraint_name INTO v_tag_pk
  FROM information_schema.table_constraints
  WHERE table_schema = 'public'
    AND table_name = 'tags'
    AND constraint_type = 'PRIMARY KEY'
  LIMIT 1;

  IF v_tag_pk IS NOT NULL AND v_tag_pk <> 'tags_scope_key_id_pk' THEN
    EXECUTE format('ALTER TABLE "tags" DROP CONSTRAINT %I', v_tag_pk);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'tags'
      AND constraint_name = 'tags_scope_key_id_pk'
  ) THEN
    ALTER TABLE "tags" ADD CONSTRAINT "tags_scope_key_id_pk" PRIMARY KEY ("scope_key", "id");
  END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND constraint_name = 'place_lists_group_id_sharing_groups_id_fk'
  ) THEN
    ALTER TABLE "place_lists" ADD CONSTRAINT "place_lists_group_id_sharing_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."sharing_groups"("id") ON DELETE cascade ON UPDATE no action;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND constraint_name = 'places_group_id_sharing_groups_id_fk'
  ) THEN
    ALTER TABLE "places" ADD CONSTRAINT "places_group_id_sharing_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."sharing_groups"("id") ON DELETE cascade ON UPDATE no action;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND constraint_name = 'saved_filters_group_id_sharing_groups_id_fk'
  ) THEN
    ALTER TABLE "saved_filters" ADD CONSTRAINT "saved_filters_group_id_sharing_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."sharing_groups"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "occasions_scope_idx" ON "occasions" USING btree ("scope_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "place_lists_group_idx" ON "place_lists" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "places_group_idx" ON "places" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saved_filters_group_idx" ON "saved_filters" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tags_scope_idx" ON "tags" USING btree ("scope_key");--> statement-breakpoint
DO $$
DECLARE
  v_owner_id uuid;
  v_pinono_id uuid;
BEGIN
  -- Asegurar que el creador de cualquier grupo previo conste como admin en sharing_group_members
  INSERT INTO "sharing_group_members" ("id", "group_id", "user_id", "role")
  SELECT gen_random_uuid(), g."id", g."owner_user_id", 'admin'
  FROM "sharing_groups" g
  ON CONFLICT ("group_id", "user_id") DO UPDATE SET "role" = 'admin';

  -- Si ya existen usuarios en la instancia (migración desde v1), crear el grupo «Pinono» y migrar todo allí
  SELECT "id" INTO v_owner_id
  FROM "users"
  ORDER BY CASE WHEN "role" = 'admin' THEN 0 ELSE 1 END, "created_at" ASC
  LIMIT 1;

  IF v_owner_id IS NOT NULL THEN
    SELECT "id" INTO v_pinono_id
    FROM "sharing_groups"
    WHERE lower("name") = 'pinono'
    LIMIT 1;

    IF v_pinono_id IS NULL THEN
      INSERT INTO "sharing_groups" ("id", "name", "icon", "description", "owner_user_id")
      VALUES (gen_random_uuid(), 'Pinono', '🍻', 'Grupo gastronómico Pinono', v_owner_id)
      RETURNING "id" INTO v_pinono_id;
    END IF;

    -- Incorporar todos los usuarios actuales al grupo Pinono (admins globales como admins del grupo)
    INSERT INTO "sharing_group_members" ("id", "group_id", "user_id", "role")
    SELECT
      gen_random_uuid(),
      v_pinono_id,
      u."id",
      CASE WHEN u."role" = 'admin' THEN 'admin' ELSE 'member' END
    FROM "users" u
    ON CONFLICT ("group_id", "user_id") DO UPDATE
    SET "role" = CASE
      WHEN EXCLUDED."role" = 'admin' THEN 'admin'
      ELSE "sharing_group_members"."role"
    END;

    -- Migrar todos los establecimientos, listas y filtros guardados existentes a Pinono
    UPDATE "places"
    SET "group_id" = v_pinono_id
    WHERE "group_id" IS NULL;

    UPDATE "place_lists"
    SET "group_id" = v_pinono_id
    WHERE "group_id" IS NULL;

    UPDATE "saved_filters"
    SET "group_id" = v_pinono_id
    WHERE "group_id" IS NULL;

    -- Migrar taxonomías existentes al ámbito de Pinono
    UPDATE "occasions"
    SET "scope_key" = 'group:' || v_pinono_id::text
    WHERE "scope_key" = 'global';

    UPDATE "tags"
    SET "scope_key" = 'group:' || v_pinono_id::text
    WHERE "scope_key" = 'global';
  END IF;
END $$;--> statement-breakpoint
INSERT INTO "app_settings" ("key", "value")
VALUES ('allow_public_registration', 'true')
ON CONFLICT ("key") DO NOTHING;
