"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import crypto from "crypto";
import { eq, and, or, isNull, gt, desc } from "drizzle-orm";
import { db } from "@/db";
import { users, invitations } from "@/db/schema";
import { logAudit } from "@/lib/audit";
import { rateLimit, resetRateLimit } from "@/lib/rate-limit";
import {
  hashPassword,
  verifyPassword,
  createSession,
  setSessionCookie,
  deleteSessionCookie,
  setImpersonatorSessionCookie,
  deleteImpersonatorSessionCookie,
  validateSessionToken,
  getCurrentUser,
  countUsers,
  invalidateSession,
} from "@/lib/auth";
import { LOCALE_COOKIE, isLocale } from "@/lib/i18n/config";
import { isPublicRegistrationEnabled } from "@/lib/actions/settings";
import {
  ACTIVE_SPACE_COOKIE,
  buildScopeKey,
  ensureDefaultOccasionsForScope,
} from "@/lib/workspace";

function sanitizeCallbackUrl(raw: unknown): string {
  if (typeof raw !== "string") return "/";
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return "/";
  return trimmed;
}

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

  await ensureDefaultOccasionsForScope(buildScopeKey(null, newUser.id));

  const session = await createSession(newUser.id);
  await setSessionCookie(session.id, session.expiresAt);

  redirect("/");
}

/**
 * Registro público abierto (/register) cuando allow_public_registration !== 'false'.
 * Crea al usuario con su «Mapa Personal» inicializado y redirige a callbackUrl o '/'.
 */
export async function registerPublicAction(formData: FormData): Promise<ActionResult> {
  const enabled = await isPublicRegistrationEnabled();
  if (!enabled) {
    return {
      error: "El registro público está desactivado en este momento. Solicita una invitación.",
    };
  }

  const reg = await rateLimit("public-register", 6, 15 * 60 * 1000);
  if (!reg.allowed) {
    const mins = Math.max(1, Math.ceil(reg.retryAfterSec / 60));
    return { error: `Demasiados intentos de registro. Espera ${mins} min.` };
  }

  const name = (formData.get("name") as string)?.trim();
  const rawUsername = (formData.get("username") as string)?.trim().toLowerCase().replace(/^@/, "");
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;
  const callbackUrl = sanitizeCallbackUrl(formData.get("callbackUrl"));

  if (!name || name.length < 2) {
    return { error: "El nombre debe tener al menos 2 caracteres." };
  }
  const username = rawUsername || email?.split("@")[0]?.replace(/[^a-z0-9_-]/g, "");
  if (!username || username.length < 3) {
    return { error: "El nombre de usuario (@username) debe tener al menos 3 caracteres." };
  }
  if (!/^[a-z0-9_-]+$/.test(username)) {
    return {
      error: "El nombre de usuario solo puede contener letras, números, guiones y guiones bajos.",
    };
  }
  if (!email || !email.includes("@")) {
    return { error: "Introduce un correo electrónico válido." };
  }
  if (!password || password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }
  if (password !== confirmPassword) {
    return { error: "Las contraseñas no coinciden." };
  }

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
      role: "user",
    })
    .returning();

  // Inicializar los 8 planes base de su Mapa Personal
  await ensureDefaultOccasionsForScope(buildScopeKey(null, newUser.id));

  const cookieStore = await (await import("next/headers")).cookies();
  cookieStore.set(ACTIVE_SPACE_COOKIE, "personal", {
    path: "/",
    maxAge: 31536000,
    sameSite: "lax",
  });

  await logAudit({
    actorUserId: newUser.id,
    entityType: "user",
    entityId: newUser.id,
    action: "user_registered_public",
    metadata: { username },
  });

  const session = await createSession(newUser.id);
  await setSessionCookie(session.id, session.expiresAt);

  redirect(callbackUrl);
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

  // Anti fuerza bruta: 8 intentos / 10 min por IP+usuario
  const limit = await rateLimit("login", 8, 10 * 60 * 1000, identifier);
  if (!limit.allowed) {
    const mins = Math.ceil(limit.retryAfterSec / 60);
    return { error: `Demasiados intentos. Vuelve a probar en ${mins} min.` };
  }

  const [user] = await db
    .select()
    .from(users)
    .where(or(eq(users.email, identifier), eq(users.username, identifier)))
    .limit(1);

  if (!user) {
    return { error: "Credenciales incorrectas." };
  }

  if (user.status === "disabled") {
    return { error: "Tu cuenta está desactivada. Contacta con un administrador." };
  }

  const isValid = await verifyPassword(user.passwordHash, password);
  if (!isValid) {
    return { error: "Credenciales incorrectas." };
  }

  await resetRateLimit("login", identifier);
  const session = await createSession(user.id);
  await setSessionCookie(session.id, session.expiresAt);

  // Sincronizar cookie de idioma preferido por el usuario
  if (user.locale && isLocale(user.locale)) {
    const cookieStore = await (await import("next/headers")).cookies();
    cookieStore.set(LOCALE_COOKIE, user.locale, {
      path: "/",
      maxAge: 31536000,
      sameSite: "lax",
    });
  }

  const callbackUrl = sanitizeCallbackUrl(formData.get("callbackUrl"));
  redirect(callbackUrl);
}

/**
 * Guarda el idioma preferido del usuario en la base de datos.
 */
export async function updateUserLocaleAction(locale: string): Promise<{ success: boolean }> {
  try {
    const user = await getCurrentUser();
    if (user && isLocale(locale)) {
      await db.update(users).set({ locale }).where(eq(users.id, user.id));
    }
    return { success: true };
  } catch (err) {
    console.error("Error updating user locale:", err);
    return { success: false };
  }
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
  await deleteImpersonatorSessionCookie();
  redirect("/login");
}

/**
 * Permite a un administrador iniciar sesión temporalmente como otro usuario activo
 * conservando su sesión de administrador en una cookie HttpOnly separada.
 */
export async function impersonateUserAction(
  targetUserId: string
): Promise<{ success?: boolean; error?: string }> {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") {
    return { error: "No autorizado. Solo los administradores pueden usar esta opción." };
  }

  if (targetUserId === currentUser.id) {
    return { error: "Ya estás conectado con esta cuenta." };
  }

  const [targetUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);

  if (!targetUser) {
    return { error: "Usuario no encontrado." };
  }

  if (targetUser.status === "disabled") {
    return { error: "No puedes entrar como un usuario desactivado." };
  }

  const cookieStore = await (await import("next/headers")).cookies();
  const existingImpersonatorToken = cookieStore.get("gastromap_impersonator_session")?.value;
  const currentAdminToken = existingImpersonatorToken || cookieStore.get("gastromap_session")?.value;

  if (!currentAdminToken) {
    return { error: "Sesión de administrador no válida." };
  }

  const adminAuth = await validateSessionToken(currentAdminToken);
  if (!adminAuth || adminAuth.user.role !== "admin") {
    return { error: "Sesión de administrador no válida." };
  }

  // Guardar sesión del admin en cookie dedicada y crear sesión temporal para el usuario destino
  await setImpersonatorSessionCookie(adminAuth.session.id, adminAuth.session.expiresAt);
  const impersonatedSession = await createSession(targetUser.id, false);
  await setSessionCookie(impersonatedSession.id, impersonatedSession.expiresAt);

  await logAudit({
    actorUserId: adminAuth.user.id,
    entityType: "user",
    entityId: targetUser.id,
    action: "impersonation_started",
    metadata: {
      targetUsername: targetUser.username || targetUser.name,
    },
  });

  revalidatePath("/");
  return { success: true };
}

/**
 * Finaliza la suplantación de usuario y restaura automáticamente la sesión del administrador.
 */
export async function stopImpersonationAction(): Promise<void> {
  const cookieStore = await (await import("next/headers")).cookies();
  const currentSessionId = cookieStore.get("gastromap_session")?.value;
  const adminSessionId = cookieStore.get("gastromap_impersonator_session")?.value;

  let targetUsername: string | null = null;
  if (currentSessionId) {
    const currentAuth = await validateSessionToken(currentSessionId);
    if (currentAuth) {
      targetUsername = currentAuth.user.username || currentAuth.user.name;
    }
    if (currentSessionId !== adminSessionId) {
      await invalidateSession(currentSessionId);
    }
  }

  await deleteImpersonatorSessionCookie();

  if (adminSessionId) {
    const adminAuth = await validateSessionToken(adminSessionId);
    if (adminAuth && adminAuth.user.role === "admin") {
      await setSessionCookie(adminAuth.session.id, adminAuth.session.expiresAt);
      await logAudit({
        actorUserId: adminAuth.user.id,
        entityType: "user",
        entityId: adminAuth.user.id,
        action: "impersonation_ended",
        metadata: { targetUsername },
      });
      revalidatePath("/");
      redirect("/admin");
    }
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

  await logAudit({
    actorUserId: currentUser.id,
    entityType: "invitation",
    entityId: invitation.id,
    action: "invitation_created",
    metadata: { role, email: invitedEmail },
  });

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
  const reg = await rateLimit("register", 10, 15 * 60 * 1000);
  if (!reg.allowed) {
    return { error: "Demasiados intentos de registro. Inténtalo más tarde." };
  }

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

  await logAudit({
    actorUserId: newUser.id,
    entityType: "user",
    entityId: newUser.id,
    action: "user_registered",
    metadata: { username, role: invitation.role },
  });

  // Iniciar sesión automáticamente
  const session = await createSession(newUser.id);
  await setSessionCookie(session.id, session.expiresAt);

  redirect("/");
}

export interface SafeInvitation {
  id: string;
  token: string;
  email: string | null;
  role: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
  createdByName: string | null;
  createdByUsername: string | null;
}

/**
 * Obtiene todas las invitaciones del sistema (solo accesible por administradores)
 */
export async function getAllInvitationsAction(): Promise<SafeInvitation[]> {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") {
    return [];
  }

  const rows = await db
    .select({
      id: invitations.id,
      token: invitations.token,
      email: invitations.email,
      role: invitations.role,
      expiresAt: invitations.expiresAt,
      usedAt: invitations.usedAt,
      createdAt: invitations.createdAt,
      createdByName: users.name,
      createdByUsername: users.username,
    })
    .from(invitations)
    .leftJoin(users, eq(invitations.createdById, users.id))
    .orderBy(desc(invitations.createdAt));

  return rows;
}

/**
 * Elimina o revoca una invitación antes de que expire (solo accesible por administradores)
 */
export async function deleteInvitationAction(invitationId: string): Promise<{ success?: boolean; error?: string }> {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") {
    return { error: "No autorizado. Solo los administradores pueden gestionar invitaciones." };
  }

  const [invitation] = await db
    .select()
    .from(invitations)
    .where(eq(invitations.id, invitationId))
    .limit(1);

  if (!invitation) {
    return { error: "La invitación no existe o ya ha sido eliminada." };
  }

  await db.delete(invitations).where(eq(invitations.id, invitationId));

  await logAudit({
    actorUserId: currentUser.id,
    entityType: "invitation",
    entityId: invitationId,
    action: "invitation_deleted",
    metadata: { token: invitation.token, email: invitation.email },
  });

  revalidatePath("/");
  return { success: true };
}

