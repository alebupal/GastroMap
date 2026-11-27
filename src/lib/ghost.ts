export const GHOST_USER_EMAIL = "deleted-user@gastromap.local";
export const GHOST_USER_USERNAME = "usuario_eliminado";

/**
 * Comprueba si un username o email intenta usar la identidad reservada
 * del usuario fantasma del sistema.
 */
export function isReservedGhostIdentity(
  username?: string | null,
  email?: string | null
): boolean {
  const u = username?.trim().toLowerCase().replace(/^@/, "");
  const e = email?.trim().toLowerCase();
  return u === GHOST_USER_USERNAME || e === GHOST_USER_EMAIL;
}
