"use server";

import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

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
