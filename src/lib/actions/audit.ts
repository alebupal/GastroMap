"use server";

import { desc, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export interface AuditLogRow {
  id: string;
  actorUserId: string | null;
  actorName: string;
  actorUsername: string | null;
  entityType: string;
  entityId: string;
  action: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export async function getAuditLogsAction(limit = 200): Promise<AuditLogRow[]> {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") {
    return [];
  }

  const rows = await db
    .select({
      id: auditLogs.id,
      actorUserId: auditLogs.actorUserId,
      actorName: users.name,
      actorUsername: users.username,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      action: auditLogs.action,
      metadata: auditLogs.metadata,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorUserId, users.id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    actorUserId: r.actorUserId,
    actorName: r.actorName || "Sistema",
    actorUsername: r.actorUsername || null,
    entityType: r.entityType,
    entityId: r.entityId,
    action: r.action,
    metadata: (r.metadata as Record<string, unknown> | null) ?? null,
    createdAt: r.createdAt,
  }));
}

/**
 * Purga registros antiguos de auditoría (solo administradores).
 * Si `olderThanDays === "all"` vacía todo el historial; si es un número, elimina los anteriores a N días.
 */
export async function purgeAuditLogsAction(
  olderThanDays: number | "all"
): Promise<{ success?: boolean; deletedCount?: number; error?: string }> {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") {
    return { error: "No autorizado." };
  }

  let deletedRows: Array<{ id: string }> = [];

  if (olderThanDays === "all") {
    deletedRows = await db
      .delete(auditLogs)
      .returning({ id: auditLogs.id });
  } else {
    const days = Math.max(1, Math.floor(olderThanDays));
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    deletedRows = await db
      .delete(auditLogs)
      .where(lt(auditLogs.createdAt, cutoff))
      .returning({ id: auditLogs.id });
  }

  if (deletedRows.length > 0) {
    await logAudit({
      actorUserId: currentUser.id,
      entityType: "system",
      entityId: "audit_logs",
      action: "audit_purged",
      metadata: {
        scope: olderThanDays === "all" ? "all" : `>${olderThanDays}d`,
        deletedCount: deletedRows.length,
      },
    });
  }

  return { success: true, deletedCount: deletedRows.length };
}
