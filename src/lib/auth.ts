import { cookies } from "next/headers";
import crypto from "crypto";
import argon2 from "argon2";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users, sessions, type User, type Session } from "@/db/schema";

const SESSION_COOKIE_NAME = "gastromap_session";
const SESSION_DURATION_DAYS = 30;

/**
 * Hashea una contraseña usando Argon2id.
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456, // 19 MiB
    timeCost: 2,
    parallelism: 1,
  });
}

/**
 * Comprueba una contraseña frente al hash almacenado.
 */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

/**
 * Cuenta cuántos usuarios existen en el sistema.
 * Útil para determinar si la aplicación está en modo de inicialización inicial (/setup).
 */
export async function countUsers(): Promise<number> {
  const result = await db
    .select({ count: sql<number>`cast(count(*) as integer)` })
    .from(users);
  return result[0]?.count ?? 0;
}

/**
 * Crea una sesión de base de datos para un usuario.
 */
export async function createSession(userId: string): Promise<Session> {
  const sessionId = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * SESSION_DURATION_DAYS);

  const [session] = await db
    .insert(sessions)
    .values({
      id: sessionId,
      userId,
      expiresAt,
    })
    .returning();

  return session;
}

/**
 * Valida un token de sesión y devuelve el usuario si la sesión es válida.
 * Si ha expirado, la elimina automáticamente.
 */
export async function validateSessionToken(
  sessionId: string
): Promise<{ session: Session; user: User } | null> {
  const [result] = await db
    .select({
      user: users,
      session: sessions,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, sessionId));

  if (!result) return null;

  const { session, user } = result;

  // Si la sesión ha expirado, la borramos y retornamos null
  if (Date.now() >= session.expiresAt.getTime()) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return null;
  }

  // Si le queda menos de la mitad del tiempo (15 días), la renovamos automáticamente
  const refreshThreshold = 1000 * 60 * 60 * 24 * (SESSION_DURATION_DAYS / 2);
  if (session.expiresAt.getTime() - Date.now() < refreshThreshold) {
    const newExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * SESSION_DURATION_DAYS);
    await db
      .update(sessions)
      .set({ expiresAt: newExpiresAt })
      .where(eq(sessions.id, sessionId));
    session.expiresAt = newExpiresAt;
  }

  return { session, user };
}

/**
 * Invalida / cierra una sesión en base de datos.
 */
export async function invalidateSession(sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

/**
 * Establece la cookie de sesión HttpOnly en el cliente.
 */
export async function setSessionCookie(sessionId: string, expiresAt: Date): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
}

/**
 * Elimina la cookie de sesión del cliente.
 */
export async function deleteSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/",
  });
}

/**
 * Obtiene el usuario autenticado actual desde las cookies en Server Components / Server Actions.
 */
export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionId) return null;

  const authData = await validateSessionToken(sessionId);
  return authData ? authData.user : null;
}
