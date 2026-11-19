"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, ne, or, gt, desc } from "drizzle-orm";
import { randomBytes } from "crypto";
import { db } from "@/db";
import {
  sharingGroups,
  sharingGroupMembers,
  groupInvitations,
  placeGroupAccess,
  users,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export interface GroupMemberInfo {
  userId: string;
  name: string;
  username: string | null;
}

export interface SharingGroupWithMembers {
  id: string;
  name: string;
  ownerUserId: string;
  ownerName: string;
  ownerUsername: string | null;
  isOwner: boolean;
  members: GroupMemberInfo[];
  createdAt: Date;
}

export interface SimpleUserOption {
  id: string;
  name: string;
  username: string | null;
}

/**
 * Devuelve todos los grupos donde el usuario actual es propietario o miembro.
 */
export async function getMyGroupsAction(): Promise<SharingGroupWithMembers[]> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return [];

  // Grupos donde el usuario es miembro
  const memberRows = await db
    .select({ groupId: sharingGroupMembers.groupId })
    .from(sharingGroupMembers)
    .where(eq(sharingGroupMembers.userId, currentUser.id));

  const memberGroupIds = memberRows.map((r) => r.groupId);

  const groupsList = await db
    .select({
      id: sharingGroups.id,
      name: sharingGroups.name,
      ownerUserId: sharingGroups.ownerUserId,
      createdAt: sharingGroups.createdAt,
      ownerName: users.name,
      ownerUsername: users.username,
    })
    .from(sharingGroups)
    .innerJoin(users, eq(sharingGroups.ownerUserId, users.id))
    .where(
      memberGroupIds.length > 0
        ? or(
            eq(sharingGroups.ownerUserId, currentUser.id),
            inArray(sharingGroups.id, memberGroupIds)
          )
        : eq(sharingGroups.ownerUserId, currentUser.id)
    )
    .orderBy(sharingGroups.name);

  if (groupsList.length === 0) return [];

  const groupIds = groupsList.map((g) => g.id);
  const allMembers = await db
    .select({
      groupId: sharingGroupMembers.groupId,
      userId: users.id,
      name: users.name,
      username: users.username,
    })
    .from(sharingGroupMembers)
    .innerJoin(users, eq(sharingGroupMembers.userId, users.id))
    .where(inArray(sharingGroupMembers.groupId, groupIds));

  const membersByGroup = new Map<string, GroupMemberInfo[]>();
  for (const m of allMembers) {
    const arr = membersByGroup.get(m.groupId) || [];
    arr.push({ userId: m.userId, name: m.name, username: m.username });
    membersByGroup.set(m.groupId, arr);
  }

  return groupsList.map((g) => ({
    id: g.id,
    name: g.name,
    ownerUserId: g.ownerUserId,
    ownerName: g.ownerName,
    ownerUsername: g.ownerUsername,
    isOwner: g.ownerUserId === currentUser.id,
    members: membersByGroup.get(g.id) || [],
    createdAt: g.createdAt,
  }));
}

/**
 * Devuelve lista ligera de usuarios activos para añadir a grupos o compartir fichas.
 */
export async function getActiveUsersForSharingAction(): Promise<SimpleUserOption[]> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return [];

  return db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
    })
    .from(users)
    .where(and(eq(users.status, "active"), ne(users.id, currentUser.id)))
    .orderBy(users.name);
}

/**
 * Crea un nuevo grupo privado de compartición (el creador es su propietario y primer miembro).
 */
export async function createGroupAction(
  name: string
): Promise<{ success?: boolean; groupId?: string; error?: string }> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "No autenticado." };

  const clean = name.trim();
  if (clean.length < 2) {
    return { error: "El nombre del grupo debe tener al menos 2 caracteres." };
  }

  const [created] = await db
    .insert(sharingGroups)
    .values({
      name: clean.slice(0, 100),
      ownerUserId: currentUser.id,
    })
    .returning();

  await db
    .insert(sharingGroupMembers)
    .values({
      groupId: created.id,
      userId: currentUser.id,
    })
    .onConflictDoNothing();

  await logAudit({
    actorUserId: currentUser.id,
    entityType: "group",
    entityId: created.id,
    action: "group_created",
    metadata: { name: created.name },
  });

  revalidatePath("/");
  return { success: true, groupId: created.id };
}

/**
 * Renombra un grupo (solo el propietario).
 */
export async function renameGroupAction(
  groupId: string,
  newName: string
): Promise<{ success?: boolean; error?: string }> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "No autenticado." };

  const clean = newName.trim();
  if (clean.length < 2) {
    return { error: "El nombre del grupo debe tener al menos 2 caracteres." };
  }

  const [group] = await db
    .select()
    .from(sharingGroups)
    .where(eq(sharingGroups.id, groupId))
    .limit(1);

  if (!group) return { error: "Grupo no encontrado." };
  if (group.ownerUserId !== currentUser.id) {
    return { error: "Solo el creador del grupo puede renombrarlo." };
  }

  await db
    .update(sharingGroups)
    .set({ name: clean.slice(0, 100), updatedAt: new Date() })
    .where(eq(sharingGroups.id, groupId));

  revalidatePath("/");
  return { success: true };
}

/**
 * Añade un miembro a un grupo (solo el propietario).
 */
export async function addGroupMemberAction(
  groupId: string,
  targetUserId: string
): Promise<{ success?: boolean; error?: string }> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "No autenticado." };

  const [group] = await db
    .select()
    .from(sharingGroups)
    .where(eq(sharingGroups.id, groupId))
    .limit(1);

  if (!group) return { error: "Grupo no encontrado." };
  if (group.ownerUserId !== currentUser.id) {
    return { error: "Solo el creador del grupo puede añadir miembros." };
  }

  await db
    .insert(sharingGroupMembers)
    .values({ groupId, userId: targetUserId })
    .onConflictDoNothing();

  revalidatePath("/");
  return { success: true };
}

/**
 * Expulsa a un miembro (propietario) o abandona el grupo voluntariamente (miembro).
 */
export async function removeGroupMemberAction(
  groupId: string,
  targetUserId: string
): Promise<{ success?: boolean; error?: string }> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "No autenticado." };

  const [group] = await db
    .select()
    .from(sharingGroups)
    .where(eq(sharingGroups.id, groupId))
    .limit(1);

  if (!group) return { error: "Grupo no encontrado." };

  const isOwner = group.ownerUserId === currentUser.id;
  const isSelfLeaving = targetUserId === currentUser.id && !isOwner;

  if (!isOwner && !isSelfLeaving) {
    return { error: "No tienes permiso para modificar los miembros de este grupo." };
  }

  if (targetUserId === group.ownerUserId) {
    return { error: "El propietario no puede abandonarse a sí mismo; elimina el grupo si ya no lo necesitas." };
  }

  await db
    .delete(sharingGroupMembers)
    .where(
      and(
        eq(sharingGroupMembers.groupId, groupId),
        eq(sharingGroupMembers.userId, targetUserId)
      )
    );

  revalidatePath("/");
  return { success: true };
}

/**
 * Elimina un grupo privado y sus accesos asociados (solo el propietario).
 */
export async function deleteGroupAction(
  groupId: string
): Promise<{ success?: boolean; error?: string }> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "No autenticado." };

  const [group] = await db
    .select()
    .from(sharingGroups)
    .where(eq(sharingGroups.id, groupId))
    .limit(1);

  if (!group) return { error: "Grupo no encontrado." };
  if (group.ownerUserId !== currentUser.id) {
    return { error: "Solo el creador del grupo puede eliminarlo." };
  }

  await db.delete(placeGroupAccess).where(eq(placeGroupAccess.groupId, groupId));
  await db.delete(sharingGroupMembers).where(eq(sharingGroupMembers.groupId, groupId));
  await db.delete(sharingGroups).where(eq(sharingGroups.id, groupId));

  await logAudit({
    actorUserId: currentUser.id,
    entityType: "group",
    entityId: groupId,
    action: "group_deleted",
    metadata: { name: group.name },
  });

  revalidatePath("/");
  return { success: true };
}

export interface GroupInviteItem {
  id: string;
  token: string;
  groupId: string;
  expiresAt: Date;
  usedCount: number;
  createdAt: Date;
}

/**
 * Crea un enlace de invitación para unirse a un grupo privado.
 */
export async function createGroupInviteAction(
  groupId: string,
  expiresInDays: number = 7
): Promise<{ success?: boolean; token?: string; error?: string }> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "No autenticado." };

  const [group] = await db
    .select()
    .from(sharingGroups)
    .where(eq(sharingGroups.id, groupId))
    .limit(1);

  if (!group) return { error: "Grupo no encontrado." };
  if (group.ownerUserId !== currentUser.id) {
    return { error: "Solo el creador del grupo puede generar invitaciones." };
  }

  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

  await db.insert(groupInvitations).values({
    groupId,
    token,
    createdById: currentUser.id,
    expiresAt,
  });

  await logAudit({
    actorUserId: currentUser.id,
    entityType: "group",
    entityId: groupId,
    action: "group_invite_created",
    metadata: { tokenPrefix: token.slice(0, 8), expiresInDays },
  });

  revalidatePath("/");
  return { success: true, token };
}

/**
 * Obtiene las invitaciones vigentes de un grupo (solo el propietario).
 */
export async function getGroupInvitesAction(
  groupId: string
): Promise<{ success?: boolean; invites?: GroupInviteItem[]; error?: string }> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "No autenticado." };

  const [group] = await db
    .select()
    .from(sharingGroups)
    .where(eq(sharingGroups.id, groupId))
    .limit(1);

  if (!group) return { error: "Grupo no encontrado." };
  if (group.ownerUserId !== currentUser.id) {
    return { error: "Solo el creador del grupo puede consultar sus invitaciones." };
  }

  const rows = await db
    .select({
      id: groupInvitations.id,
      token: groupInvitations.token,
      groupId: groupInvitations.groupId,
      expiresAt: groupInvitations.expiresAt,
      usedCount: groupInvitations.usedCount,
      createdAt: groupInvitations.createdAt,
    })
    .from(groupInvitations)
    .where(
      and(
        eq(groupInvitations.groupId, groupId),
        gt(groupInvitations.expiresAt, new Date())
      )
    )
    .orderBy(desc(groupInvitations.createdAt));

  return { success: true, invites: rows };
}

/**
 * Revoca o elimina un enlace de invitación antes de su expiración.
 */
export async function revokeGroupInviteAction(
  inviteId: string
): Promise<{ success?: boolean; error?: string }> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "No autenticado." };

  const [invite] = await db
    .select({
      id: groupInvitations.id,
      groupId: groupInvitations.groupId,
      ownerUserId: sharingGroups.ownerUserId,
    })
    .from(groupInvitations)
    .innerJoin(sharingGroups, eq(groupInvitations.groupId, sharingGroups.id))
    .where(eq(groupInvitations.id, inviteId))
    .limit(1);

  if (!invite) return { error: "Invitación no encontrada." };
  if (invite.ownerUserId !== currentUser.id) {
    return { error: "Solo el creador del grupo puede revocar esta invitación." };
  }

  await db.delete(groupInvitations).where(eq(groupInvitations.id, inviteId));

  await logAudit({
    actorUserId: currentUser.id,
    entityType: "group",
    entityId: invite.groupId,
    action: "group_invite_revoked",
    metadata: { inviteId },
  });

  revalidatePath("/");
  return { success: true };
}

/**
 * Información pública del enlace para la pantalla de bienvenida / aceptación.
 */
export async function getGroupInviteInfoAction(token: string): Promise<{
  success?: boolean;
  groupName?: string;
  ownerName?: string;
  isExpired?: boolean;
  isAlreadyMember?: boolean;
  error?: string;
}> {
  const currentUser = await getCurrentUser();

  const [invite] = await db
    .select({
      id: groupInvitations.id,
      groupId: groupInvitations.groupId,
      expiresAt: groupInvitations.expiresAt,
      groupName: sharingGroups.name,
      ownerUserId: sharingGroups.ownerUserId,
      ownerName: users.name,
    })
    .from(groupInvitations)
    .innerJoin(sharingGroups, eq(groupInvitations.groupId, sharingGroups.id))
    .innerJoin(users, eq(sharingGroups.ownerUserId, users.id))
    .where(eq(groupInvitations.token, token))
    .limit(1);

  if (!invite) {
    return { error: "El enlace de invitación no es válido o ha sido revocado." };
  }

  const isExpired = new Date(invite.expiresAt).getTime() < Date.now();

  let isAlreadyMember = false;
  if (currentUser) {
    const [existingMember] = await db
      .select({ id: sharingGroupMembers.id })
      .from(sharingGroupMembers)
      .where(
        and(
          eq(sharingGroupMembers.groupId, invite.groupId),
          eq(sharingGroupMembers.userId, currentUser.id)
        )
      )
      .limit(1);
    if (existingMember) isAlreadyMember = true;
  }

  return {
    success: true,
    groupName: invite.groupName,
    ownerName: invite.ownerName,
    isExpired,
    isAlreadyMember,
  };
}

/**
 * Acepta la invitación y une al usuario actual al grupo privado.
 */
export async function joinGroupWithTokenAction(token: string): Promise<{
  success?: boolean;
  groupName?: string;
  groupId?: string;
  error?: string;
}> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "Debes iniciar sesión para unirte al grupo." };

  const [invite] = await db
    .select({
      id: groupInvitations.id,
      groupId: groupInvitations.groupId,
      expiresAt: groupInvitations.expiresAt,
      usedCount: groupInvitations.usedCount,
      groupName: sharingGroups.name,
    })
    .from(groupInvitations)
    .innerJoin(sharingGroups, eq(groupInvitations.groupId, sharingGroups.id))
    .where(eq(groupInvitations.token, token))
    .limit(1);

  if (!invite) {
    return { error: "El enlace de invitación no es válido o ya no existe." };
  }

  if (new Date(invite.expiresAt).getTime() < Date.now()) {
    return { error: "Este enlace de invitación ha caducado." };
  }

  // Insertar como miembro si aún no lo es
  await db
    .insert(sharingGroupMembers)
    .values({
      groupId: invite.groupId,
      userId: currentUser.id,
    })
    .onConflictDoNothing();

  // Incrementar contador de usos
  await db
    .update(groupInvitations)
    .set({ usedCount: (invite.usedCount || 0) + 1 })
    .where(eq(groupInvitations.id, invite.id));

  await logAudit({
    actorUserId: currentUser.id,
    entityType: "group",
    entityId: invite.groupId,
    action: "group_joined_via_invite",
    metadata: { tokenPrefix: token.slice(0, 8), groupName: invite.groupName },
  });

  revalidatePath("/");
  return { success: true, groupName: invite.groupName, groupId: invite.groupId };
}
