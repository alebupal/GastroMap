import {
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  doublePrecision,
  boolean,
  jsonb,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: varchar("username", { length: 50 }).unique(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  role: varchar("role", { length: 50 }).notNull().default("user"), // 'admin' | 'user'
  status: varchar("status", { length: 20 }).notNull().default("active"), // 'active' | 'disabled'
  locale: varchar("locale", { length: 10 }).notNull().default("es"), // 'es' | 'en'
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const invitations = pgTable("invitations", {
  id: uuid("id").defaultRandom().primaryKey(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  email: varchar("email", { length: 255 }),
  role: varchar("role", { length: 50 }).notNull().default("user"),
  createdById: uuid("created_by_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const occasions = pgTable("occasions", {
  id: varchar("id", { length: 50 }).primaryKey(), // slug ej. 'tapear', 'comer'
  name: varchar("name", { length: 100 }).notNull(),
  icon: varchar("icon", { length: 50 }).notNull().default("🍽️"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const tags = pgTable("tags", {
  id: varchar("id", { length: 50 }).primaryKey(), // normalizado ej. 'italiana'
  name: varchar("name", { length: 50 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const places = pgTable(
  "places",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    address: text("address"),
    city: varchar("city", { length: 100 }),
    country: varchar("country", { length: 100 }),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    googleMapsUrl: text("google_maps_url"),
    priceRange: varchar("price_range", { length: 10 }).notNull().default("???"), // '€' | '€€' | '€€€' | '€€€€' | '???'
    notes: text("notes"),
    communityPublished: boolean("community_published").notNull().default(true),
    website: text("website"),
    phone: varchar("phone", { length: 50 }),
    createdById: uuid("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("places_created_by_idx").on(table.createdById),
    index("places_coords_idx").on(table.latitude, table.longitude),
  ]
);

export const placeOccasions = pgTable(
  "place_occasions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    occasion: varchar("occasion", { length: 50 }).notNull(),
  },
  (table) => [
    index("place_occasions_place_idx").on(table.placeId),
    index("place_occasions_occasion_idx").on(table.occasion),
  ]
);

export const placeTags = pgTable(
  "place_tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    tag: varchar("tag", { length: 50 }).notNull(),
  },
  (table) => [
    index("place_tags_place_idx").on(table.placeId),
    index("place_tags_tag_idx").on(table.tag),
  ]
);

export const appSettings = pgTable("app_settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: text("value"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const userPlaces = pgTable(
  "user_places",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    favorite: boolean("favorite").notNull().default(false),
    personalStatus: varchar("personal_status", { length: 20 }), // 'pending' | 'visited' | null
    rating: doublePrecision("rating"), // 0.0 - 10.0
    privateNotes: text("private_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("user_places_user_place_idx").on(table.userId, table.placeId),
    index("user_places_user_idx").on(table.userId),
    index("user_places_place_idx").on(table.placeId),
  ]
);

export const placeComments = pgTable(
  "place_comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("place_comments_place_idx").on(table.placeId),
    index("place_comments_user_idx").on(table.userId),
  ]
);

export const sharingGroups = pgTable("sharing_groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  ownerUserId: uuid("owner_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const sharingGroupMembers = pgTable(
  "sharing_group_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => sharingGroups.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("sharing_group_members_unique_idx").on(table.groupId, table.userId),
  ]
);

export const placeGroupAccess = pgTable(
  "place_group_access",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => sharingGroups.id, { onDelete: "cascade" }),
    grantedBy: uuid("granted_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("place_group_access_unique_idx").on(table.placeId, table.groupId),
    index("place_group_access_group_idx").on(table.groupId),
  ]
);

export const placeUserAccess = pgTable(
  "place_user_access",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    grantedBy: uuid("granted_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("place_user_access_unique_idx").on(table.placeId, table.userId),
    index("place_user_access_user_idx").on(table.userId),
  ]
);

export const savedFilters = pgTable(
  "saved_filters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    criteria: jsonb("criteria").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("saved_filters_user_idx").on(table.userId)]
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    entityId: varchar("entity_id", { length: 100 }).notNull(),
    action: varchar("action", { length: 50 }).notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("audit_logs_created_at_idx").on(table.createdAt)]
);

export const placeVisits = pgTable(
  "place_visits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    visitedAt: timestamp("visited_at", { withTimezone: true }).defaultNow().notNull(),
    rating: doublePrecision("rating"), // 0.0 - 10.0 opcional por visita
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("place_visits_place_idx").on(table.placeId),
    index("place_visits_user_idx").on(table.userId),
    index("place_visits_date_idx").on(table.visitedAt),
  ]
);

export const groupInvitations = pgTable(
  "group_invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => sharingGroups.id, { onDelete: "cascade" }),
    token: varchar("token", { length: 64 }).notNull().unique(),
    createdById: uuid("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedCount: integer("used_count").notNull().default(0),
    maxUses: integer("max_uses"), // null = ilimitado
    neverExpires: boolean("never_expires").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("group_invitations_token_idx").on(table.token),
    index("group_invitations_group_idx").on(table.groupId),
  ]
);

export const placeLists = pgTable(
  "place_lists",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    icon: varchar("icon", { length: 32 }).notNull().default("bookmark"),
    isPublic: boolean("is_public").notNull().default(false),
    shareSlug: varchar("share_slug", { length: 120 }).unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("place_lists_owner_idx").on(table.ownerId),
    uniqueIndex("place_lists_share_slug_idx").on(table.shareSlug),
  ]
);

export const placeListItems = pgTable(
  "place_list_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    listId: uuid("list_id")
      .notNull()
      .references(() => placeLists.id, { onDelete: "cascade" }),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("place_list_items_unique_idx").on(table.listId, table.placeId),
    index("place_list_items_list_idx").on(table.listId),
  ]
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type Invitation = typeof invitations.$inferSelect;
export type GroupInvitation = typeof groupInvitations.$inferSelect;
export type Occasion = typeof occasions.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type Place = typeof places.$inferSelect;
export type NewPlace = typeof places.$inferInsert;
export type PlaceOccasion = typeof placeOccasions.$inferSelect;
export type PlaceTag = typeof placeTags.$inferSelect;
export type AppSetting = typeof appSettings.$inferSelect;
export type UserPlace = typeof userPlaces.$inferSelect;
export type PlaceComment = typeof placeComments.$inferSelect;
export type SharingGroup = typeof sharingGroups.$inferSelect;
export type SharingGroupMember = typeof sharingGroupMembers.$inferSelect;
export type PlaceGroupAccess = typeof placeGroupAccess.$inferSelect;
export type PlaceUserAccess = typeof placeUserAccess.$inferSelect;
export type SavedFilter = typeof savedFilters.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type PlaceVisit = typeof placeVisits.$inferSelect;
export type PlaceList = typeof placeLists.$inferSelect;
export type PlaceListItem = typeof placeListItems.$inferSelect;
