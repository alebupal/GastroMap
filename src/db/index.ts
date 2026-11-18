import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ||
  "postgres://gastromap:gastromap_secret_change_me@localhost:5432/gastromap";

// En desarrollo usamos una única conexión global para no agotar el pool de Postgres en HMR
const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
};

const client = globalForDb.conn ?? postgres(connectionString);
if (process.env.NODE_ENV !== "production") globalForDb.conn = client;

export const db = drizzle(client, { schema });
