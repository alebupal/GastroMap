"use server";

import { redirect } from "next/navigation";
import crypto from "crypto";
import { eq, and, or, isNull, gt } from "drizzle-orm";
import { db } from "@/db";
import { users, invitations } from "@/db/schema";
import {
  hashPassword,
  verifyPassword,
  createSession,
  setSessionCookie,
  deleteSessionCookie,
  getCurrentUser,
  countUsers,
  invalidateSession,
} from "@/lib/auth";

export interface ActionResult {
  success?: boolean;
  error?: string;
  url?: string;
}

/**
 * Crea el primer usuario Administrador (solo disponible cuando la base de datos está vacía).
 */
export async function setupAdminAction(formData: FormData): Promise<ActionResult> {
  const total = await countUsers();
  if (total > 0) {
    return { error: "El sistema ya ha sido inicializado con un administrador." };
  }

  const name = (formData.get("name") as string)?.trim();
  const rawUsername = (formData.get("username") as string)?.trim().toLowerCase().replace(/^@/, "");
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!name || name.length < 2) {
    return { error: "El nombre debe tener al menos 2 caracteres." };
  }
  const username = rawUsername || email.split("@")[0].replace(/[^a-z0-9_-]/g, "");
  if (!username || username.length < 3) {
    return { error: "El nombre de usuario debe tener al menos 3 caracteres." };
  }
  if (!/^[a-z0-9_-]+$/.test(username)) {
    return { error: "El nombre de usuario solo puede contener letras, números, guiones y guiones bajos." };
  }
  if (!email || !email.includes("@")) {
    return { error: "Por favor, introduce un correo electrónico válido." };
  }
  if (!password || password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }
  if (password !== confirmPassword) {
    return { error: "Las contraseñas no coinciden." };
  }

  const passwordHash = await hashPassword(password);

  const [newUser] = await db
    .insert(users)
    .values({
      name,
      username,
      email,
      passwordHash,
      role: "admin",
    })
    .returning();

  const session = await createSession(newUser.id);
  await setSessionCookie(session.id, session.expiresAt);

  redirect("/");
}

/**
 * Inicia sesión con usuario o correo y contraseña.
 */
export async function loginAction(formData: FormData): Promise<ActionResult> {
  const identifier = (
    (formData.get("identifier") || formData.get("email")) as string
  )?.trim().toLowerCase().replace(/^@/, "");
  const password = formData.get("password") as string;

  if (!identifier || !password) {
    return { error: "Introduce tu usuario o correo y contraseña." };
  }

  const [user] = await db
    .select()
    .from(users)
    .where(or(eq(users.email, identifier), eq(users.username, identifier)))
    .limit(1);

  if (!user) {
    return { error: "Credenciales incorrectas." };
  }

  const isValid = await verifyPassword(user.passwordHash, password);
  if (!isValid) {
    return { error: "Credenciales incorrectas." };
  }

  const session = await createSession(user.id);
  await setSessionCookie(session.id, session.expiresAt);

  redirect("/");
}

/**
 * Cierra la sesión activa.
 */
export async function logoutAction(): Promise<void> {
  const cookieStore = await (await import("next/headers")).cookies();
  const sessionId = cookieStore.get("gastromap_session")?.value;
  if (sessionId) {
    await invalidateSession(sessionId);
  }
  await deleteSessionCookie();
  redirect("/login");
}

/**
 * Genera un enlace de invitación (solo para administradores).
 */
export async function createInvitationAction(formData: FormData): Promise<ActionResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") {
    return { error: "No tienes permisos de administrador para invitar usuarios." };
  }

  const invitedEmail = (formData.get("email") as string)?.trim().toLowerCase() || null;
  const role = (formData.get("role") as string) === "admin" ? "admin" : "user";
  const daysValid = parseInt((formData.get("days") as string) || "7", 10);

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * Math.max(1, daysValid));

  const [invitation] = await db
    .insert(invitations)
    .values({
      token,
      email: invitedEmail,
      role,
      createdById: currentUser.id,
      expiresAt,
    })
    .returning();

  return {
    success: true,
    url: `/invite/${invitation.token}`,
  };
}

/**
 * Registra un nuevo usuario consumiendo un token de invitación válido.
 */
export async function registerWithInvitationAction(
  token: string,
  formData: FormData
): Promise<ActionResult> {
  const [invitation] = await db
    .select()
    .from(invitations)
    .where(
      and(
        eq(invitations.token, token),
        isNull(invitations.usedAt),
        gt(invitations.expiresAt, new Date())
      )
    )
    .limit(1);

  if (!invitation) {
    return { error: "La invitación no es válida o ya ha expirado." };
  }

  const name = (formData.get("name") as string)?.trim();
  const rawUsername = (formData.get("username") as string)?.trim().toLowerCase().replace(/^@/, "");
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!name || name.length < 2) {
    return { error: "El nombre debe tener al menos 2 caracteres." };
  }
  const username = rawUsername || email.split("@")[0].replace(/[^a-z0-9_-]/g, "");
  if (!username || username.length < 3) {
    return { error: "El nombre de usuario debe tener al menos 3 caracteres." };
  }
  if (!/^[a-z0-9_-]+$/.test(username)) {
    return { error: "El nombre de usuario solo puede contener letras, números, guiones y guiones bajos." };
  }
  if (!email || !email.includes("@")) {
    return { error: "Introduce un correo válido." };
  }
  if (invitation.email && invitation.email !== email) {
    return { error: `Esta invitación está restringida a ${invitation.email}.` };
  }
  if (!password || password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }
  if (password !== confirmPassword) {
    return { error: "Las contraseñas no coinciden." };
  }

  // Comprobar si el email o username ya existen
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(or(eq(users.email, email), eq(users.username, username)))
    .limit(1);

  if (existingUser) {
    return { error: "Ya existe una cuenta con este correo o nombre de usuario." };
  }

  const passwordHash = await hashPassword(password);

  const [newUser] = await db
    .insert(users)
    .values({
      name,
      username,
      email,
      passwordHash,
      role: invitation.role,
    })
    .returning();

  // Marcar invitación como consumida
  await db
    .update(invitations)
    .set({ usedAt: new Date() })
    .where(eq(invitations.id, invitation.id));

  // Iniciar sesión automáticamente
  const session = await createSession(newUser.id);
  await setSessionCookie(session.id, session.expiresAt);

  redirect("/");
}
