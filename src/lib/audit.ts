import { db } from "@/db";
import { auditLogs } from "@/db/schema";

export interface AuditEntryInput {
  actorUserId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  metadata?: Record<string, unknown> | null;
}

/**
 * Registra un evento inmutable en la tabla audit_logs.
 * Nunca lanza excepciones para no interrumpir la operación principal.
 */
export async function logAudit(entry: AuditEntryInput): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      actorUserId: entry.actorUserId ?? null,
      entityType: entry.entityType,
      entityId: entry.entityId,
      action: entry.action,
      metadata: entry.metadata ?? null,
    });
  } catch (err) {
    console.error("[Audit] Error registrando evento de auditoría:", err);
  }
}
