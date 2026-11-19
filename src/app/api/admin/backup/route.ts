import { NextResponse } from "next/server";
import { getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { versionService } from "@/services/versionService";

export const dynamic = "force-dynamic";

// Tablas que no tiene sentido respaldar (sesiones activas)
const EXCLUDED = new Set(["sessions"]);

/**
 * Descarga un volcado JSON de la base de datos (solo administradores).
 * Incluye hashes de contraseña: trátalo como información sensible.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const tables: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};

  for (const value of Object.values(schema)) {
    if (!is(value, PgTable)) continue;
    const name = getTableName(value);
    if (EXCLUDED.has(name)) continue;
    const rows = await db.select().from(value);
    tables[name] = rows;
    counts[name] = rows.length;
  }

  await logAudit({
    actorUserId: user.id,
    entityType: "system",
    entityId: user.id,
    action: "backup_downloaded",
    metadata: counts,
  });

  const payload = {
    app: "GastroMap",
    version: versionService.getLocalVersion(),
    createdAt: new Date().toISOString(),
    counts,
    tables,
  };

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return new NextResponse(JSON.stringify(payload), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="gastromap-backup-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
