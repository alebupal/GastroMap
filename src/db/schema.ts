import {
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  doublePrecision,
  index,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  role: varchar("role", { length: 50 }).notNull().default("user"), // 'admin' | 'user'
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
  icon: varchar("icon", { length: 20 }).notNull().default("🍽️"),
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
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    googleMapsUrl: text("google_maps_url"),
    priceRange: varchar("price_range", { length: 10 }).notNull().default("???"), // '€' | '€€' | '€€€' | '€€€€' | '???'
    notes: text("notes"),
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

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type Invitation = typeof invitations.$inferSelect;
export type Occasion = typeof occasions.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type Place = typeof places.$inferSelect;
export type NewPlace = typeof places.$inferInsert;
export type PlaceOccasion = typeof placeOccasions.$inferSelect;
export type PlaceTag = typeof placeTags.$inferSelect;
