"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { eq, ne, or, and, sql, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  users,
  sessions,
  invitations,
  places,
  placeComments,
  userPlaces,
  placeOccasions,
  placeTags,
  sharingGroups,
  sharingGroupMembers,
  type User,
} from "@/db/schema";
import { getCurrentUser, hashPassword, verifyPassword } from "@/lib/auth";
import { getGroupMembership } from "@/lib/workspace";
import { logAudit } from "@/lib/audit";

const GHOST_USER_EMAIL = "deleted-user@gastromap.local";

async function ensureGhostUser(): Promise<string> {
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, GHOST_USER_EMAIL))
    .limit(1);
  if (existing) return existing.id;

  const passwordHash = await hashPassword(crypto.randomUUID());
  const [created] = await db
    .insert(users)
    .values({
      username: "usuario_eliminado",
      name: "Usuario eliminado",
      email: GHOST_USER_EMAIL,
      passwordHash,
      role: "user",
      status: "disabled",
      locale: "es",
    })
    .returning({ id: users.id });
  return created.id;
}

export interface AssignableAuthorOption {
  id: string;
  name: string;
  username: string | null;
  isGhost?: boolean;
}

/**
 * Devuelve los usuarios elegibles para asignar como autor de un sitio o comentario.
 */
export async function getAssignableAuthorsAction(
  groupId?: string | null
): Promise<AssignableAuthorOption[]> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return [];

  let rows: Array<{ id: string; name: string; username: string | null; email: string }> = [];

  if (currentUser.role === "admin") {
    rows = await db
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        email: users.email,
      })
      .from(users)
      .where(or(ne(users.status, "disabled"), eq(users.email, GHOST_USER_EMAIL)));
  } else if (groupId) {
    const membership = await getGroupMembership(currentUser.id, groupId);
    if (!membership.isGroupAdmin) return [];
    rows = await db
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        email: users.email,
      })
      .from(sharingGroupMembers)
      .innerJoin(users, eq(sharingGroupMembers.userId, users.id))
      .where(eq(sharingGroupMembers.groupId, groupId));
  } else {
    return [];
  }

  return rows
    .map((u) => ({
      id: u.id,
      name: u.name,
      username: u.username,
      isGhost: u.email === GHOST_USER_EMAIL,
    }))
    .sort((a, b) =>
      (a.username || a.name).localeCompare(b.username || b.name, "es", { sensitivity: "base" })
    );
}

export interface UserGroupRoleSummary {
  groupId: string;
  groupName: string;
  groupIcon: string;
  role: "owner" | "admin" | "member";
}

export interface SafeUser {
  id: string;
  username: string | null;
  name: string;
  email: string;
  role: string;
  status: string;
  locale: string;
  lastLoginAt: Date | null;
  createdAt: Date;
  placesCount?: number;
  groups?: UserGroupRoleSummary[];
}

/**
 * Obtiene todos los usuarios del sistema junto con sus roles en cada grupo (solo Superadmin)
 */
export async function getAllUsersAction(): Promise<SafeUser[]> {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") {
    return [];
  }

  const [rows, allGroups, allMemberships, placeCounts] = await Promise.all([
    db
      .select({
        id: users.id,
        username: users.username,
        name: users.name,
        email: users.email,
        role: users.role,
        status: users.status,
        locale: users.locale,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(ne(users.email, GHOST_USER_EMAIL))
      .orderBy(users.createdAt),
    db
      .select({
        id: sharingGroups.id,
        name: sharingGroups.name,
        icon: sharingGroups.icon,
        ownerUserId: sharingGroups.ownerUserId,
      })
      .from(sharingGroups),
    db
      .select({
        groupId: sharingGroupMembers.groupId,
        userId: sharingGroupMembers.userId,
        role: sharingGroupMembers.role,
      })
      .from(sharingGroupMembers),
    db
      .select({
        createdById: places.createdById,
        count: sql<number>`cast(count(*) as integer)`,
      })
      .from(places)
      .where(isNull(places.deletedAt))
      .groupBy(places.createdById),
  ]);

  const placesCountByUser = new Map(placeCounts.map((p) => [p.createdById, p.count]));

  const groupMap = new Map(allGroups.map((g) => [g.id, g]));
  const groupsByUser = new Map<string, Map<string, UserGroupRoleSummary>>();

  for (const m of allMemberships) {
    const g = groupMap.get(m.groupId);
    if (!g) continue;
    const uMap = groupsByUser.get(m.userId) || new Map<string, UserGroupRoleSummary>();
    const isOwner = g.ownerUserId === m.userId;
    uMap.set(g.id, {
      groupId: g.id,
      groupName: g.name,
      groupIcon: g.icon || "🍻",
      role: isOwner ? "owner" : m.role === "admin" ? "admin" : "member",
    });
    groupsByUser.set(m.userId, uMap);
  }

  for (const g of allGroups) {
    const uMap = groupsByUser.get(g.ownerUserId) || new Map<string, UserGroupRoleSummary>();
    if (!uMap.has(g.id)) {
      uMap.set(g.id, {
        groupId: g.id,
        groupName: g.name,
        groupIcon: g.icon || "🍻",
        role: "owner",
      });
      groupsByUser.set(g.ownerUserId, uMap);
    }
  }

  return rows.map((u) => ({
    ...u,
    placesCount: placesCountByUser.get(u.id) || 0,
    groups: Array.from(groupsByUser.get(u.id)?.values() || []).sort((a, b) =>
      a.groupName.localeCompare(b.groupName, "es", { sensitivity: "base" })
    ),
  }));
}

/**
 * Activa o desactiva la cuenta de un usuario ('active' | 'disabled').
 * Al desactivar, revoca inmediatamente todas sus sesiones activas.
 */
export async function toggleUserStatusAction(userId: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") {
    return { error: "No autorizado." };
  }

  if (userId === currentUser.id) {
    return { error: "No puedes desactivar tu propia cuenta de administrador." };
  }

  const [target] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!target) {
    return { error: "Usuario no encontrado." };
  }

  const nextStatus = target.status === "disabled" ? "active" : "disabled";

  await db
    .update(users)
    .set({ status: nextStatus, updatedAt: new Date() })
    .where(eq(users.id, userId));

  // Si se desactiva, revocar todas las sesiones activas inmediatamente
  if (nextStatus === "disabled") {
    await db.delete(sessions).where(eq(sessions.userId, userId));
  }

  await logAudit({
    actorUserId: currentUser.id,
    entityType: "user",
    entityId: userId,
    action: nextStatus === "disabled" ? "user_disabled" : "user_enabled",
    metadata: { username: target.username || target.email },
  });

  revalidatePath("/");
  return { success: true, status: nextStatus };
}

/**
 * Cambia el rol de un usuario ('admin' | 'user')
 */
export async function updateUserRoleAction(userId: string, newRole: "admin" | "user") {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") {
    return { error: "No autorizado." };
  }

  // Si intentamos quitar el rol admin a un usuario, asegurar que queda al menos otro admin
  if (newRole !== "admin") {
    const adminCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.role, "admin"));

    if (Number(adminCount[0]?.count ?? 0) <= 1) {
      return { error: "No puedes quitar el último administrador del sistema." };
    }
  }

  await db
    .update(users)
    .set({ role: newRole, updatedAt: new Date() })
    .where(eq(users.id, userId));

  await logAudit({
    actorUserId: currentUser.id,
    entityType: "user",
    entityId: userId,
    action: "user_role_changed",
    metadata: { newRole },
  });

  revalidatePath("/");
  return { success: true };
}

export interface UpdateUserData {
  name: string;
  username: string;
  email: string;
  role?: "admin" | "user";
  status?: "active" | "disabled";
  locale?: string;
  newPassword?: string;
}

/**
 * Edita los datos de cualquier usuario (nombre, username, email, rol, estado y contraseña) por un administrador
 */
export async function updateUserByAdminAction(userId: string, data: UpdateUserData) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") {
    return { error: "No autorizado. Solo los administradores pueden editar usuarios." };
  }

  const name = data.name?.trim();
  const rawUsername = data.username?.trim().toLowerCase().replace(/^@/, "");
  const email = data.email?.trim().toLowerCase();

  if (!name || name.length < 2) {
    return { error: "El nombre debe tener al menos 2 caracteres." };
  }

  const username = rawUsername || email?.split("@")[0]?.replace(/[^a-z0-9_-]/g, "");
  if (!username || username.length < 3) {
    return { error: "El nombre de usuario (@username) debe tener al menos 3 caracteres." };
  }

  if (!email || !email.includes("@")) {
    return { error: "Introduce un correo electrónico válido." };
  }

  // Comprobar si el email ya existe para otro usuario
  const existingEmail = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, email), ne(users.id, userId)))
    .limit(1);

  if (existingEmail.length > 0) {
    return { error: "El correo electrónico ya está registrado por otro usuario." };
  }

  // Comprobar si el username ya existe para otro usuario
  const existingUsername = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.username, username), ne(users.id, userId)))
    .limit(1);

  if (existingUsername.length > 0) {
    return { error: `El nombre de usuario "@${username}" ya está ocupado por otro usuario.` };
  }

  const updateFields: Partial<User> = {
    name,
    username,
    email,
    updatedAt: new Date(),
  };

  if (data.role) {
    if (data.role !== "admin") {
      const adminCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(eq(users.role, "admin"));

      if (Number(adminCount[0]?.count ?? 0) <= 1 && userId === currentUser.id) {
        return { error: "No puedes quitar el último administrador del sistema." };
      }
    }
    updateFields.role = data.role;
  }

  if (data.status) {
    if (data.status === "disabled" && userId === currentUser.id) {
      return { error: "No puedes desactivar tu propia cuenta de administrador." };
    }
    updateFields.status = data.status;
    if (data.status === "disabled") {
      await db.delete(sessions).where(eq(sessions.userId, userId));
    }
  }

  if (data.locale && (data.locale === "es" || data.locale === "en")) {
    updateFields.locale = data.locale;
  }

  if (data.newPassword && data.newPassword.trim().length > 0) {
    if (data.newPassword.length < 4) {
      return { error: "La nueva contraseña debe tener al menos 4 caracteres." };
    }
    updateFields.passwordHash = await hashPassword(data.newPassword);
  }

  await db.update(users).set(updateFields).where(eq(users.id, userId));

  await logAudit({
    actorUserId: currentUser.id,
    entityType: "user",
    entityId: userId,
    action: "user_updated_by_admin",
    metadata: { username, email, role: data.role, status: data.status, passwordChanged: !!data.newPassword },
  });

  revalidatePath("/");
  return { success: true };
}

/**
 * Cambia o resetea la contraseña de un usuario (solo admin)
 */
export async function resetUserPasswordAction(userId: string, newPassword: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") {
    return { error: "No autorizado." };
  }

  if (!newPassword || newPassword.length < 4) {
    return { error: "La nueva contraseña debe tener al menos 4 caracteres." };
  }

  const passwordHash = await hashPassword(newPassword);

  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, userId));

  await logAudit({
    actorUserId: currentUser.id,
    entityType: "user",
    entityId: userId,
    action: "user_password_reset",
  });

  revalidatePath("/");
  return { success: true };
}

/**
 * Analiza el impacto en grupos antes de eliminar un usuario (Punto 13).
 */
export async function getUserDeletionImpactAction(userId: string): Promise<{
  ownedGroups: Array<{ id: string; name: string; icon: string }>;
  groupPlacesCount: number;
  groupCommentsCount: number;
  personalPlacesCount: number;
} | null> {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") return null;

  const [ownedGroups, createdPlaces, userComments] = await Promise.all([
    db
      .select({ id: sharingGroups.id, name: sharingGroups.name, icon: sharingGroups.icon })
      .from(sharingGroups)
      .where(eq(sharingGroups.ownerUserId, userId)),
    db
      .select({ id: places.id, groupId: places.groupId })
      .from(places)
      .where(and(eq(places.createdById, userId), isNull(places.deletedAt))),
    db
      .select({ id: placeComments.id, groupId: places.groupId })
      .from(placeComments)
      .innerJoin(places, eq(placeComments.placeId, places.id))
      .where(eq(placeComments.userId, userId)),
  ]);

  return {
    ownedGroups,
    groupPlacesCount: createdPlaces.filter((p) => p.groupId !== null).length,
    groupCommentsCount: userComments.filter((c) => c.groupId !== null).length,
    personalPlacesCount: createdPlaces.filter((p) => p.groupId === null).length,
  };
}

/**
 * Elimina un usuario de forma segura (Punto 13):
 * - Impide borrar si es creador de algún grupo sin transferir primero.
 * - Su Mapa Personal se elimina siempre.
 * - Permite reasignar sitios/comentarios de grupo al creador de cada grupo (por defecto) o eliminarlos.
 */
export async function deleteUserAction(
  userId: string,
  options?: { groupDataStrategy?: "reassign_owner" | "assign_ghost" | "delete" }
) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") {
    return { error: "No autorizado." };
  }

  if (userId === currentUser.id) {
    return { error: "No puedes eliminar tu propia cuenta de administrador." };
  }

  const [targetUserRow] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (targetUserRow?.email === GHOST_USER_EMAIL) {
    return { error: "La cuenta de sistema «Usuario eliminado» no se puede borrar." };
  }

  const owned = await db
    .select({ id: sharingGroups.id, name: sharingGroups.name })
    .from(sharingGroups)
    .where(eq(sharingGroups.ownerUserId, userId));

  if (owned.length > 0) {
    return {
      error: `Este usuario es creador de ${owned.map((g) => `«${g.name}»`).join(", ")}. Transfiere la propiedad antes de eliminar su cuenta.`,
    };
  }

  const strategy = options?.groupDataStrategy || "reassign_owner";

  // 1. Limpiar sesiones, invitaciones e interacciones privadas del usuario
  await db.delete(userPlaces).where(eq(userPlaces.userId, userId));
  await db.delete(sessions).where(eq(sessions.userId, userId));
  await db.delete(invitations).where(eq(invitations.createdById, userId));

  const ghostUserId = strategy === "assign_ghost" ? await ensureGhostUser() : null;

  // 2. Comentarios en grupos vs personales
  if (strategy === "reassign_owner" || strategy === "assign_ghost") {
    const commentsInGroups = await db
      .select({
        commentId: placeComments.id,
        ownerUserId: sharingGroups.ownerUserId,
      })
      .from(placeComments)
      .innerJoin(places, eq(placeComments.placeId, places.id))
      .innerJoin(sharingGroups, eq(places.groupId, sharingGroups.id))
      .where(eq(placeComments.userId, userId));

    const byTarget = new Map<string, string[]>();
    for (const row of commentsInGroups) {
      const targetId =
        strategy === "assign_ghost" && ghostUserId
          ? ghostUserId
          : row.ownerUserId === userId
            ? currentUser.id
            : row.ownerUserId;
      const list = byTarget.get(targetId) || [];
      list.push(row.commentId);
      byTarget.set(targetId, list);
    }
    for (const [targetId, cIds] of byTarget.entries()) {
      await db
        .update(placeComments)
        .set({ userId: targetId })
        .where(inArray(placeComments.id, cIds));
    }
  }
  await db.delete(placeComments).where(eq(placeComments.userId, userId));

  // 3. Sitios del usuario: los personales siempre se eliminan; los de grupo se reasignan o eliminan según estrategia
  const userPlacesCreated = await db
    .select({ id: places.id, groupId: places.groupId })
    .from(places)
    .where(eq(places.createdById, userId));

  const personalPlaceIds = userPlacesCreated
    .filter((p) => p.groupId === null)
    .map((p) => p.id);
  const groupPlaces = userPlacesCreated.filter((p) => p.groupId !== null);

  let reassignedCount = 0;
  let deletedPlaceIds = [...personalPlaceIds];

  if (groupPlaces.length > 0) {
    if (strategy === "assign_ghost" && ghostUserId) {
      await db
        .update(places)
        .set({ createdById: ghostUserId, updatedAt: new Date() })
        .where(inArray(places.id, groupPlaces.map((p) => p.id)));
      reassignedCount = groupPlaces.length;
    } else if (strategy === "reassign_owner") {
      const groupIds = Array.from(new Set(groupPlaces.map((p) => p.groupId as string)));
      const owners = await db
        .select({ id: sharingGroups.id, ownerUserId: sharingGroups.ownerUserId })
        .from(sharingGroups)
        .where(inArray(sharingGroups.id, groupIds));
      const ownerByGroup = new Map(owners.map((g) => [g.id, g.ownerUserId]));

      const placesByNewOwner = new Map<string, string[]>();
      for (const p of groupPlaces) {
        const ownerId = ownerByGroup.get(p.groupId as string) || currentUser.id;
        const safeOwner = ownerId === userId ? currentUser.id : ownerId;
        const arr = placesByNewOwner.get(safeOwner) || [];
        arr.push(p.id);
        placesByNewOwner.set(safeOwner, arr);
        reassignedCount++;
      }
      for (const [newOwnerId, pIds] of placesByNewOwner.entries()) {
        await db
          .update(places)
          .set({ createdById: newOwnerId, updatedAt: new Date() })
          .where(inArray(places.id, pIds));
      }
    } else {
      deletedPlaceIds = [...deletedPlaceIds, ...groupPlaces.map((p) => p.id)];
    }
  }

  if (deletedPlaceIds.length > 0) {
    await db.delete(placeComments).where(inArray(placeComments.placeId, deletedPlaceIds));
    await db.delete(userPlaces).where(inArray(userPlaces.placeId, deletedPlaceIds));
    await db.delete(placeOccasions).where(inArray(placeOccasions.placeId, deletedPlaceIds));
    await db.delete(placeTags).where(inArray(placeTags.placeId, deletedPlaceIds));
    await db.delete(places).where(inArray(places.id, deletedPlaceIds));
  }

  // 4. Eliminar usuario de forma segura
  await db.delete(users).where(eq(users.id, userId));
  await logAudit({
    actorUserId: currentUser.id,
    entityType: "user",
    entityId: userId,
    action: "user_deleted",
    metadata: {
      deletedPlacesCount: deletedPlaceIds.length,
      reassignedPlacesCount: reassignedCount,
      strategy,
    },
  });
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/group-admin");
  return { success: true };
}

/**
 * Actualiza el perfil del usuario autenticado (nombre, username, email, contraseña)
 */
export async function updateMyProfileAction(formData: FormData) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { error: "Debes iniciar sesión." };
  }

  const rawUsername = (formData.get("username") as string)
    ?.trim()
    .toLowerCase()
    .replace(/^@/, "");
  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const currentPassword = formData.get("currentPassword") as string;
  const newPassword = formData.get("newPassword") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!name || name.length < 2) {
    return { error: "El nombre debe tener al menos 2 caracteres." };
  }

  const username = rawUsername || email.split("@")[0].replace(/[^a-z0-9_-]/g, "");
  if (!username || username.length < 3) {
    return { error: "El nombre de usuario debe tener al menos 3 caracteres." };
  }

  // Comprobar si el username ya está ocupado por otro usuario
  const existingUsername = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.username, username), ne(users.id, currentUser.id)))
    .limit(1);

  if (existingUsername.length > 0) {
    return { error: `El nombre de usuario "@${username}" ya está en uso.` };
  }

  // Comprobar si el email ya está ocupado por otro usuario
  const existingEmail = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, email), ne(users.id, currentUser.id)))
    .limit(1);

  if (existingEmail.length > 0) {
    return { error: "El correo electrónico ya está registrado por otro usuario." };
  }

  const updateData: Partial<User> = {
    username,
    name,
    email,
    updatedAt: new Date(),
  };

  const locale = (formData.get("locale") as string)?.trim().toLowerCase();
  if (locale && (locale === "es" || locale === "en")) {
    updateData.locale = locale;
    const cookieStore = await (await import("next/headers")).cookies();
    cookieStore.set("gastromap_locale", locale, {
      path: "/",
      maxAge: 31536000,
      sameSite: "lax",
    });
  }

  // Si se desea cambiar la contraseña
  if (newPassword || currentPassword) {
    if (!currentPassword) {
      return { error: "Debes introducir tu contraseña actual para cambiarla." };
    }

    const isValidCurrent = await verifyPassword(currentUser.passwordHash, currentPassword);
    if (!isValidCurrent) {
      return { error: "La contraseña actual es incorrecta." };
    }

    if (!newPassword || newPassword.length < 6) {
      return { error: "La nueva contraseña debe tener al menos 6 caracteres." };
    }

    if (newPassword !== confirmPassword) {
      return { error: "Las nuevas contraseñas no coinciden." };
    }

    updateData.passwordHash = await hashPassword(newPassword);
  }

  await db.update(users).set(updateData).where(eq(users.id, currentUser.id));

  revalidatePath("/");
  return { success: true };
}

/**
 * Crea un nuevo usuario manualmente por un administrador
 */
export async function createUserDirectlyAction(formData: FormData) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") {
    return { error: "No autorizado. Solo los administradores pueden crear usuarios." };
  }

  const name = (formData.get("name") as string)?.trim();
  const rawUsername = (formData.get("username") as string)?.trim().toLowerCase().replace(/^@/, "");
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;
  const role = (formData.get("role") as string) === "admin" ? "admin" : "user";

  if (!name || name.length < 2) {
    return { error: "El nombre debe tener al menos 2 caracteres." };
  }

  const username = rawUsername || email?.split("@")[0]?.replace(/[^a-z0-9_-]/g, "");
  if (!username || username.length < 3) {
    return { error: "El nombre de usuario (@username) debe tener al menos 3 caracteres." };
  }

  if (!email || !email.includes("@")) {
    return { error: "Introduce un correo electrónico válido." };
  }

  if (!password || password.length < 4) {
    return { error: "La contraseña debe tener al menos 4 caracteres." };
  }

  // Comprobar existencia previa de email
  const existingEmail = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingEmail.length > 0) {
    return { error: "El correo electrónico ya está registrado en el sistema." };
  }

  // Comprobar existencia previa de username
  const existingUsername = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (existingUsername.length > 0) {
    return { error: `El nombre de usuario "@${username}" ya está ocupado.` };
  }

  const passwordHash = await hashPassword(password);
  const id = crypto.randomUUID();
  const rawLocale = (formData.get("locale") as string)?.trim().toLowerCase();
  const locale = rawLocale === "en" ? "en" : "es";

  await db.insert(users).values({
    id,
    name,
    username,
    email,
    passwordHash,
    role,
    locale,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await logAudit({
    actorUserId: currentUser.id,
    entityType: "user",
    entityId: id,
    action: "user_created",
    metadata: { username, role },
  });

  revalidatePath("/");
  return { success: true };
}

/**
 * Elimina múltiples usuarios simultáneamente (solo admin)
 * Asegura que el administrador actual no se elimine a sí mismo
 */
export async function deleteMultipleUsersAction(
  userIds: string[]
): Promise<{ success?: boolean; count?: number; error?: string }> {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") {
    return { error: "No autorizado. Solo los administradores pueden realizar esta acción." };
  }

  const validIds = userIds.filter((id) => id !== currentUser.id);
  if (validIds.length === 0) {
    return { error: "No se seleccionó ningún usuario válido para eliminar (no puedes eliminar tu propia cuenta)." };
  }

  const owned = await db
    .select({ name: sharingGroups.name })
    .from(sharingGroups)
    .where(inArray(sharingGroups.ownerUserId, validIds));

  if (owned.length > 0) {
    return {
      error: `Uno o más usuarios seleccionados son creadores de grupo (${owned.map((g) => `«${g.name}»`).join(", ")}). Transfiere la propiedad antes de eliminarlos.`,
    };
  }

  for (const uid of validIds) {
    const res = await deleteUserAction(uid, { groupDataStrategy: "reassign_owner" });
    if (res.error) return res;
  }

  await logAudit({
    actorUserId: currentUser.id,
    entityType: "user",
    entityId: "bulk",
    action: "users_bulk_deleted",
    metadata: { count: validIds.length, groupDataStrategy: "reassign_owner" },
  });
  revalidatePath("/");
  return { success: true, count: validIds.length };
}
