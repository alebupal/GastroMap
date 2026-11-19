import { migrate } from "drizzle-orm/postgres-js/migrator";
import { sql } from "drizzle-orm";
import { db } from "./index";

let migrationPromise: Promise<void> | null = null;

/**
 * Aplica automáticamente las migraciones pendientes de Drizzle ORM
 * si aún no se han aplicado. Es idempotente y seguro ante concurrencia.
 */
export async function runMigrations(): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = (async () => {
      try {
        console.log("[DB] Comprobando y aplicando migraciones pendientes de Drizzle...");
        await migrate(db, { migrationsFolder: "./drizzle" });
        // Asegurar que columnas añadidas posteriormente existan en la tabla users
        try {
          await db.execute(
            sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS locale VARCHAR(10) DEFAULT 'es';`
          );
        } catch {
          // Ignorar si la tabla aún no existe
        }
        console.log("[DB] Migraciones aplicadas correctamente.");
      } catch (error) {
        console.error("[DB] Error al aplicar migraciones automáticas:", error);
        // Reseteamos la promesa para permitir reintentar en la próxima llamada
        migrationPromise = null;
        throw error;
      }
    })();
  }
  return migrationPromise;
}
