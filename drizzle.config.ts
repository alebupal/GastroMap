import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  tablesFilter: ["!spatial_ref_sys"],
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgres://gastromap:gastromap_secret_change_me@localhost:5432/gastromap",
  },
});
