import { cache } from "react";
import { cookies } from "next/headers";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  occasions,
  places,
  sharingGroupMembers,
  sharingGroups,
  type User,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export const ACTIVE_SPACE_COOKIE = "gastromap_active_space";

export type SpaceMode = "group" | "personal" | "all";

export const DEFAULT_SPACE_OCCASIONS: Array<{ id: string; name: string; icon: string }> = [
  { id: "desayuno", name: "Desayuno / Brunch", icon: "🥐" },
  { id: "tapear", name: "Tapear / Cañas", icon: "🍢" },
  { id: "comer", name: "Comer / Cenar", icon: "🍽️" },
  { id: "informal", name: "Informal / Rápido", icon: "🍔" },
  { id: "cafe", name: "Café / Merienda", icon: "☕" },
  { id: "copas", name: "Copas / Cócteles", icon: "🍸" },
  { id: "cita", name: "Cita / Especial", icon: "🕯️" },
  { id: "grupos", name: "Grupos / Celebración", icon: "👥" },
];

export interface UserGroupSummary {
  id: string;
  name: string;
  icon: string;
  description: string | null;
  ownerUserId: string;
  myRole: "admin" | "member";
  isOwner: boolean;
  membersCount: number;
  placesCount: number;
}

export interface ActiveWorkspace {
  mode: SpaceMode;
  groupId: string | null;
  scopeKey: string;
  group: UserGroupSummary | null;
  isSpaceAdmin: boolean;
  myGroups: UserGroupSummary[];
  personalPlacesCount: number;
}

export function buildScopeKey(groupId: string | null | undefined, userId: string): string {
  return groupId ? `group:${groupId}` : `personal:${userId}`;
}

/**
 * Garantiza que un espacio (grupo o mapa personal) tenga los 8 planes iniciales
 * cuando aún no cuenta con ninguna categoría propia.
 */
export async function ensureDefaultOccasionsForScope(scopeKey: string): Promise<void> {
  if (!scopeKey || scopeKey === "all" || scopeKey === "global") return;
  const existing = await db
    .select({ id: occasions.id })
    .from(occasions)
    .where(eq(occasions.scopeKey, scopeKey))
    .limit(1);

  if (existing.length === 0) {
    await db
      .insert(occasions)
      .values(
        DEFAULT_SPACE_OCCASIONS.map((occ) => ({
          scopeKey,
          id: occ.id,
          name: occ.name,
          icon: occ.icon,
        }))
      )
      .onConflictDoNothing();
  }
}

/**
 * Obtiene el espacio de trabajo activo del usuario actual (deduplicado por petición HTTP).
 */
export const getActiveWorkspace = cache(async (): Promise<ActiveWorkspace | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const [memberRows, personalCountRows] = await Promise.all([
    db
      .select({
        groupId: sharingGroupMembers.groupId,
        role: sharingGroupMembers.role,
      })
      .from(sharingGroupMembers)
      .where(eq(sharingGroupMembers.userId, user.id)),
    db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(places)
      .where(and(isNull(places.groupId), eq(places.createdById, user.id))),
  ]);

  const roleByGroupId = new Map<string, "admin" | "member">();
  for (const r of memberRows) {
    roleByGroupId.set(r.groupId, r.role === "admin" ? "admin" : "member");
  }

  const memberGroupIds = Array.from(roleByGroupId.keys());

  const groupRows = await db
    .select()
    .from(sharingGroups)
    .where(
      memberGroupIds.length > 0
        ? or(eq(sharingGroups.ownerUserId, user.id), inArray(sharingGroups.id, memberGroupIds))
        : eq(sharingGroups.ownerUserId, user.id)
    );

  let myGroups: UserGroupSummary[] = [];
  if (groupRows.length > 0) {
    const groupIds = groupRows.map((g) => g.id);
    const [memberCounts, placeCounts] = await Promise.all([
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
        .where(inArray(places.groupId, groupIds))
        .groupBy(places.groupId),
    ]);

    const membersMap = new Map(memberCounts.map((m) => [m.groupId, m.count]));
    const placesMap = new Map(
      placeCounts.filter((p) => p.groupId !== null).map((p) => [p.groupId as string, p.count])
    );

    myGroups = groupRows
      .map((g) => {
        const isOwner = g.ownerUserId === user.id;
        const myRole: "admin" | "member" =
          isOwner || roleByGroupId.get(g.id) === "admin" ? "admin" : "member";
        return {
          id: g.id,
          name: g.name,
          icon: g.icon || "🍻",
          description: g.description ?? null,
          ownerUserId: g.ownerUserId,
          myRole,
          isOwner,
          membersCount: Math.max(1, membersMap.get(g.id) || 0),
          placesCount: placesMap.get(g.id) || 0,
        };
      })
      .sort((a, b) => {
        // Pinono o grupos con más actividad primero, luego orden alfabético
        if (a.name.toLowerCase() === "pinono" && b.name.toLowerCase() !== "pinono") return -1;
        if (b.name.toLowerCase() === "pinono" && a.name.toLowerCase() !== "pinono") return 1;
        return a.name.localeCompare(b.name, "es");
      });
  }

  const personalPlacesCount = personalCountRows[0]?.count ?? 0;

  const cookieStore = await cookies();
  const rawCookie = cookieStore.get(ACTIVE_SPACE_COOKIE)?.value || "";

  if (rawCookie === "personal") {
    const scopeKey = buildScopeKey(null, user.id);
    await ensureDefaultOccasionsForScope(scopeKey);
    return {
      mode: "personal",
      groupId: null,
      scopeKey,
      group: null,
      isSpaceAdmin: true,
      myGroups,
      personalPlacesCount,
    };
  }

  if (rawCookie === "all") {
    return {
      mode: "all",
      groupId: null,
      scopeKey: "all",
      group: null,
      isSpaceAdmin: false,
      myGroups,
      personalPlacesCount,
    };
  }

  if (rawCookie.startsWith("group:")) {
    const targetId = rawCookie.slice("group:".length).trim();
    const matched = myGroups.find((g) => g.id === targetId);
    if (matched) {
      const scopeKey = buildScopeKey(matched.id, user.id);
      await ensureDefaultOccasionsForScope(scopeKey);
      return {
        mode: "group",
        groupId: matched.id,
        scopeKey,
        group: matched,
        isSpaceAdmin: matched.isOwner || matched.myRole === "admin",
        myGroups,
        personalPlacesCount,
      };
    }
  }

  // Fallback inteligente: primer grupo si pertenece a alguno (ej. Pinono), o Mapa Personal si es usuario recién registrado
  if (myGroups.length > 0) {
    const first = myGroups[0];
    const scopeKey = buildScopeKey(first.id, user.id);
    await ensureDefaultOccasionsForScope(scopeKey);
    return {
      mode: "group",
      groupId: first.id,
      scopeKey,
      group: first,
      isSpaceAdmin: first.isOwner || first.myRole === "admin",
      myGroups,
      personalPlacesCount,
    };
  }

  const personalScope = buildScopeKey(null, user.id);
  await ensureDefaultOccasionsForScope(personalScope);
  return {
    mode: "personal",
    groupId: null,
    scopeKey: personalScope,
    group: null,
    isSpaceAdmin: true,
    myGroups,
    personalPlacesCount,
  };
});

/**
 * Comprueba la pertenencia y rol de un usuario en un grupo concreto.
 */
export async function getGroupMembership(
  userId: string,
  groupId: string
): Promise<{ isMember: boolean; isGroupAdmin: boolean; isOwner: boolean }> {
  const [[group], [member]] = await Promise.all([
    db
      .select({ id: sharingGroups.id, ownerUserId: sharingGroups.ownerUserId })
      .from(sharingGroups)
      .where(eq(sharingGroups.id, groupId))
      .limit(1),
    db
      .select({ role: sharingGroupMembers.role })
      .from(sharingGroupMembers)
      .where(
        and(eq(sharingGroupMembers.groupId, groupId), eq(sharingGroupMembers.userId, userId))
      )
      .limit(1),
  ]);

  if (!group) {
    return { isMember: false, isGroupAdmin: false, isOwner: false };
  }

  const isOwner = group.ownerUserId === userId;
  const isMember = isOwner || Boolean(member);
  const isGroupAdmin = isOwner || member?.role === "admin";

  return { isMember, isGroupAdmin, isOwner };
}

/**
 * Evalúa permisos de lectura, edición y borrado sobre un sitio según su espacio (Mapa Personal vs Grupo).
 */
export async function getPlacePermissions(
  user: User,
  place: { id: string; groupId: string | null; createdById: string }
): Promise<{
  canRead: boolean;
  canEdit: boolean;
  canDelete: boolean;
  isGroupAdmin: boolean;
}> {
  if (!place.groupId) {
    const isMine = place.createdById === user.id;
    return {
      canRead: isMine || user.role === "admin",
      canEdit: isMine || user.role === "admin",
      canDelete: isMine || user.role === "admin",
      isGroupAdmin: isMine,
    };
  }

  const membership = await getGroupMembership(user.id, place.groupId);
  const isSuperAdmin = user.role === "admin";
  const isAuthor = place.createdById === user.id;

  return {
    canRead: membership.isMember || isSuperAdmin,
    canEdit: (membership.isMember && (isAuthor || membership.isGroupAdmin)) || isSuperAdmin,
    canDelete: (membership.isMember && (isAuthor || membership.isGroupAdmin)) || isSuperAdmin,
    isGroupAdmin: membership.isGroupAdmin || isSuperAdmin,
  };
}
