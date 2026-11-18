"use server";

import { revalidatePath } from "next/cache";
import { eq, ne, and, sql, inArray } from "drizzle-orm";
import { db } from "@/db";
import { users, type User } from "@/db/schema";
import { getCurrentUser, hashPassword, verifyPassword } from "@/lib/auth";

export interface SafeUser {
  id: string;
  username: string | null;
  name: string;
  email: string;
  role: string;
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
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(users.createdAt);

  return rows;
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

  if (!newPassword || newPassword.length < 6) {
    return { error: "La nueva contraseña debe tener al menos 6 caracteres." };
  }

  const passwordHash = await hashPassword(newPassword);

  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, userId));

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

  await db.delete(users).where(eq(users.id, userId));
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

  if (!password || password.length < 6) {
    return { error: "La contraseña debe tener al menos 6 caracteres." };
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

  await db.insert(users).values({
    id,
    name,
    username,
    email,
    passwordHash,
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
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

  await db.delete(users).where(inArray(users.id, validIds));
  revalidatePath("/");
  return { success: true, count: validIds.length };
}
