import { NextRequest, NextResponse } from "next/server";
import { eq, ne, getTableName, getTableColumns, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { normalizeMapsUrlKey } from "@/lib/place-identity";
import { versionService } from "@/services/versionService";
import { importPlacesAction, type ImportPlacePayload } from "@/lib/actions/export-import";

export const dynamic = "force-dynamic";

// Tablas que no tiene sentido respaldar (sesiones activas)
const EXCLUDED = new Set(["sessions"]);

function sanitizeRow(
  row: Record<string, unknown>,
  allowedCols?: Set<string>
): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (allowedCols && !allowedCols.has(k)) continue;
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v)) {
      clean[k] = new Date(v);
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

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

/**
 * Restaura una copia de seguridad completa o importa un archivo JSON de establecimientos.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let payload: any;
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json(
        { error: "No se proporcionó ningún archivo de copia de seguridad." },
        { status: 400 }
      );
    }
    const text = await file.text();
    try {
      payload = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: "El archivo no contiene un formato JSON válido." },
        { status: 400 }
      );
    }
  } else {
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Cuerpo de solicitud JSON no válido." },
        { status: 400 }
      );
    }
  }

  if (!payload || typeof payload !== "object") {
    return NextResponse.json(
      { error: "El formato de los datos de copia de seguridad no es válido." },
      { status: 400 }
    );
  }

  // Caso 1: Archivo de importación simple de establecimientos (array o { places: [...] })
  if (!payload.tables && (Array.isArray(payload) || Array.isArray(payload.places))) {
    const items = (Array.isArray(payload) ? payload : payload.places) as ImportPlacePayload[];
    const res = await importPlacesAction(items, true);
    if (res.error) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }
    return NextResponse.json({
      success: true,
      message: `Importados ${res.importedCount || 0} establecimientos correctamente.`,
      importedCount: res.importedCount,
    });
  }

  // Caso 2: Copia de seguridad completa de base de datos GastroMap
  if (!payload.tables || typeof payload.tables !== "object") {
    return NextResponse.json(
      { error: "El archivo JSON no contiene tablas de base de datos reconocidas." },
      { status: 400 }
    );
  }

  const tableMap: Record<string, PgTable> = {};
  for (const value of Object.values(schema)) {
    if (is(value, PgTable)) {
      const name = getTableName(value);
      tableMap[name] = value;
    }
  }

  const INSERT_ORDER = [
    "app_settings",
    "users",
    "occasions",
    "tags",
    "invitations",
    "sharing_groups",
    "places",
    "place_lists",
    "place_list_items",
    "group_invitations",
    "group_join_requests",
    "sharing_group_members",
    "place_occasions",
    "place_tags",
    "user_places",
    "place_comments",
    "saved_filters",
    "audit_logs",
    "api_usage",
    "places_api_cache",
  ];

  // Incluir también cualquier tabla presente en el esquema actual que no esté en el backup
  // para asegurar que se vacíe antes de restaurar (evitando FKs colgantes)
  for (const tName of Object.keys(tableMap)) {
    if (!INSERT_ORDER.includes(tName) && !EXCLUDED.has(tName)) {
      INSERT_ORDER.push(tName);
    }
  }
  for (const tName of Object.keys(payload.tables)) {
    if (!INSERT_ORDER.includes(tName) && !EXCLUDED.has(tName)) {
      INSERT_ORDER.push(tName);
    }
  }

  const restoredCounts: Record<string, number> = {};
  let finalActorUserId = user.id;

  try {
    await db.transaction(async (tx) => {
      // 1. Borrado de tablas en orden inverso respetando integridad referencial
      const deleteOrder = [...INSERT_ORDER].reverse();
      for (const tableName of deleteOrder) {
        if (tableName === "users") {
          // Mantener temporalmente la cuenta del administrador actual para no invalidar la sesión en curso
          await tx.delete(schema.users).where(ne(schema.users.id, user.id));
        } else if (tableMap[tableName]) {
          await tx.delete(tableMap[tableName]);
        }
      }

      // 2. Inserción de filas en orden de dependencias
      for (const tableName of INSERT_ORDER) {
        const rows = payload.tables[tableName];
        const table = tableMap[tableName];
        if (Array.isArray(rows) && rows.length > 0 && table) {
          const allowedCols = new Set(Object.keys(getTableColumns(table)));
          let rowsToInsert = rows.map((r) => {
            const clean = sanitizeRow(r as Record<string, unknown>, allowedCols);
            if (
              tableName === "places" &&
              typeof clean.googleMapsUrl === "string" &&
              !clean.mapsUrlKey
            ) {
              clean.mapsUrlKey = normalizeMapsUrlKey(clean.googleMapsUrl);
            }
            return clean;
          });

          if (tableName === "users") {
            const currentAdminById = rowsToInsert.find((r) => r.id === user.id);
            const normalizedCurrentEmail = user.email.trim().toLowerCase();
            const normalizedCurrentUsername = user.username?.trim().toLowerCase() || null;

            const conflictingBackupUser = !currentAdminById
              ? rowsToInsert.find((r) => {
                  const rowEmail = typeof r.email === "string" ? r.email.trim().toLowerCase() : "";
                  const rowUsername =
                    typeof r.username === "string" ? r.username.trim().toLowerCase() : null;
                  return (
                    rowEmail === normalizedCurrentEmail ||
                    (normalizedCurrentUsername && rowUsername === normalizedCurrentUsername)
                  );
                })
              : null;

            if (currentAdminById) {
              // Mismo UUID: actualizamos la fila del admin actual con los datos del backup
              await tx
                .update(schema.users)
                .set(currentAdminById)
                .where(eq(schema.users.id, user.id));
              rowsToInsert = rowsToInsert.filter((r) => r.id !== user.id);
            } else if (conflictingBackupUser && typeof conflictingBackupUser.id === "string") {
              // El mismo email/username existe en el backup con un UUID distinto (ej. tras reinstalar o /setup):
              // 1) Liberamos temporalmente las constraints únicas del admin actual
              await tx
                .update(schema.users)
                .set({
                  email: `__restore_tmp_${user.id}@local.invalid`,
                  username: `__rtmp_${user.id.replace(/-/g, "").slice(0, 16)}`,
                })
                .where(eq(schema.users.id, user.id));

              // 2) Insertamos todos los usuarios del backup con sus UUIDs originales intactos
              const chunkSize = 100;
              for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
                const chunk = rowsToInsert.slice(i, i + chunkSize);
                await tx.insert(table).values(chunk as any);
              }

              // 3) Reasignamos las sesiones activas al UUID restaurado y eliminamos la cuenta temporal
              const restoredAdminId = conflictingBackupUser.id;
              await tx
                .update(schema.sessions)
                .set({ userId: restoredAdminId })
                .where(eq(schema.sessions.userId, user.id));
              await tx.delete(schema.users).where(eq(schema.users.id, user.id));
              finalActorUserId = restoredAdminId;
              rowsToInsert = [];
            }
          }

          if (rowsToInsert.length > 0) {
            const chunkSize = 100;
            for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
              const chunk = rowsToInsert.slice(i, i + chunkSize);
              await tx.insert(table).values(chunk as any);
            }
          }
          restoredCounts[tableName] = rows.length;
        }
      }
    });

    await logAudit({
      actorUserId: finalActorUserId,
      entityType: "system",
      entityId: finalActorUserId,
      action: "backup_restored",
      metadata: restoredCounts,
    });

    return NextResponse.json({
      success: true,
      message: "Base de datos restaurada correctamente.",
      restoredCounts,
    });
  } catch (err: any) {
    console.error("Error al restaurar backup:", err);
    return NextResponse.json(
      { error: `Error al restaurar la base de datos: ${err.message || String(err)}` },
      { status: 500 }
    );
  }
}
