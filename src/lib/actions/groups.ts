"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { and, eq, inArray, ne, or, gt, desc, sql, isNull } from "drizzle-orm";
import { randomBytes } from "crypto";
import { db } from "@/db";
import {
  sharingGroups,
  sharingGroupMembers,
  groupInvitations,
  groupJoinRequests,
  places,
  occasions,
  tags,
  placeLists,
  savedFilters,
  users,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { encryptApiKey, getGroupApiUsageSummary } from "@/lib/places-api";
import {
  ACTIVE_SPACE_COOKIE,
  buildScopeKey,
  ensureDefaultOccasionsForScope,
  getGroupMembership,
} from "@/lib/workspace";

export interface GroupMemberInfo {
  userId: string;
  name: string;
  username: string | null;
  role: "admin" | "member";
  isOwner: boolean;
}

export interface SharingGroupWithMembers {
  id: string;
  name: string;
  icon: string;
  description: string | null;
  ownerUserId: string;
  ownerName: string;
  ownerUsername: string | null;
  isOwner: boolean;
  isAdmin: boolean;
  myRole: "admin" | "member";
  placesCount: number;
  members: GroupMemberInfo[];
  createdAt: Date;
}

export interface SimpleUserOption {
  id: string;
  name: string;
  username: string | null;
}

export interface AdminGroupOverviewItem {
  id: string;
  name: string;
  icon: string;
  description: string | null;
  ownerUserId: string;
  ownerName: string;
  ownerUsername: string | null;
  membersCount: number;
  placesCount: number;
  occasionsCount: number;
  tagsCount: number;
  createdAt: Date;
}

/**
 * Cambia el espacio activo del usuario ('personal' | 'all' | 'group:<uuid>' | '<uuid>').
 */
export async function switchActiveSpaceAction(
  target: string
): Promise<{ success?: boolean; error?: string }> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "No autenticado." };

  const clean = (target || "").trim();
  let cookieVal = "personal";

  if (clean === "personal") {
    cookieVal = "personal";
  } else if (clean === "all") {
    cookieVal = "all";
  } else {
    const groupId = clean.startsWith("group:") ? clean.slice("group:".length) : clean;
    const membership = await getGroupMembership(currentUser.id, groupId);
    if (!membership.isMember && currentUser.role !== "admin") {
      return { error: "No perteneces a este grupo." };
    }
    cookieVal = `group:${groupId}`;
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_SPACE_COOKIE, cookieVal, {
    path: "/",
    maxAge: 31536000,
    sameSite: "lax",
  });

  revalidatePath("/");
  revalidatePath("/new");
  return { success: true };
}

/**
 * Devuelve todos los grupos donde el usuario actual es propietario o miembro,
 * incluyendo rol de cada integrante, icono, descripción y contador de sitios.
 */
export async function getMyGroupsAction(): Promise<SharingGroupWithMembers[]> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return [];

  const memberRows = await db
    .select({
      groupId: sharingGroupMembers.groupId,
      role: sharingGroupMembers.role,
    })
    .from(sharingGroupMembers)
    .where(eq(sharingGroupMembers.userId, currentUser.id));

  const memberGroupIds = memberRows.map((r) => r.groupId);
  const myRoleByGroup = new Map<string, "admin" | "member">(
    memberRows.map((r) => [r.groupId, r.role === "admin" ? "admin" : "member"])
  );

  const groupsList = await db
    .select({
      id: sharingGroups.id,
      name: sharingGroups.name,
      icon: sharingGroups.icon,
      description: sharingGroups.description,
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
  const [allMembers, placeCounts] = await Promise.all([
    db
      .select({
        groupId: sharingGroupMembers.groupId,
        role: sharingGroupMembers.role,
        userId: users.id,
        name: users.name,
        username: users.username,
      })
      .from(sharingGroupMembers)
      .innerJoin(users, eq(sharingGroupMembers.userId, users.id))
      .where(inArray(sharingGroupMembers.groupId, groupIds)),
    db
      .select({
        groupId: places.groupId,
        count: sql<number>`cast(count(*) as integer)`,
      })
      .from(places)
      .where(and(inArray(places.groupId, groupIds), isNull(places.deletedAt)))
      .groupBy(places.groupId),
  ]);

  const ownerByGroup = new Map(groupsList.map((g) => [g.id, g.ownerUserId]));
  const placesCountByGroup = new Map(
    placeCounts.filter((p) => p.groupId !== null).map((p) => [p.groupId as string, p.count])
  );

  const membersByGroup = new Map<string, GroupMemberInfo[]>();
  for (const m of allMembers) {
    const arr = membersByGroup.get(m.groupId) || [];
    const isOwner = ownerByGroup.get(m.groupId) === m.userId;
    arr.push({
      userId: m.userId,
      name: m.name,
      username: m.username,
      role: isOwner || m.role === "admin" ? "admin" : "member",
      isOwner,
    });
    membersByGroup.set(m.groupId, arr);
  }

  return groupsList.map((g) => {
    const isOwner = g.ownerUserId === currentUser.id;
    const myRole: "admin" | "member" =
      isOwner || myRoleByGroup.get(g.id) === "admin" ? "admin" : "member";
    const members = (membersByGroup.get(g.id) || []).sort((a, b) => {
      if (a.isOwner !== b.isOwner) return a.isOwner ? -1 : 1;
      if (a.role !== b.role) return a.role === "admin" ? -1 : 1;
      return a.name.localeCompare(b.name, "es");
    });

    return {
      id: g.id,
      name: g.name,
      icon: g.icon || "🍻",
      description: g.description ?? null,
      ownerUserId: g.ownerUserId,
      ownerName: g.ownerName,
      ownerUsername: g.ownerUsername,
      isOwner,
      isAdmin: isOwner || myRole === "admin",
      myRole,
      placesCount: placesCountByGroup.get(g.id) || 0,
      members,
      createdAt: g.createdAt,
    };
  });
}

/**
 * Devuelve lista ligera de usuarios activos (solo disponible para superadmin al añadir directamente).
 * Los grupos normales usan enlaces de invitación para no exponer el directorio global de usuarios.
 */
export async function getActiveUsersForSharingAction(): Promise<SimpleUserOption[]> {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") return [];

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
 * Crea un nuevo grupo de amigos (el creador es propietario + admin, se inicializan los 8 planes base
 * y se activa automáticamente como espacio seleccionado).
 */
export async function createGroupAction(
  name: string,
  icon: string = "🍻",
  description?: string,
  template?: { mode: "default" | "empty" | "clone"; sourceGroupId?: string }
): Promise<{ success?: boolean; groupId?: string; error?: string }> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "No autenticado." };

  const clean = name.trim();
  if (clean.length < 2) {
    return { error: "El nombre del grupo debe tener al menos 2 caracteres." };
  }

  const cleanIcon = (icon || "🍻").trim().slice(0, 50) || "🍻";
  const cleanDesc = description?.trim() || null;

  const [created] = await db
    .insert(sharingGroups)
    .values({
      name: clean.slice(0, 100),
      icon: cleanIcon,
      description: cleanDesc,
      ownerUserId: currentUser.id,
    })
    .returning();

  await db
    .insert(sharingGroupMembers)
    .values({
      groupId: created.id,
      userId: currentUser.id,
      role: "admin",
    })
    .onConflictDoUpdate({
      target: [sharingGroupMembers.groupId, sharingGroupMembers.userId],
      set: { role: "admin" },
    });

  const targetScopeKey = buildScopeKey(created.id, currentUser.id);
  const templateMode = template?.mode || "default";

  if (templateMode === "clone" && template?.sourceGroupId) {
    const membership = await getGroupMembership(currentUser.id, template.sourceGroupId);
    if (membership.isMember || currentUser.role === "admin") {
      const srcScope = `group:${template.sourceGroupId}`;
      const [srcOccs, srcTags] = await Promise.all([
        db.select().from(occasions).where(eq(occasions.scopeKey, srcScope)),
        db.select().from(tags).where(eq(tags.scopeKey, srcScope)),
      ]);
      if (srcOccs.length > 0) {
        await db
          .insert(occasions)
          .values(
            srcOccs.map((o) => ({
              scopeKey: targetScopeKey,
              id: o.id,
              name: o.name,
              icon: o.icon,
            }))
          )
          .onConflictDoNothing();
      }
      if (srcTags.length > 0) {
        await db
          .insert(tags)
          .values(
            srcTags.map((t) => ({
              scopeKey: targetScopeKey,
              id: t.id,
              name: t.name,
            }))
          )
          .onConflictDoNothing();
      }
    } else {
      await ensureDefaultOccasionsForScope(targetScopeKey);
    }
  } else if (templateMode === "default") {
    // Inicializar los 8 planes por defecto del nuevo grupo
    await ensureDefaultOccasionsForScope(targetScopeKey);
  }
  // Si templateMode === "empty", arranca sin planes ni etiquetas predefinidos

  // Activar automáticamente el nuevo grupo como espacio en uso
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_SPACE_COOKIE, `group:${created.id}`, {
    path: "/",
    maxAge: 31536000,
    sameSite: "lax",
  });

  await logAudit({
    actorUserId: currentUser.id,
    entityType: "group",
    entityId: created.id,
    action: "group_created",
    metadata: { name: created.name, icon: cleanIcon },
  });

  revalidatePath("/");
  revalidatePath("/new");
  return { success: true, groupId: created.id };
}

/**
 * Actualiza nombre, icono y descripción de un grupo (cualquier Admin del grupo o Superadmin).
 */
export async function updateGroupSettingsAction(
  groupId: string,
  input: {
    name: string;
    icon?: string;
    description?: string | null;
    requireJoinApproval?: boolean;
  }
): Promise<{ success?: boolean; error?: string }> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "No autenticado." };

  const clean = (input.name || "").trim();
  if (clean.length < 2) {
    return { error: "El nombre del grupo debe tener al menos 2 caracteres." };
  }

  const membership = await getGroupMembership(currentUser.id, groupId);
  if (!membership.isGroupAdmin && currentUser.role !== "admin") {
    return { error: "Solo los administradores del grupo pueden modificar su configuración." };
  }

  await db
    .update(sharingGroups)
    .set({
      name: clean.slice(0, 100),
      ...(input.icon !== undefined ? { icon: input.icon.trim().slice(0, 50) || "🍻" } : {}),
      ...(input.description !== undefined
        ? { description: input.description?.trim() || null }
        : {}),
      ...(input.requireJoinApproval !== undefined
        ? { requireJoinApproval: input.requireJoinApproval }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(sharingGroups.id, groupId));

  await logAudit({
    actorUserId: currentUser.id,
    entityType: "group",
    entityId: groupId,
    action: "group_updated",
    metadata: { name: clean },
  });

  revalidatePath("/");
  return { success: true };
}

/**
 * Renombra un grupo (admins del grupo).
 */
export async function renameGroupAction(
  groupId: string,
  newName: string
): Promise<{ success?: boolean; error?: string }> {
  return updateGroupSettingsAction(groupId, { name: newName });
}

/**
 * Cambia el rol ('owner' | 'admin' | 'member') de un integrante dentro de un grupo.
 * - Los Admins de grupo pueden alternar 'admin' <-> 'member' en miembros que no sean el creador.
 * - El Creador o el Superadmin pueden transferir 'owner'.
 * - El Superadmin puede cambiar el rol de TODOS los miembros del grupo (incluido el creador).
 */
export async function setGroupMemberRoleAction(
  groupId: string,
  targetUserId: string,
  newRole: "owner" | "admin" | "member"
): Promise<{ success?: boolean; error?: string }> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "No autenticado." };

  const [group] = await db
    .select()
    .from(sharingGroups)
    .where(eq(sharingGroups.id, groupId))
    .limit(1);

  if (!group) return { error: "Grupo no encontrado." };

  const isSuperAdmin = currentUser.role === "admin";
  const membership = await getGroupMembership(currentUser.id, groupId);
  if (!membership.isGroupAdmin && !isSuperAdmin) {
    return { error: "Solo los administradores del grupo pueden gestionar roles." };
  }

  // Caso 1: Transferir rol de Creador / Propietario del grupo
  if (newRole === "owner") {
    if (!isSuperAdmin && group.ownerUserId !== currentUser.id) {
      return { error: "Solo el creador del grupo o un superadministrador puede asignar otro creador." };
    }
    await db
      .update(sharingGroups)
      .set({ ownerUserId: targetUserId, updatedAt: new Date() })
      .where(eq(sharingGroups.id, groupId));

    await db
      .insert(sharingGroupMembers)
      .values({ groupId, userId: targetUserId, role: "admin" })
      .onConflictDoUpdate({
        target: [sharingGroupMembers.groupId, sharingGroupMembers.userId],
        set: { role: "admin" },
      });

    await logAudit({
      actorUserId: currentUser.id,
      entityType: "group",
      entityId: groupId,
      action: "group_member_role_changed",
      metadata: { targetUserId, newRole: "owner" },
    });

    revalidatePath("/");
    revalidatePath("/group-admin");
    revalidatePath("/admin");
    return { success: true };
  }

  // Caso 2: Modificar rol del actual creador del grupo
  if (targetUserId === group.ownerUserId && newRole !== "admin") {
    if (!isSuperAdmin) {
      return { error: "Solo un superadministrador puede rebajar el rol del creador del grupo." };
    }
    // Buscar otro admin del grupo para heredar la propiedad técnica, o asignarla al superadmin actual
    const otherAdmins = await db
      .select({ userId: sharingGroupMembers.userId })
      .from(sharingGroupMembers)
      .where(
        and(
          eq(sharingGroupMembers.groupId, groupId),
          eq(sharingGroupMembers.role, "admin"),
          ne(sharingGroupMembers.userId, targetUserId)
        )
      )
      .limit(1);

    const fallbackOwnerId = otherAdmins[0]?.userId || currentUser.id;
    await db
      .insert(sharingGroupMembers)
      .values({ groupId, userId: fallbackOwnerId, role: "admin" })
      .onConflictDoUpdate({
        target: [sharingGroupMembers.groupId, sharingGroupMembers.userId],
        set: { role: "admin" },
      });

    await db
      .update(sharingGroups)
      .set({ ownerUserId: fallbackOwnerId, updatedAt: new Date() })
      .where(eq(sharingGroups.id, groupId));
  }

  await db
    .insert(sharingGroupMembers)
    .values({ groupId, userId: targetUserId, role: newRole })
    .onConflictDoUpdate({
      target: [sharingGroupMembers.groupId, sharingGroupMembers.userId],
      set: { role: newRole },
    });

  await logAudit({
    actorUserId: currentUser.id,
    entityType: "group",
    entityId: groupId,
    action: "group_member_role_changed",
    metadata: { targetUserId, newRole },
  });

  revalidatePath("/");
  revalidatePath("/group-admin");
  revalidatePath("/admin");
  return { success: true };
}

/**
 * Añade un miembro a un grupo por su @username o ID (solo admins del grupo).
 */
export async function addGroupMemberAction(
  groupId: string,
  targetIdentifier: string
): Promise<{ success?: boolean; error?: string }> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "No autenticado." };

  const membership = await getGroupMembership(currentUser.id, groupId);
  if (!membership.isGroupAdmin && currentUser.role !== "admin") {
    return { error: "Solo los administradores del grupo pueden añadir miembros." };
  }

  const cleanIdent = targetIdentifier.trim().replace(/^@/, "");
  if (!cleanIdent) return { error: "Indica un @usuario válido." };

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanIdent);
  const [targetUser] = await db
    .select({ id: users.id, status: users.status })
    .from(users)
    .where(
      isUuid
        ? eq(users.id, cleanIdent)
        : eq(users.username, cleanIdent.toLowerCase())
    )
    .limit(1);

  if (!targetUser || targetUser.status === "disabled") {
    return { error: "No se encontró ningún usuario activo con ese @username." };
  }

  await db
    .insert(sharingGroupMembers)
    .values({ groupId, userId: targetUser.id, role: "member" })
    .onConflictDoNothing();

  revalidatePath("/");
  return { success: true };
}

/**
 * Expulsa a un miembro (admins del grupo) o abandona el grupo voluntariamente (miembro).
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

  const membership = await getGroupMembership(currentUser.id, groupId);
  const isGroupAdmin = membership.isGroupAdmin || currentUser.role === "admin";
  const isSelfLeaving = targetUserId === currentUser.id && !membership.isOwner;

  if (!isGroupAdmin && !isSelfLeaving) {
    return { error: "No tienes permiso para modificar los miembros de este grupo." };
  }

  if (targetUserId === group.ownerUserId) {
    return {
      error:
        "El creador del grupo no puede ser expulsado ni abandonarlo; elimina el grupo si ya no lo necesitas.",
    };
  }

  await db
    .delete(sharingGroupMembers)
    .where(
      and(
        eq(sharingGroupMembers.groupId, groupId),
        eq(sharingGroupMembers.userId, targetUserId)
      )
    );

  // Si el propio usuario abandonó el grupo y lo tenía activo, pasar a Mapa Personal
  if (targetUserId === currentUser.id) {
    const cookieStore = await cookies();
    if (cookieStore.get(ACTIVE_SPACE_COOKIE)?.value === `group:${groupId}`) {
      cookieStore.set(ACTIVE_SPACE_COOKIE, "personal", {
        path: "/",
        maxAge: 31536000,
        sameSite: "lax",
      });
    }
  }

  revalidatePath("/");
  return { success: true };
}

/**
 * Elimina un grupo completo junto con su catálogo aislado (solo el creador del grupo o Superadmin).
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
  if (group.ownerUserId !== currentUser.id && currentUser.role !== "admin") {
    return { error: "Solo el creador del grupo o el superadministrador puede eliminarlo." };
  }

  const scopeKey = `group:${groupId}`;
  await db.delete(occasions).where(eq(occasions.scopeKey, scopeKey));
  await db.delete(tags).where(eq(tags.scopeKey, scopeKey));
  await db.delete(placeLists).where(eq(placeLists.groupId, groupId));
  await db.delete(savedFilters).where(eq(savedFilters.groupId, groupId));
  await db.delete(places).where(eq(places.groupId, groupId));
  await db.delete(sharingGroupMembers).where(eq(sharingGroupMembers.groupId, groupId));
  await db.delete(sharingGroups).where(eq(sharingGroups.id, groupId));

  const cookieStore = await cookies();
  if (cookieStore.get(ACTIVE_SPACE_COOKIE)?.value === `group:${groupId}`) {
    cookieStore.set(ACTIVE_SPACE_COOKIE, "personal", {
      path: "/",
      maxAge: 31536000,
      sameSite: "lax",
    });
  }

  await logAudit({
    actorUserId: currentUser.id,
    entityType: "group",
    entityId: groupId,
    action: "group_deleted",
    metadata: { name: group.name },
  });

  revalidatePath("/");
  revalidatePath("/admin");
  return { success: true };
}

/**
 * Listado global de todos los grupos de la instancia (solo Superadmin en /admin).
 */
export async function getAllGroupsAdminAction(): Promise<AdminGroupOverviewItem[]> {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") return [];

  const allGroups = await db
    .select({
      id: sharingGroups.id,
      name: sharingGroups.name,
      icon: sharingGroups.icon,
      description: sharingGroups.description,
      ownerUserId: sharingGroups.ownerUserId,
      ownerName: users.name,
      ownerUsername: users.username,
      createdAt: sharingGroups.createdAt,
    })
    .from(sharingGroups)
    .innerJoin(users, eq(sharingGroups.ownerUserId, users.id))
    .orderBy(desc(sharingGroups.createdAt));

  if (allGroups.length === 0) return [];

  const groupIds = allGroups.map((g) => g.id);
  const scopeKeys = groupIds.map((gid) => `group:${gid}`);
  const [memberCounts, placeCounts, occCounts, tagCounts] = await Promise.all([
    db
      .select({
        groupId: sharingGroupMembers.groupId,
        count: sql<number>`cast(count(*) as integer)`,
      })
      .from(sharingGroupMembers)
      .where(inArray(sharingGroupMembers.groupId, groupIds))
      .groupBy(sharingGroupMembers.groupId),
    db
      .select({
        groupId: places.groupId,
        count: sql<number>`cast(count(*) as integer)`,
      })
      .from(places)
      .where(and(inArray(places.groupId, groupIds), isNull(places.deletedAt)))
      .groupBy(places.groupId),
    db
      .select({
        scopeKey: occasions.scopeKey,
        count: sql<number>`cast(count(*) as integer)`,
      })
      .from(occasions)
      .where(inArray(occasions.scopeKey, scopeKeys))
      .groupBy(occasions.scopeKey),
    db
      .select({
        scopeKey: tags.scopeKey,
        count: sql<number>`cast(count(*) as integer)`,
      })
      .from(tags)
      .where(inArray(tags.scopeKey, scopeKeys))
      .groupBy(tags.scopeKey),
  ]);

  const mMap = new Map(memberCounts.map((m) => [m.groupId, m.count]));
  const pMap = new Map(
    placeCounts.filter((p) => p.groupId !== null).map((p) => [p.groupId as string, p.count])
  );
  const oMap = new Map(occCounts.map((o) => [o.scopeKey, o.count]));
  const tMap = new Map(tagCounts.map((t) => [t.scopeKey, t.count]));

  return allGroups.map((g) => ({
    ...g,
    icon: g.icon || "🍻",
    description: g.description ?? null,
    membersCount: Math.max(1, mMap.get(g.id) || 0),
    placesCount: pMap.get(g.id) || 0,
    occasionsCount: oMap.get(`group:${g.id}`) || 0,
    tagsCount: tMap.get(`group:${g.id}`) || 0,
  }));
}

export interface GroupInviteItem {
  id: string;
  token: string;
  groupId: string;
  expiresAt: Date;
  usedCount: number;
  maxUses: number | null;
  neverExpires: boolean;
  createdAt: Date;
}

/**
 * Crea un enlace de invitación para unirse a un grupo (cualquier Admin del grupo).
 */
export async function createGroupInviteAction(
  groupId: string,
  expiresInDays: number = 7,
  maxUses: number | null = null
): Promise<{ success?: boolean; token?: string; error?: string }> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "No autenticado." };

  const membership = await getGroupMembership(currentUser.id, groupId);
  if (!membership.isGroupAdmin && currentUser.role !== "admin") {
    return { error: "Solo los administradores del grupo pueden generar invitaciones." };
  }

  const neverExpires = expiresInDays <= 0;
  const days = neverExpires ? 365 * 50 : Math.min(expiresInDays, 365);
  const safeMax = maxUses && maxUses > 0 ? Math.min(Math.floor(maxUses), 1000) : null;

  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  await db.insert(groupInvitations).values({
    groupId,
    token,
    createdById: currentUser.id,
    expiresAt,
    maxUses: safeMax,
    neverExpires,
  });

  await logAudit({
    actorUserId: currentUser.id,
    entityType: "group",
    entityId: groupId,
    action: "group_invite_created",
    metadata: { tokenPrefix: token.slice(0, 8), expiresInDays, maxUses: safeMax },
  });

  revalidatePath("/");
  return { success: true, token };
}

/**
 * Obtiene las invitaciones vigentes de un grupo (admins del grupo).
 */
export async function getGroupInvitesAction(
  groupId: string
): Promise<{ success?: boolean; invites?: GroupInviteItem[]; error?: string }> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "No autenticado." };

  const membership = await getGroupMembership(currentUser.id, groupId);
  if (!membership.isGroupAdmin && currentUser.role !== "admin") {
    return { error: "Solo los administradores del grupo pueden consultar sus invitaciones." };
  }

  const rows = await db
    .select({
      id: groupInvitations.id,
      token: groupInvitations.token,
      groupId: groupInvitations.groupId,
      expiresAt: groupInvitations.expiresAt,
      usedCount: groupInvitations.usedCount,
      maxUses: groupInvitations.maxUses,
      neverExpires: groupInvitations.neverExpires,
      createdAt: groupInvitations.createdAt,
    })
    .from(groupInvitations)
    .where(
      and(
        eq(groupInvitations.groupId, groupId),
        isNull(groupInvitations.revokedAt),
        gt(groupInvitations.expiresAt, new Date())
      )
    )
    .orderBy(desc(groupInvitations.createdAt));

  return { success: true, invites: rows };
}

/**
 * Revoca o elimina un enlace de invitación antes de su expiración (admins del grupo).
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
    })
    .from(groupInvitations)
    .where(eq(groupInvitations.id, inviteId))
    .limit(1);

  if (!invite) return { error: "Invitación no encontrada." };

  const membership = await getGroupMembership(currentUser.id, invite.groupId);
  if (!membership.isGroupAdmin && currentUser.role !== "admin") {
    return { error: "Solo los administradores del grupo pueden revocar esta invitación." };
  }

  await db
    .update(groupInvitations)
    .set({ revokedAt: new Date() })
    .where(eq(groupInvitations.id, inviteId));

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
  groupIcon?: string;
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
      groupIcon: sharingGroups.icon,
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
    groupIcon: invite.groupIcon || "🍻",
    ownerName: invite.ownerName,
    isExpired,
    isAlreadyMember,
  };
}

/**
 * Acepta la invitación, une al usuario actual al grupo y selecciona el grupo como espacio activo.
 */
export async function joinGroupWithTokenAction(token: string): Promise<{
  success?: boolean;
  pendingApproval?: boolean;
  groupName?: string;
  groupId?: string;
  error?: string;
}> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "Debes iniciar sesión para unirte al grupo." };

  const rl = await rateLimit("join-group", 15, 10 * 60 * 1000);
  if (!rl.allowed) return { error: "Demasiados intentos. Espera unos minutos." };

  const [invite] = await db
    .select({
      id: groupInvitations.id,
      groupId: groupInvitations.groupId,
      expiresAt: groupInvitations.expiresAt,
      usedCount: groupInvitations.usedCount,
      maxUses: groupInvitations.maxUses,
      revokedAt: groupInvitations.revokedAt,
      groupName: sharingGroups.name,
      requireJoinApproval: sharingGroups.requireJoinApproval,
    })
    .from(groupInvitations)
    .innerJoin(sharingGroups, eq(groupInvitations.groupId, sharingGroups.id))
    .where(eq(groupInvitations.token, token))
    .limit(1);

  if (!invite || invite.revokedAt) {
    return { error: "El enlace de invitación no es válido o ha sido revocado." };
  }

  if (new Date(invite.expiresAt).getTime() < Date.now()) {
    return { error: "Este enlace de invitación ha caducado." };
  }

  if (invite.maxUses !== null && (invite.usedCount || 0) >= invite.maxUses) {
    return { error: "Este enlace ya ha alcanzado su número máximo de usos." };
  }

  const [alreadyMember] = await db
    .select({ id: sharingGroupMembers.id })
    .from(sharingGroupMembers)
    .where(
      and(
        eq(sharingGroupMembers.groupId, invite.groupId),
        eq(sharingGroupMembers.userId, currentUser.id)
      )
    )
    .limit(1);

  if (!alreadyMember && invite.requireJoinApproval) {
    await db
      .insert(groupJoinRequests)
      .values({
        groupId: invite.groupId,
        userId: currentUser.id,
        invitationId: invite.id,
        status: "pending",
      })
      .onConflictDoUpdate({
        target: [groupJoinRequests.groupId, groupJoinRequests.userId],
        set: {
          status: "pending",
          invitationId: invite.id,
          decidedById: null,
          decidedAt: null,
          createdAt: new Date(),
        },
      });

    await logAudit({
      actorUserId: currentUser.id,
      entityType: "group",
      entityId: invite.groupId,
      action: "group_join_requested",
      metadata: { tokenPrefix: token.slice(0, 8), groupName: invite.groupName },
    });

    return {
      success: true,
      pendingApproval: true,
      groupName: invite.groupName,
      groupId: invite.groupId,
    };
  }

  await db
    .insert(sharingGroupMembers)
    .values({
      groupId: invite.groupId,
      userId: currentUser.id,
      role: "member",
    })
    .onConflictDoNothing();

  await db
    .update(groupInvitations)
    .set({ usedCount: (invite.usedCount || 0) + 1 })
    .where(eq(groupInvitations.id, invite.id));

  // Activar automáticamente el grupo al que acaba de unirse
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_SPACE_COOKIE, `group:${invite.groupId}`, {
    path: "/",
    maxAge: 31536000,
    sameSite: "lax",
  });

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

export interface GroupJoinRequestItem {
  id: string;
  userId: string;
  name: string;
  username: string | null;
  createdAt: Date;
}

export async function getGroupJoinRequestsAction(
  groupId: string
): Promise<GroupJoinRequestItem[]> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return [];
  const membership = await getGroupMembership(currentUser.id, groupId);
  if (!membership.isGroupAdmin && currentUser.role !== "admin") return [];

  return db
    .select({
      id: groupJoinRequests.id,
      userId: groupJoinRequests.userId,
      name: users.name,
      username: users.username,
      createdAt: groupJoinRequests.createdAt,
    })
    .from(groupJoinRequests)
    .innerJoin(users, eq(groupJoinRequests.userId, users.id))
    .where(
      and(
        eq(groupJoinRequests.groupId, groupId),
        eq(groupJoinRequests.status, "pending")
      )
    )
    .orderBy(desc(groupJoinRequests.createdAt));
}

export async function decideGroupJoinRequestAction(
  requestId: string,
  decision: "approve" | "reject"
): Promise<{ success?: boolean; error?: string }> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "No autenticado." };

  const [req] = await db
    .select()
    .from(groupJoinRequests)
    .where(eq(groupJoinRequests.id, requestId))
    .limit(1);

  if (!req) return { error: "Solicitud no encontrada." };

  const membership = await getGroupMembership(currentUser.id, req.groupId);
  if (!membership.isGroupAdmin && currentUser.role !== "admin") {
    return { error: "No tienes permiso para decidir sobre esta solicitud." };
  }

  await db
    .update(groupJoinRequests)
    .set({
      status: decision === "approve" ? "approved" : "rejected",
      decidedById: currentUser.id,
      decidedAt: new Date(),
    })
    .where(eq(groupJoinRequests.id, requestId));

  if (decision === "approve") {
    await db
      .insert(sharingGroupMembers)
      .values({ groupId: req.groupId, userId: req.userId, role: "member" })
      .onConflictDoNothing();
  }

  await logAudit({
    actorUserId: currentUser.id,
    entityType: "group",
    entityId: req.groupId,
    action: decision === "approve" ? "group_join_approved" : "group_join_rejected",
    metadata: { requestId, userId: req.userId },
  });

  revalidatePath("/group-admin");
  revalidatePath("/");
  return { success: true };
}

/**
 * Actualiza la clave de Google Places API cifrada del grupo (Punto 6).
 */
export async function updateGroupApiSettingsAction(
  groupId: string,
  input: { apiKey?: string | null; clearKey?: boolean }
): Promise<{ success?: boolean; error?: string }> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "No autenticado." };

  const membership = await getGroupMembership(currentUser.id, groupId);
  if (!membership.isGroupAdmin && currentUser.role !== "admin") {
    return { error: "Solo los administradores del grupo pueden configurar la API." };
  }

  let nextEnc: string | null | undefined = undefined;
  if (input.clearKey) {
    nextEnc = null;
  } else if (input.apiKey && input.apiKey.trim()) {
    nextEnc = encryptApiKey(input.apiKey.trim());
  }

  if (nextEnc !== undefined) {
    await db
      .update(sharingGroups)
      .set({ googlePlacesApiKeyEnc: nextEnc, updatedAt: new Date() })
      .where(eq(sharingGroups.id, groupId));

    await logAudit({
      actorUserId: currentUser.id,
      entityType: "group",
      entityId: groupId,
      action: input.clearKey ? "group_api_key_cleared" : "group_api_key_updated",
    });
  }

  revalidatePath("/group-admin");
  return { success: true };
}

export async function getGroupApiUsageAction(groupId: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return null;
  const membership = await getGroupMembership(currentUser.id, groupId);
  if (!membership.isGroupAdmin && currentUser.role !== "admin") return null;
  return getGroupApiUsageSummary(groupId);
}
