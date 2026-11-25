"use server";

import { revalidatePath } from "next/cache";
import { eq, ne, and, sql, inArray } from "drizzle-orm";
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
  type User,
} from "@/db/schema";
import { getCurrentUser, hashPassword, verifyPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

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
}

/**
 * Obtiene todos los usuarios del sistema (solo accesible por administradores)
 */
export async function getAllUsersAction(): Promise<SafeUser[]> {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") {
    return [];
  }

  const rows = await db
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
    .orderBy(users.createdAt);

  return rows;
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
 * Elimina un usuario (solo admin, no puede eliminarse a sí mismo)
 */
export async function deleteUserAction(userId: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") {
    return { error: "No autorizado." };
  }

  if (userId === currentUser.id) {
    return { error: "No puedes eliminar tu propia cuenta de administrador." };
  }

  // 1. Limpiar comentarios y reseñas escritos por el usuario en cualquier local
  await db.delete(placeComments).where(eq(placeComments.userId, userId));
  await db.delete(userPlaces).where(eq(userPlaces.userId, userId));
  await db.delete(sessions).where(eq(sessions.userId, userId));
  await db.delete(invitations).where(eq(invitations.createdById, userId));

  // 2. Limpiar locales creados por el usuario con todas sus relaciones
  const userPlacesCreated = await db
    .select({ id: places.id })
    .from(places)
    .where(eq(places.createdById, userId));
  const placeIds = userPlacesCreated.map((p) => p.id);

  if (placeIds.length > 0) {
    await db.delete(placeComments).where(inArray(placeComments.placeId, placeIds));
    await db.delete(userPlaces).where(inArray(userPlaces.placeId, placeIds));
    await db.delete(placeOccasions).where(inArray(placeOccasions.placeId, placeIds));
    await db.delete(placeTags).where(inArray(placeTags.placeId, placeIds));
    await db.delete(places).where(inArray(places.id, placeIds));
  }

  // 3. Eliminar usuario de forma segura
  await db.delete(users).where(eq(users.id, userId));
  await logAudit({
    actorUserId: currentUser.id,
    entityType: "user",
    entityId: userId,
    action: "user_deleted",
    metadata: { deletedPlacesCount: placeIds.length },
  });
  revalidatePath("/");
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
export async function deleteMultipleUsersAction(userIds: string[]) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") {
    return { error: "No autorizado. Solo los administradores pueden realizar esta acción." };
  }

  // Filtrar para evitar que el usuario actual se elimine a sí mismo
  const validIds = userIds.filter((id) => id !== currentUser.id);
  if (validIds.length === 0) {
    return { error: "No se seleccionó ningún usuario válido para eliminar (no puedes eliminar tu propia cuenta)." };
  }

  // 1. Limpiar comentarios y reseñas escritos por los usuarios
  await db.delete(placeComments).where(inArray(placeComments.userId, validIds));
  await db.delete(userPlaces).where(inArray(userPlaces.userId, validIds));
  await db.delete(sessions).where(inArray(sessions.userId, validIds));
  await db.delete(invitations).where(inArray(invitations.createdById, validIds));

  // 2. Limpiar locales creados por los usuarios y todas sus dependencias
  const userPlacesCreated = await db
    .select({ id: places.id })
    .from(places)
    .where(inArray(places.createdById, validIds));
  const placeIds = userPlacesCreated.map((p) => p.id);

  if (placeIds.length > 0) {
    await db.delete(placeComments).where(inArray(placeComments.placeId, placeIds));
    await db.delete(userPlaces).where(inArray(userPlaces.placeId, placeIds));
    await db.delete(placeOccasions).where(inArray(placeOccasions.placeId, placeIds));
    await db.delete(placeTags).where(inArray(placeTags.placeId, placeIds));
    await db.delete(places).where(inArray(places.id, placeIds));
  }

  // 3. Eliminar los usuarios seleccionados
  await db.delete(users).where(inArray(users.id, validIds));
  await logAudit({
    actorUserId: currentUser.id,
    entityType: "user",
    entityId: "bulk",
    action: "users_bulk_deleted",
    metadata: { count: validIds.length },
  });
  revalidatePath("/");
  return { success: true, count: validIds.length };
}
