"use server";

import { revalidatePath } from "next/cache";
import { eq, and, or, isNull, sql, inArray, desc } from "drizzle-orm";
import { db } from "@/db";
import { occasions, tags, placeOccasions, placeTags, places, type Occasion } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { KNOWN_OCCASIONS } from "@/data/occasions";
import {
  buildScopeKey,
  ensureDefaultOccasionsForScope,
  getActiveWorkspace,
  getGroupMembership,
} from "@/lib/workspace";

interface ResolvedTaxonomyScope {
  scopeKey: string;
  groupId: string | null;
  mode: "group" | "personal" | "all";
  canManage: boolean;
  myGroupIds: string[];
}

async function resolveTaxonomyScope(
  explicitGroupId?: string | null
): Promise<ResolvedTaxonomyScope | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  if (explicitGroupId !== undefined) {
    if (explicitGroupId === null) {
      const scopeKey = buildScopeKey(null, user.id);
      await ensureDefaultOccasionsForScope(scopeKey);
      return {
        scopeKey,
        groupId: null,
        mode: "personal",
        canManage: true,
        myGroupIds: [],
      };
    }
    const membership = await getGroupMembership(user.id, explicitGroupId);
    if (!membership.isMember && user.role !== "admin") return null;
    const scopeKey = buildScopeKey(explicitGroupId, user.id);
    await ensureDefaultOccasionsForScope(scopeKey);
    return {
      scopeKey,
      groupId: explicitGroupId,
      mode: "group",
      canManage: membership.isGroupAdmin || user.role === "admin",
      myGroupIds: [explicitGroupId],
    };
  }

  const ws = await getActiveWorkspace();
  if (!ws) return null;

  if (ws.mode === "all") {
    return {
      scopeKey: "all",
      groupId: null,
      mode: "all",
      canManage: user.role === "admin",
      myGroupIds: ws.myGroups.map((g) => g.id),
    };
  }

  return {
    scopeKey: ws.scopeKey,
    groupId: ws.groupId,
    mode: ws.mode,
    canManage: ws.isSpaceAdmin || user.role === "admin",
    myGroupIds: ws.myGroups.map((g) => g.id),
  };
}

async function getPlaceIdsInScope(
  scope: ResolvedTaxonomyScope,
  userId: string
): Promise<string[]> {
  if (scope.mode === "group" && scope.groupId) {
    const rows = await db
      .select({ id: places.id })
      .from(places)
      .where(eq(places.groupId, scope.groupId));
    return rows.map((r) => r.id);
  }
  if (scope.mode === "personal") {
    const rows = await db
      .select({ id: places.id })
      .from(places)
      .where(and(isNull(places.groupId), eq(places.createdById, userId)));
    return rows.map((r) => r.id);
  }
  const rows = await db
    .select({ id: places.id })
    .from(places)
    .where(
      scope.myGroupIds.length > 0
        ? or(
            and(isNull(places.groupId), eq(places.createdById, userId)),
            inArray(places.groupId, scope.myGroupIds)
          )
        : and(isNull(places.groupId), eq(places.createdById, userId))
    );
  return rows.map((r) => r.id);
}

/**
 * Obtiene todas las ocasiones del espacio activo junto con el conteo de establecimientos en ese espacio.
 */
export async function getOccasions(
  explicitGroupId?: string | null
): Promise<Array<Occasion & { placesCount: number }>> {
  const user = await getCurrentUser();
  if (!user) return [];

  const scope = await resolveTaxonomyScope(explicitGroupId);
  if (!scope) return [];

  if (scope.mode === "all") {
    const scopeKeys = [
      buildScopeKey(null, user.id),
      ...scope.myGroupIds.map((gid) => buildScopeKey(gid, user.id)),
    ];
    const placeIds = await getPlaceIdsInScope(scope, user.id);

    const [occRows, countRows] = await Promise.all([
      db
        .select()
        .from(occasions)
        .where(inArray(occasions.scopeKey, scopeKeys))
        .orderBy(occasions.createdAt),
      placeIds.length > 0
        ? db
            .select({
              occasion: sql<string>`lower(trim(${placeOccasions.occasion}))`,
              count: sql<number>`cast(count(distinct ${placeOccasions.placeId}) as integer)`,
            })
            .from(placeOccasions)
            .where(inArray(placeOccasions.placeId, placeIds))
            .groupBy(sql`lower(trim(${placeOccasions.occasion}))`)
        : Promise.resolve([]),
    ]);

    const countMap = new Map(countRows.map((c) => [c.occasion, c.count]));
    const dedup = new Map<string, Occasion>();
    for (const o of occRows) {
      if (!dedup.has(o.id)) dedup.set(o.id, o);
    }

    return Array.from(dedup.values()).map((occ) => ({
      ...occ,
      placesCount: countMap.get(occ.id.toLowerCase().trim()) || 0,
    }));
  }

  const placeWhere =
    scope.mode === "group" && scope.groupId
      ? eq(places.groupId, scope.groupId)
      : and(isNull(places.groupId), eq(places.createdById, user.id));

  const [initialList, counts] = await Promise.all([
    db
      .select()
      .from(occasions)
      .where(eq(occasions.scopeKey, scope.scopeKey))
      .orderBy(occasions.createdAt),
    db
      .select({
        occasion: sql<string>`lower(trim(${placeOccasions.occasion}))`,
        count: sql<number>`cast(count(distinct ${places.id}) as integer)`,
      })
      .from(placeOccasions)
      .innerJoin(places, eq(placeOccasions.placeId, places.id))
      .where(placeWhere)
      .groupBy(sql`lower(trim(${placeOccasions.occasion}))`),
  ]);

  const existingIds = new Set(initialList.map((o) => o.id.toLowerCase().trim()));
  const missing = counts
    .map((c) => c.occasion.trim().toLowerCase())
    .filter((occ) => occ && !existingIds.has(occ));

  let list = initialList;
  if (missing.length > 0) {
    const newItems = missing.map((occId) => {
      const known = KNOWN_OCCASIONS[occId];
      return {
        scopeKey: scope.scopeKey,
        id: occId,
        name: known
          ? known.name
          : occId.charAt(0).toUpperCase() + occId.slice(1).replace(/[-_]/g, " "),
        icon: known ? known.icon : "🍽️",
      };
    });
    await db.insert(occasions).values(newItems).onConflictDoNothing();
    list = await db
      .select()
      .from(occasions)
      .where(eq(occasions.scopeKey, scope.scopeKey))
      .orderBy(occasions.createdAt);
  }

  const countMap = new Map(counts.map((c) => [c.occasion, c.count]));

  return list.map((occ) => ({
    ...occ,
    placesCount: countMap.get(occ.id.toLowerCase().trim()) || 0,
  }));
}

/**
 * Obtiene todas las etiquetas del espacio activo junto con el conteo de sitios asociados en ese espacio.
 */
export async function getTagsWithCount(
  explicitGroupId?: string | null
): Promise<Array<{ id: string; name: string; placesCount: number }>> {
  const user = await getCurrentUser();
  if (!user) return [];

  const scope = await resolveTaxonomyScope(explicitGroupId);
  if (!scope) return [];

  if (scope.mode === "all") {
    const placeIds = await getPlaceIdsInScope(scope, user.id);
    if (placeIds.length === 0) return [];
    const counts = await db
      .select({
        tag: placeTags.tag,
        count: sql<number>`cast(count(*) as integer)`,
      })
      .from(placeTags)
      .where(inArray(placeTags.placeId, placeIds))
      .groupBy(placeTags.tag);

    return counts
      .map((c) => ({ id: c.tag, name: c.tag, placesCount: c.count }))
      .sort((a, b) => b.placesCount - a.placesCount || a.name.localeCompare(b.name));
  }

  const placeWhere =
    scope.mode === "group" && scope.groupId
      ? eq(places.groupId, scope.groupId)
      : and(isNull(places.groupId), eq(places.createdById, user.id));

  const [allTags, counts] = await Promise.all([
    db
      .select()
      .from(tags)
      .where(eq(tags.scopeKey, scope.scopeKey))
      .orderBy(tags.name),
    db
      .select({
        tag: placeTags.tag,
        count: sql<number>`cast(count(*) as integer)`,
      })
      .from(placeTags)
      .innerJoin(places, eq(placeTags.placeId, places.id))
      .where(placeWhere)
      .groupBy(placeTags.tag),
  ]);

  const countMap = new Map(counts.map((c) => [c.tag, c.count]));
  const tagIds = new Set<string>(allTags.map((t) => t.id));
  const result: Array<{ id: string; name: string; placesCount: number }> = allTags.map((t) => ({
    id: t.id,
    name: t.name,
    placesCount: countMap.get(t.id) || 0,
  }));

  for (const c of counts) {
    if (!tagIds.has(c.tag)) {
      result.push({
        id: c.tag,
        name: c.tag,
        placesCount: c.count,
      });
    }
  }

  return result.sort((a, b) => b.placesCount - a.placesCount || a.name.localeCompare(b.name));
}

/**
 * Crea una nueva ocasión en el espacio indicado (Admin del grupo, dueño del Mapa Personal o Superadmin).
 */
export async function createOccasionAction(
  formData: FormData,
  explicitGroupId?: string | null
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "No autenticado." };

  const scope = await resolveTaxonomyScope(explicitGroupId);
  if (!scope || scope.mode === "all" || !scope.canManage) {
    return { error: "Solo los administradores de este espacio pueden añadir categorías." };
  }

  const name = (formData.get("name") as string)?.trim();
  const icon = (formData.get("icon") as string)?.trim() || "🍽️";

  if (!name || name.length < 2) {
    return { error: "El nombre de la categoría debe tener al menos 2 caracteres." };
  }

  const id = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const [existing] = await db
    .select()
    .from(occasions)
    .where(and(eq(occasions.scopeKey, scope.scopeKey), eq(occasions.id, id)))
    .limit(1);

  if (existing) {
    return { error: `Ya existe una categoría similar ("${existing.name}").` };
  }

  await db.insert(occasions).values({ scopeKey: scope.scopeKey, id, name, icon });

  revalidatePath("/");
  revalidatePath("/new");
  revalidatePath("/admin");
  return { success: true };
}

/**
 * Renombra o cambia el icono de una ocasión dentro del espacio.
 */
export async function renameOccasionAction(
  id: string,
  newName: string,
  newIcon?: string,
  explicitGroupId?: string | null
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "No autorizado." };

  const scope = await resolveTaxonomyScope(explicitGroupId);
  if (!scope || scope.mode === "all" || !scope.canManage) {
    return { error: "No autorizado." };
  }

  const cleanName = newName.trim();
  if (!cleanName) return { error: "El nombre no puede estar vacío." };

  await db
    .update(occasions)
    .set({
      name: cleanName,
      ...(newIcon ? { icon: newIcon } : {}),
    })
    .where(and(eq(occasions.scopeKey, scope.scopeKey), eq(occasions.id, id)));

  revalidatePath("/");
  revalidatePath("/new");
  revalidatePath("/admin");
  return { success: true };
}

/**
 * Fusiona dos ocasiones únicamente en los sitios pertenecientes al espacio actual.
 */
export async function mergeOccasionsAction(
  sourceId: string,
  targetId: string,
  explicitGroupId?: string | null
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "No autorizado." };

  const scope = await resolveTaxonomyScope(explicitGroupId);
  if (!scope || scope.mode === "all" || !scope.canManage) {
    return { error: "No autorizado." };
  }

  if (sourceId === targetId) {
    return { error: "La categoría de origen y destino no pueden ser la misma." };
  }

  const placeIds = await getPlaceIdsInScope(scope, currentUser.id);
  if (placeIds.length > 0) {
    const existingTargetPlaces = await db
      .select({ placeId: placeOccasions.placeId })
      .from(placeOccasions)
      .where(
        and(
          inArray(placeOccasions.placeId, placeIds),
          eq(placeOccasions.occasion, targetId)
        )
      );

    const existingTargetPlaceIds = existingTargetPlaces.map((p) => p.placeId);

    if (existingTargetPlaceIds.length > 0) {
      await db
        .delete(placeOccasions)
        .where(
          and(
            eq(placeOccasions.occasion, sourceId),
            inArray(placeOccasions.placeId, existingTargetPlaceIds)
          )
        );
    }

    await db
      .update(placeOccasions)
      .set({ occasion: targetId })
      .where(
        and(
          eq(placeOccasions.occasion, sourceId),
          inArray(placeOccasions.placeId, placeIds)
        )
      );
  }

  await db
    .delete(occasions)
    .where(and(eq(occasions.scopeKey, scope.scopeKey), eq(occasions.id, sourceId)));

  revalidatePath("/");
  revalidatePath("/new");
  revalidatePath("/admin");
  return { success: true };
}

export async function deleteOccasionAction(
  id: string,
  replacementId?: string,
  explicitGroupId?: string | null
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "No autorizado." };

  const scope = await resolveTaxonomyScope(explicitGroupId);
  if (!scope || scope.mode === "all" || !scope.canManage) {
    return { error: "No autorizado." };
  }

  if (replacementId && replacementId !== id) {
    return await mergeOccasionsAction(id, replacementId, explicitGroupId);
  }

  const placeIds = await getPlaceIdsInScope(scope, currentUser.id);
  if (placeIds.length > 0) {
    await db
      .delete(placeOccasions)
      .where(
        and(
          inArray(placeOccasions.placeId, placeIds),
          sql`lower(trim(${placeOccasions.occasion})) = ${id.toLowerCase().trim()}`
        )
      );
  }

  await db
    .delete(occasions)
    .where(and(eq(occasions.scopeKey, scope.scopeKey), eq(occasions.id, id)));

  revalidatePath("/");
  revalidatePath("/new");
  revalidatePath("/admin");
  return { success: true };
}

export async function renameTagAction(
  oldTag: string,
  newTag: string,
  explicitGroupId?: string | null
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "No autorizado." };

  const scope = await resolveTaxonomyScope(explicitGroupId);
  if (!scope || scope.mode === "all" || !scope.canManage) {
    return { error: "No autorizado." };
  }

  const cleanNew = newTag
    .trim()
    .toLowerCase()
    .replace(/^#+/, "")
    .replace(/[^a-z0-9áéíóúñü\-_ ]/gi, "")
    .trim();

  if (!cleanNew) return { error: "El nombre no es válido." };
  if (cleanNew === oldTag) return { success: true };

  await db
    .insert(tags)
    .values({ scopeKey: scope.scopeKey, id: cleanNew, name: cleanNew })
    .onConflictDoNothing();

  const placeIds = await getPlaceIdsInScope(scope, currentUser.id);
  if (placeIds.length > 0) {
    const alreadyWithNew = await db
      .select({ placeId: placeTags.placeId })
      .from(placeTags)
      .where(and(inArray(placeTags.placeId, placeIds), eq(placeTags.tag, cleanNew)));
    const alreadyIds = alreadyWithNew.map((r) => r.placeId);
    if (alreadyIds.length > 0) {
      await db
        .delete(placeTags)
        .where(and(inArray(placeTags.placeId, alreadyIds), eq(placeTags.tag, oldTag)));
    }
    await db
      .update(placeTags)
      .set({ tag: cleanNew })
      .where(and(inArray(placeTags.placeId, placeIds), eq(placeTags.tag, oldTag)));
  }

  await db
    .delete(tags)
    .where(and(eq(tags.scopeKey, scope.scopeKey), eq(tags.id, oldTag)));

  revalidatePath("/");
  revalidatePath("/new");
  revalidatePath("/admin");
  return { success: true };
}

export async function mergeTagsAction(
  sourceTag: string,
  targetTag: string,
  explicitGroupId?: string | null
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "No autorizado." };

  const scope = await resolveTaxonomyScope(explicitGroupId);
  if (!scope || scope.mode === "all" || !scope.canManage) {
    return { error: "No autorizado." };
  }

  if (sourceTag === targetTag) {
    return { error: "La etiqueta de origen y destino no pueden ser la misma." };
  }

  await db
    .insert(tags)
    .values({ scopeKey: scope.scopeKey, id: targetTag, name: targetTag })
    .onConflictDoNothing();

  const placeIds = await getPlaceIdsInScope(scope, currentUser.id);
  if (placeIds.length > 0) {
    const existingTargetPlaces = await db
      .select({ placeId: placeTags.placeId })
      .from(placeTags)
      .where(and(inArray(placeTags.placeId, placeIds), eq(placeTags.tag, targetTag)));

    const existingPlaceIds = existingTargetPlaces.map((p) => p.placeId);
    if (existingPlaceIds.length > 0) {
      await db
        .delete(placeTags)
        .where(
          and(
            eq(placeTags.tag, sourceTag),
            inArray(placeTags.placeId, existingPlaceIds)
          )
        );
    }

    await db
      .update(placeTags)
      .set({ tag: targetTag })
      .where(and(inArray(placeTags.placeId, placeIds), eq(placeTags.tag, sourceTag)));
  }

  await db
    .delete(tags)
    .where(and(eq(tags.scopeKey, scope.scopeKey), eq(tags.id, sourceTag)));

  revalidatePath("/");
  revalidatePath("/new");
  revalidatePath("/admin");
  return { success: true };
}

export async function deleteTagAction(
  tag: string,
  replacementTag?: string,
  explicitGroupId?: string | null
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "No autorizado." };

  const scope = await resolveTaxonomyScope(explicitGroupId);
  if (!scope || scope.mode === "all" || !scope.canManage) {
    return { error: "No autorizado." };
  }

  if (replacementTag && replacementTag !== tag) {
    return await mergeTagsAction(tag, replacementTag, explicitGroupId);
  }

  const placeIds = await getPlaceIdsInScope(scope, currentUser.id);
  if (placeIds.length > 0) {
    await db
      .delete(placeTags)
      .where(and(inArray(placeTags.placeId, placeIds), eq(placeTags.tag, tag)));
  }

  await db
    .delete(tags)
    .where(and(eq(tags.scopeKey, scope.scopeKey), eq(tags.id, tag)));

  revalidatePath("/");
  revalidatePath("/new");
  revalidatePath("/admin");
  return { success: true };
}

export async function getPopularTags(limit = 20): Promise<string[]> {
  try {
    const all = await getTagsWithCount();
    return all.slice(0, limit).map((t) => t.name);
  } catch {
    return [];
  }
}

export async function deleteMultipleOccasionsAction(
  ids: string[],
  explicitGroupId?: string | null
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "No autorizado." };

  const scope = await resolveTaxonomyScope(explicitGroupId);
  if (!scope || scope.mode === "all" || !scope.canManage) {
    return { error: "No autorizado." };
  }

  if (ids.length === 0) return { success: true, count: 0 };
  const cleanIds = ids.map((id) => id.toLowerCase().trim());
  const placeIds = await getPlaceIdsInScope(scope, currentUser.id);

  if (placeIds.length > 0) {
    for (const cleanId of cleanIds) {
      await db
        .delete(placeOccasions)
        .where(
          and(
            inArray(placeOccasions.placeId, placeIds),
            sql`lower(trim(${placeOccasions.occasion})) = ${cleanId}`
          )
        );
    }
  }

  await db
    .delete(occasions)
    .where(and(eq(occasions.scopeKey, scope.scopeKey), inArray(occasions.id, ids)));

  revalidatePath("/");
  revalidatePath("/new");
  revalidatePath("/admin");
  return { success: true, count: ids.length };
}

export async function deleteMultipleTagsAction(
  tagIds: string[],
  explicitGroupId?: string | null
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "No autorizado." };

  const scope = await resolveTaxonomyScope(explicitGroupId);
  if (!scope || scope.mode === "all" || !scope.canManage) {
    return { error: "No autorizado." };
  }

  if (tagIds.length === 0) return { success: true, count: 0 };
  const cleanTags = tagIds.map((t) => t.toLowerCase().trim());
  const placeIds = await getPlaceIdsInScope(scope, currentUser.id);

  if (placeIds.length > 0) {
    for (const cleanTag of cleanTags) {
      await db
        .delete(placeTags)
        .where(
          and(
            inArray(placeTags.placeId, placeIds),
            sql`lower(trim(${placeTags.tag})) = ${cleanTag}`
          )
        );
    }
  }

  await db
    .delete(tags)
    .where(and(eq(tags.scopeKey, scope.scopeKey), inArray(tags.id, tagIds)));

  revalidatePath("/");
  revalidatePath("/new");
  revalidatePath("/admin");
  return { success: true, count: tagIds.length };
}

export async function deleteEmptyOccasionsAction(
  emptyIds?: string[],
  explicitGroupId?: string | null
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "No autorizado." };

  const scope = await resolveTaxonomyScope(explicitGroupId);
  if (!scope || scope.mode === "all" || !scope.canManage) {
    return { error: "No autorizado." };
  }

  let targetsToDelete: string[] = [];
  if (emptyIds && emptyIds.length > 0) {
    targetsToDelete = emptyIds.map((id) => id.toLowerCase().trim());
  } else {
    const allOccs = await getOccasions(explicitGroupId);
    targetsToDelete = allOccs
      .filter((o) => o.placesCount === 0)
      .map((o) => o.id.toLowerCase().trim());
  }

  if (targetsToDelete.length === 0) {
    return { success: true, count: 0, deleted: [] };
  }

  await db
    .delete(occasions)
    .where(
      and(eq(occasions.scopeKey, scope.scopeKey), inArray(occasions.id, targetsToDelete))
    );

  revalidatePath("/");
  revalidatePath("/new");
  revalidatePath("/admin");
  return { success: true, count: targetsToDelete.length, deleted: targetsToDelete };
}

export async function deleteEmptyTagsAction(
  emptyTags?: string[],
  explicitGroupId?: string | null
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "No autorizado." };

  const scope = await resolveTaxonomyScope(explicitGroupId);
  if (!scope || scope.mode === "all" || !scope.canManage) {
    return { error: "No autorizado." };
  }

  let targetsToDelete: string[] = [];
  if (emptyTags && emptyTags.length > 0) {
    targetsToDelete = emptyTags.map((t) => t.toLowerCase().trim());
  } else {
    const allTags = await getTagsWithCount(explicitGroupId);
    targetsToDelete = allTags
      .filter((t) => t.placesCount === 0)
      .map((t) => t.id.toLowerCase().trim());
  }

  if (targetsToDelete.length === 0) {
    return { success: true, count: 0, deleted: [] };
  }

  await db
    .delete(tags)
    .where(and(eq(tags.scopeKey, scope.scopeKey), inArray(tags.id, targetsToDelete)));

  revalidatePath("/");
  revalidatePath("/new");
  revalidatePath("/admin");
  return { success: true, count: targetsToDelete.length, deleted: targetsToDelete };
}
