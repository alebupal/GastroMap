import { migrate } from "drizzle-orm/postgres-js/migrator";
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
