"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { and, asc, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import {
  placeLists,
  placeListItems,
  places,
  placeOccasions,
  placeTags,
  occasions,
  users,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { buildScopeKey, getActiveWorkspace, getGroupMembership } from "@/lib/workspace";
import {
  hasActiveListFilters,
  matchesListFilterCriteria,
  sanitizeListFilterCriteria,
  type ListFilterCriteria,
} from "@/lib/list-filters";
import { parseCityCountry, resolveFilterCity } from "@/lib/location";

export interface UserPlaceListSummary {
  id: string;
  groupId: string | null;
  name: string;
  description: string | null;
  icon: string;
  isPublic: boolean;
  shareSlug: string | null;
  isAuto: boolean;
  filterCriteria: ListFilterCriteria | null;
  placesCount: number;
  placeIds: string[];
  canManage: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListPlaceItemDetail {
  itemId: string;
  placeId: string;
  position: number;
  note: string | null;
  name: string;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  priceRange: string;
  googleMapsUrl: string | null;
  notes: string | null;
  occasions: string[];
  tags: string[];
}

export interface PublicGuideData {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  shareSlug: string;
  isAuto: boolean;
  filterCriteria: ListFilterCriteria | null;
  authorName: string;
  authorUsername: string | null;
  updatedAt: Date;
  items: ListPlaceItemDetail[];
  occasionMap: Record<string, { name: string; icon: string }>;
}

function buildShareSlug(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const suffix = crypto.randomBytes(3).toString("hex");
  return base ? `${base}-${suffix}` : `guia-${suffix}`;
}

async function canManageList(
  userId: string,
  userRole: string,
  list: { ownerId: string; groupId: string | null }
): Promise<boolean> {
  if (list.ownerId === userId || userRole === "admin") return true;
  if (list.groupId) {
    const membership = await getGroupMembership(userId, list.groupId);
    return membership.isGroupAdmin;
  }
  return false;
}

async function canReadList(
  userId: string,
  userRole: string,
  list: { ownerId: string; groupId: string | null }
): Promise<boolean> {
  if (list.ownerId === userId || userRole === "admin") return true;
  if (list.groupId) {
    const membership = await getGroupMembership(userId, list.groupId);
    return membership.isMember;
  }
  return false;
}

export async function getMyListsAction(): Promise<UserPlaceListSummary[]> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return [];

  const ws = await getActiveWorkspace();
  if (!ws) return [];

  const adminGroupIds = new Set(
    ws.myGroups.filter((g) => g.isOwner || g.myRole === "admin").map((g) => g.id)
  );

  let whereCond;
  if (ws.mode === "personal") {
    whereCond = and(isNull(placeLists.groupId), eq(placeLists.ownerId, currentUser.id));
  } else if (ws.mode === "group" && ws.groupId) {
    whereCond = eq(placeLists.groupId, ws.groupId);
  } else {
    const myGroupIds = ws.myGroups.map((g) => g.id);
    whereCond =
      myGroupIds.length > 0
        ? or(
            and(isNull(placeLists.groupId), eq(placeLists.ownerId, currentUser.id)),
            inArray(placeLists.groupId, myGroupIds)
          )
        : and(isNull(placeLists.groupId), eq(placeLists.ownerId, currentUser.id));
  }

  const lists = await db
    .select()
    .from(placeLists)
    .where(whereCond)
    .orderBy(desc(placeLists.updatedAt), desc(placeLists.createdAt));

  if (lists.length === 0) return [];

  const listIds = lists.map((l) => l.id);
  const items = await db
    .select({
      listId: placeListItems.listId,
      placeId: placeListItems.placeId,
    })
    .from(placeListItems)
    .where(inArray(placeListItems.listId, listIds))
    .orderBy(asc(placeListItems.position), asc(placeListItems.createdAt));

  const map = new Map<string, string[]>();
  for (const row of items) {
    const arr = map.get(row.listId) || [];
    arr.push(row.placeId);
    map.set(row.listId, arr);
  }

  // Cargar dinámicamente los sitios de las autolistas activas agrupando por espacio
  const autoSpacePlaces = new Map<string, SpacePlaceWithMeta[]>();
  const autoLists = lists.filter((l) => l.isAuto && hasActiveListFilters(l.filterCriteria));
  if (autoLists.length > 0) {
    const uniqueSpaces = new Map<string, { groupId: string | null; ownerId: string }>();
    for (const l of autoLists) {
      const key = l.groupId ? `g:${l.groupId}` : `p:${l.ownerId}`;
      if (!uniqueSpaces.has(key)) {
        uniqueSpaces.set(key, { groupId: l.groupId ?? null, ownerId: l.ownerId });
      }
    }
    await Promise.all(
      Array.from(uniqueSpaces.entries()).map(async ([key, sp]) => {
        const rows = await loadSpacePlacesWithMeta(sp.groupId, sp.ownerId);
        autoSpacePlaces.set(key, rows);
      })
    );
  }

  return lists.map((l) => {
    let ids: string[];
    if (l.isAuto && hasActiveListFilters(l.filterCriteria)) {
      const key = l.groupId ? `g:${l.groupId}` : `p:${l.ownerId}`;
      const spacePlaces = autoSpacePlaces.get(key) || [];
      ids = spacePlaces
        .filter((p) => matchesListFilterCriteria(p, l.filterCriteria))
        .map((p) => p.id);
    } else {
      ids = map.get(l.id) || [];
    }

    const canManage =
      l.ownerId === currentUser.id ||
      currentUser.role === "admin" ||
      Boolean(l.groupId && adminGroupIds.has(l.groupId));
    return {
      id: l.id,
      groupId: l.groupId ?? null,
      name: l.name,
      description: l.description,
      icon: l.icon,
      isPublic: l.isPublic,
      shareSlug: l.shareSlug,
      isAuto: l.isAuto,
      filterCriteria: sanitizeListFilterCriteria(l.filterCriteria),
      placesCount: ids.length,
      placeIds: ids,
      canManage,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
    };
  });
}

interface SpacePlaceWithMeta {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  priceRange: string;
  googleMapsUrl: string | null;
  notes: string | null;
  occasions: string[];
  tags: string[];
}

async function loadSpacePlacesWithMeta(
  groupId: string | null,
  ownerId: string
): Promise<SpacePlaceWithMeta[]> {
  const spaceCond = groupId
    ? eq(places.groupId, groupId)
    : and(isNull(places.groupId), eq(places.createdById, ownerId));

  const rows = await db
    .select({
      id: places.id,
      name: places.name,
      city: places.city,
      country: places.country,
      address: places.address,
      latitude: places.latitude,
      longitude: places.longitude,
      priceRange: places.priceRange,
      googleMapsUrl: places.googleMapsUrl,
      notes: places.notes,
    })
    .from(places)
    .where(and(isNull(places.deletedAt), spaceCond))
    .orderBy(asc(places.name));

  if (rows.length === 0) return [];

  const placeIds = rows.map((r) => r.id);
  const [occRows, tagRows] = await Promise.all([
    db
      .select({ placeId: placeOccasions.placeId, occasionId: placeOccasions.occasion })
      .from(placeOccasions)
      .where(inArray(placeOccasions.placeId, placeIds)),
    db
      .select({ placeId: placeTags.placeId, tag: placeTags.tag })
      .from(placeTags)
      .where(inArray(placeTags.placeId, placeIds)),
  ]);

  const occMap = new Map<string, string[]>();
  for (const r of occRows) {
    const arr = occMap.get(r.placeId) || [];
    arr.push(r.occasionId);
    occMap.set(r.placeId, arr);
  }

  const tagMap = new Map<string, string[]>();
  for (const r of tagRows) {
    const arr = tagMap.get(r.placeId) || [];
    arr.push(r.tag);
    tagMap.set(r.placeId, arr);
  }

  return rows.map((r) => ({
    ...r,
    occasions: occMap.get(r.id) || [],
    tags: tagMap.get(r.id) || [],
  }));
}

function toListPlaceItemDetails(rows: SpacePlaceWithMeta[]): ListPlaceItemDetail[] {
  return rows.map((p, idx) => ({
    itemId: p.id,
    placeId: p.id,
    position: idx,
    note: null,
    name: p.name,
    city: p.city,
    address: p.address,
    latitude: p.latitude,
    longitude: p.longitude,
    priceRange: p.priceRange,
    googleMapsUrl: p.googleMapsUrl,
    notes: p.notes,
    occasions: p.occasions,
    tags: p.tags,
  }));
}

export async function getListItemsAction(listId: string): Promise<ListPlaceItemDetail[]> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return [];

  const [list] = await db
    .select()
    .from(placeLists)
    .where(eq(placeLists.id, listId))
    .limit(1);

  if (!list) return [];
  if (!(await canReadList(currentUser.id, currentUser.role, list))) return [];

  if (list.isAuto && hasActiveListFilters(list.filterCriteria)) {
    const spacePlaces = await loadSpacePlacesWithMeta(list.groupId ?? null, list.ownerId);
    const matching = spacePlaces.filter((p) => matchesListFilterCriteria(p, list.filterCriteria));
    return toListPlaceItemDetails(matching);
  }

  return loadListItemsWithMeta(list.id);
}

async function loadListItemsWithMeta(listId: string): Promise<ListPlaceItemDetail[]> {
  const rows = await db
    .select({
      itemId: placeListItems.id,
      placeId: places.id,
      position: placeListItems.position,
      note: placeListItems.note,
      name: places.name,
      city: places.city,
      address: places.address,
      latitude: places.latitude,
      longitude: places.longitude,
      priceRange: places.priceRange,
      googleMapsUrl: places.googleMapsUrl,
      notes: places.notes,
    })
    .from(placeListItems)
    .innerJoin(places, eq(placeListItems.placeId, places.id))
    .where(eq(placeListItems.listId, listId))
    .orderBy(asc(placeListItems.position), asc(placeListItems.createdAt));

  if (rows.length === 0) return [];

  const placeIds = rows.map((r) => r.placeId);
  const [occRows, tagRows] = await Promise.all([
    db
      .select({ placeId: placeOccasions.placeId, occasionId: placeOccasions.occasion })
      .from(placeOccasions)
      .where(inArray(placeOccasions.placeId, placeIds)),
    db
      .select({ placeId: placeTags.placeId, tag: placeTags.tag })
      .from(placeTags)
      .where(inArray(placeTags.placeId, placeIds)),
  ]);

  const occMap = new Map<string, string[]>();
  for (const r of occRows) {
    const arr = occMap.get(r.placeId) || [];
    arr.push(r.occasionId);
    occMap.set(r.placeId, arr);
  }

  const tagMap = new Map<string, string[]>();
  for (const r of tagRows) {
    const arr = tagMap.get(r.placeId) || [];
    arr.push(r.tag);
    tagMap.set(r.placeId, arr);
  }

  return rows.map((r) => ({
    ...r,
    occasions: occMap.get(r.placeId) || [],
    tags: tagMap.get(r.placeId) || [],
  }));
}

export async function createListAction(input: {
  name: string;
  description?: string;
  icon?: string;
  isPublic?: boolean;
  isAuto?: boolean;
  filterCriteria?: ListFilterCriteria | null;
  initialPlaceId?: string;
}) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { error: "Debes iniciar sesión para crear una lista." };
  }

  const cleanName = (input.name || "").trim();
  if (cleanName.length < 2) {
    return { error: "El nombre de la lista debe tener al menos 2 caracteres." };
  }

  const cleanDesc = (input.description || "").trim() || null;
  const cleanIcon = (input.icon || "bookmark").trim().slice(0, 32) || "bookmark";
  const isPublic = Boolean(input.isPublic);
  const shareSlug = isPublic ? buildShareSlug(cleanName) : null;
  const cleanCriteria = sanitizeListFilterCriteria(input.filterCriteria);
  const isAuto = Boolean(input.isAuto && cleanCriteria);

  let targetGroupId: string | null = null;
  if (input.initialPlaceId) {
    const [initPlace] = await db
      .select({ groupId: places.groupId })
      .from(places)
      .where(eq(places.id, input.initialPlaceId))
      .limit(1);
    targetGroupId = initPlace?.groupId ?? null;
  } else {
    const ws = await getActiveWorkspace();
    targetGroupId = ws?.mode === "group" ? ws.groupId : null;
  }

  const [created] = await db
    .insert(placeLists)
    .values({
      ownerId: currentUser.id,
      groupId: targetGroupId,
      name: cleanName.slice(0, 120),
      description: cleanDesc,
      icon: cleanIcon,
      isPublic,
      shareSlug,
      isAuto,
      filterCriteria: cleanCriteria,
    })
    .returning();

  if (input.initialPlaceId && !isAuto) {
    await db
      .insert(placeListItems)
      .values({
        listId: created.id,
        placeId: input.initialPlaceId,
        position: 0,
      })
      .onConflictDoNothing();
  }

  await logAudit({
    actorUserId: currentUser.id,
    entityType: "place_list",
    entityId: created.id,
    action: "create",
    metadata: { name: created.name, isPublic: created.isPublic, isAuto: created.isAuto },
  });

  revalidatePath("/");
  return { success: true, list: created };
}

export async function updateListAction(
  listId: string,
  input: {
    name?: string;
    description?: string | null;
    icon?: string;
    isPublic?: boolean;
    isAuto?: boolean;
    filterCriteria?: ListFilterCriteria | null;
  }
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "No autorizado." };

  const [existing] = await db
    .select()
    .from(placeLists)
    .where(eq(placeLists.id, listId))
    .limit(1);

  if (!existing || !(await canManageList(currentUser.id, currentUser.role, existing))) {
    return { error: "Lista no encontrada o sin permisos." };
  }

  const nextName =
    input.name !== undefined ? input.name.trim().slice(0, 120) : existing.name;
  if (nextName.length < 2) {
    return { error: "El nombre de la lista debe tener al menos 2 caracteres." };
  }

  const nextDesc =
    input.description !== undefined
      ? (input.description || "").trim() || null
      : existing.description;
  const nextIcon =
    input.icon !== undefined
      ? input.icon.trim().slice(0, 32) || "bookmark"
      : existing.icon;
  const nextPublic = input.isPublic !== undefined ? input.isPublic : existing.isPublic;
  const nextSlug =
    nextPublic && !existing.shareSlug ? buildShareSlug(nextName) : existing.shareSlug;
  const nextCriteria =
    input.filterCriteria !== undefined
      ? sanitizeListFilterCriteria(input.filterCriteria)
      : existing.filterCriteria;
  const nextAuto =
    input.isAuto !== undefined
      ? Boolean(input.isAuto && nextCriteria)
      : Boolean(existing.isAuto && nextCriteria);

  // Si pasa de autolista a lista manual, conservar los sitios actuales materializándolos en place_list_items
  if (existing.isAuto && !nextAuto && hasActiveListFilters(existing.filterCriteria)) {
    const spacePlaces = await loadSpacePlacesWithMeta(
      existing.groupId ?? null,
      existing.ownerId
    );
    const matched = spacePlaces.filter((p) =>
      matchesListFilterCriteria(p, existing.filterCriteria)
    );
    if (matched.length > 0) {
      await db
        .insert(placeListItems)
        .values(
          matched.map((p, idx) => ({
            listId,
            placeId: p.id,
            position: idx,
          }))
        )
        .onConflictDoNothing();
    }
  }

  const [updated] = await db
    .update(placeLists)
    .set({
      name: nextName,
      description: nextDesc,
      icon: nextIcon,
      isPublic: nextPublic,
      shareSlug: nextSlug,
      isAuto: nextAuto,
      filterCriteria: nextCriteria,
      updatedAt: new Date(),
    })
    .where(eq(placeLists.id, listId))
    .returning();

  await logAudit({
    actorUserId: currentUser.id,
    entityType: "place_list",
    entityId: listId,
    action: "list_updated",
    metadata: { name: nextName, isPublic: nextPublic },
  });

  if (existing.shareSlug) revalidatePath(`/guide/${existing.shareSlug}`);
  if (updated.shareSlug) revalidatePath(`/guide/${updated.shareSlug}`);
  revalidatePath("/");
  return { success: true, list: updated };
}

export async function regenerateListSlugAction(listId: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "No autorizado." };

  const [existing] = await db
    .select()
    .from(placeLists)
    .where(eq(placeLists.id, listId))
    .limit(1);

  if (!existing || !(await canManageList(currentUser.id, currentUser.role, existing))) {
    return { error: "Lista no encontrada o sin permisos." };
  }

  const newSlug = buildShareSlug(existing.name);
  const [updated] = await db
    .update(placeLists)
    .set({
      shareSlug: newSlug,
      isPublic: true,
      updatedAt: new Date(),
    })
    .where(eq(placeLists.id, listId))
    .returning();

  await logAudit({
    actorUserId: currentUser.id,
    entityType: "place_list",
    entityId: listId,
    action: "list_updated",
    metadata: { name: existing.name, regeneratedSlug: true },
  });

  if (existing.shareSlug) revalidatePath(`/guide/${existing.shareSlug}`);
  revalidatePath(`/guide/${newSlug}`);
  return { success: true, shareSlug: updated.shareSlug };
}

export async function deleteListAction(listId: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "No autorizado." };

  const [existing] = await db
    .select()
    .from(placeLists)
    .where(eq(placeLists.id, listId))
    .limit(1);

  if (!existing || !(await canManageList(currentUser.id, currentUser.role, existing))) {
    return { error: "Lista no encontrada o sin permisos." };
  }

  await db.delete(placeLists).where(eq(placeLists.id, listId));

  await logAudit({
    actorUserId: currentUser.id,
    entityType: "place_list",
    entityId: listId,
    action: "delete",
    metadata: { name: existing.name },
  });

  if (existing.shareSlug) revalidatePath(`/guide/${existing.shareSlug}`);
  revalidatePath("/");
  return { success: true };
}

export async function togglePlaceInListAction(listId: string, placeId: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "No autorizado." };

  const [list] = await db
    .select()
    .from(placeLists)
    .where(eq(placeLists.id, listId))
    .limit(1);

  if (!list || !(await canReadList(currentUser.id, currentUser.role, list))) {
    return { error: "Lista no encontrada." };
  }

  const [existing] = await db
    .select()
    .from(placeListItems)
    .where(and(eq(placeListItems.listId, listId), eq(placeListItems.placeId, placeId)))
    .limit(1);

  if (existing) {
    await db.delete(placeListItems).where(eq(placeListItems.id, existing.id));
    await db
      .update(placeLists)
      .set({ updatedAt: new Date() })
      .where(eq(placeLists.id, listId));
    if (list.shareSlug) revalidatePath(`/guide/${list.shareSlug}`);
    return { success: true, added: false };
  }

  const currentItems = await db
    .select({ position: placeListItems.position })
    .from(placeListItems)
    .where(eq(placeListItems.listId, listId));
  const maxPos = currentItems.reduce((acc, item) => Math.max(acc, item.position), -1);

  await db.insert(placeListItems).values({
    listId,
    placeId,
    position: maxPos + 1,
  });

  await db
    .update(placeLists)
    .set({ updatedAt: new Date() })
    .where(eq(placeLists.id, listId));

  if (list.shareSlug) revalidatePath(`/guide/${list.shareSlug}`);
  return { success: true, added: true };
}

export interface ListCandidatePlace {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  priceRange: string;
}

/**
 * Añade varios establecimientos de golpe a una lista existente, omitiendo duplicados.
 */
export async function addPlacesToListAction(
  listId: string,
  placeIds: string[]
): Promise<{ success?: boolean; addedCount?: number; skippedCount?: number; error?: string }> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "No autorizado." };

  const uniqueIds = Array.from(new Set(placeIds.map((id) => id.trim()).filter(Boolean)));
  if (uniqueIds.length === 0) {
    return { success: true, addedCount: 0, skippedCount: 0 };
  }

  const [list] = await db
    .select()
    .from(placeLists)
    .where(eq(placeLists.id, listId))
    .limit(1);

  if (!list || !(await canReadList(currentUser.id, currentUser.role, list))) {
    return { error: "Lista no encontrada." };
  }

  const existingItems = await db
    .select({
      placeId: placeListItems.placeId,
      position: placeListItems.position,
    })
    .from(placeListItems)
    .where(eq(placeListItems.listId, listId));

  const existingSet = new Set(existingItems.map((i) => i.placeId));
  let nextPos = existingItems.reduce((acc, item) => Math.max(acc, item.position), -1) + 1;

  const toInsert = uniqueIds.filter((id) => !existingSet.has(id));
  if (toInsert.length > 0) {
    await db
      .insert(placeListItems)
      .values(
        toInsert.map((placeId) => ({
          listId,
          placeId,
          position: nextPos++,
        }))
      )
      .onConflictDoNothing();

    await db
      .update(placeLists)
      .set({ updatedAt: new Date() })
      .where(eq(placeLists.id, listId));
  }

  if (list.shareSlug) revalidatePath(`/guide/${list.shareSlug}`);
  revalidatePath("/");
  return {
    success: true,
    addedCount: toInsert.length,
    skippedCount: uniqueIds.length - toInsert.length,
  };
}

/**
 * Lista los establecimientos disponibles del mismo espacio que la lista para añadirlos por lote.
 */
export async function getListCandidatePlacesAction(
  listId: string
): Promise<ListCandidatePlace[]> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return [];

  const [list] = await db
    .select()
    .from(placeLists)
    .where(eq(placeLists.id, listId))
    .limit(1);

  if (!list || !(await canReadList(currentUser.id, currentUser.role, list))) {
    return [];
  }

  const ws = await getActiveWorkspace();
  let spaceFilter;
  if (list.groupId) {
    spaceFilter = eq(places.groupId, list.groupId);
  } else if (ws && ws.myGroups.length > 0) {
    spaceFilter = or(
      and(isNull(places.groupId), eq(places.createdById, currentUser.id)),
      inArray(
        places.groupId,
        ws.myGroups.map((g) => g.id)
      )
    );
  } else {
    spaceFilter = and(isNull(places.groupId), eq(places.createdById, currentUser.id));
  }

  return db
    .select({
      id: places.id,
      name: places.name,
      city: places.city,
      address: places.address,
      priceRange: places.priceRange,
    })
    .from(places)
    .where(and(isNull(places.deletedAt), spaceFilter))
    .orderBy(asc(places.name));
}

export interface ListEditorData {
  candidates: Array<{
    id: string;
    name: string;
    city: string | null;
    country: string | null;
    address: string | null;
    priceRange: string;
    occasions: string[];
    tags: string[];
  }>;
  occasions: Array<{ id: string; name: string; icon: string }>;
  tags: string[];
  cities: string[];
  countries: string[];
}

/**
 * Sincroniza de una sola vez los sitios seleccionados de una lista manual (añade nuevos y quita desmarcados).
 */
export async function syncListPlacesAction(
  listId: string,
  desiredPlaceIds: string[]
): Promise<{ success?: boolean; addedCount?: number; removedCount?: number; error?: string }> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "No autorizado." };

  const [list] = await db
    .select()
    .from(placeLists)
    .where(eq(placeLists.id, listId))
    .limit(1);

  if (!list || !(await canReadList(currentUser.id, currentUser.role, list))) {
    return { error: "Lista no encontrada." };
  }

  const desiredSet = new Set(desiredPlaceIds.map((id) => id.trim()).filter(Boolean));
  const existingItems = await db
    .select({
      id: placeListItems.id,
      placeId: placeListItems.placeId,
      position: placeListItems.position,
    })
    .from(placeListItems)
    .where(eq(placeListItems.listId, listId));

  const existingSet = new Set(existingItems.map((i) => i.placeId));
  const toRemoveIds = existingItems
    .filter((i) => !desiredSet.has(i.placeId))
    .map((i) => i.id);
  const toAddPlaceIds = Array.from(desiredSet).filter((id) => !existingSet.has(id));

  if (toRemoveIds.length > 0) {
    await db.delete(placeListItems).where(inArray(placeListItems.id, toRemoveIds));
  }

  if (toAddPlaceIds.length > 0) {
    let nextPos = existingItems.reduce((acc, item) => Math.max(acc, item.position), -1) + 1;
    await db
      .insert(placeListItems)
      .values(
        toAddPlaceIds.map((placeId) => ({
          listId,
          placeId,
          position: nextPos++,
        }))
      )
      .onConflictDoNothing();
  }

  if (toRemoveIds.length > 0 || toAddPlaceIds.length > 0) {
    await db
      .update(placeLists)
      .set({ updatedAt: new Date() })
      .where(eq(placeLists.id, listId));
  }

  if (list.shareSlug) revalidatePath(`/guide/${list.shareSlug}`);
  revalidatePath("/");
  return {
    success: true,
    addedCount: toAddPlaceIds.length,
    removedCount: toRemoveIds.length,
  };
}

/**
 * Carga todos los candidatos y taxonomías disponibles del espacio de una lista
 * para la tabla de edición masiva y el editor de filtros de autolista.
 */
export async function getListEditorDataAction(listId: string): Promise<ListEditorData | null> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return null;

  const [list] = await db
    .select()
    .from(placeLists)
    .where(eq(placeLists.id, listId))
    .limit(1);

  if (!list || !(await canReadList(currentUser.id, currentUser.role, list))) {
    return null;
  }

  const scopeKey = buildScopeKey(list.groupId ?? null, list.ownerId);
  const [candidates, scopeOccasions] = await Promise.all([
    loadSpacePlacesWithMeta(list.groupId ?? null, list.ownerId),
    db
      .select({ id: occasions.id, name: occasions.name, icon: occasions.icon })
      .from(occasions)
      .where(eq(occasions.scopeKey, scopeKey)),
  ]);

  const tagsSet = new Set<string>();
  const citiesSet = new Set<string>();
  const countriesSet = new Set<string>();

  for (const p of candidates) {
    for (const t of p.tags) tagsSet.add(t);
    const c = resolveFilterCity(p.city, p.address, p.country);
    if (c) citiesSet.add(c);
    const co = p.country || parseCityCountry(p.city, p.address).country;
    if (co) countriesSet.add(co);
  }

  return {
    candidates: candidates.map((p) => ({
      id: p.id,
      name: p.name,
      city: p.city,
      country: p.country,
      address: p.address,
      priceRange: p.priceRange,
      occasions: p.occasions,
      tags: p.tags,
    })),
    occasions: scopeOccasions.sort((a, b) => a.name.localeCompare(b.name, "es")),
    tags: Array.from(tagsSet).sort((a, b) => a.localeCompare(b, "es")),
    cities: Array.from(citiesSet).sort((a, b) => a.localeCompare(b, "es")),
    countries: Array.from(countriesSet).sort((a, b) => a.localeCompare(b, "es")),
  };
}

export async function reorderListItemsAction(listId: string, orderedPlaceIds: string[]) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "No autorizado." };

  const [list] = await db
    .select()
    .from(placeLists)
    .where(eq(placeLists.id, listId))
    .limit(1);

  if (!list || !(await canReadList(currentUser.id, currentUser.role, list))) {
    return { error: "Lista no encontrada." };
  }

  await Promise.all(
    orderedPlaceIds.map((pid, idx) =>
      db
        .update(placeListItems)
        .set({ position: idx })
        .where(and(eq(placeListItems.listId, listId), eq(placeListItems.placeId, pid)))
    )
  );

  await db
    .update(placeLists)
    .set({ updatedAt: new Date() })
    .where(eq(placeLists.id, listId));

  if (list.shareSlug) revalidatePath(`/guide/${list.shareSlug}`);
  return { success: true };
}

/**
 * Consulta pública (sin login) de una guía compartible por su slug.
 * Solo expone datos públicos de los establecimientos (nunca emails ni notas privadas).
 */
export async function getPublicGuideBySlug(slug: string): Promise<PublicGuideData | null> {
  const cleanSlug = (slug || "").trim();
  if (!cleanSlug) return null;

  const [row] = await db
    .select({
      id: placeLists.id,
      ownerId: placeLists.ownerId,
      groupId: placeLists.groupId,
      name: placeLists.name,
      description: placeLists.description,
      icon: placeLists.icon,
      isPublic: placeLists.isPublic,
      shareSlug: placeLists.shareSlug,
      isAuto: placeLists.isAuto,
      filterCriteria: placeLists.filterCriteria,
      updatedAt: placeLists.updatedAt,
      authorName: users.name,
      authorUsername: users.username,
    })
    .from(placeLists)
    .innerJoin(users, eq(placeLists.ownerId, users.id))
    .where(and(eq(placeLists.shareSlug, cleanSlug), eq(placeLists.isPublic, true)))
    .limit(1);

  if (!row || !row.shareSlug) return null;

  const listScopeKey = buildScopeKey(row.groupId, row.ownerId);
  const isAutoActive = row.isAuto && hasActiveListFilters(row.filterCriteria);
  const [items, allOccasions] = await Promise.all([
    isAutoActive
      ? loadSpacePlacesWithMeta(row.groupId ?? null, row.ownerId).then((spacePlaces) =>
          toListPlaceItemDetails(
            spacePlaces.filter((p) => matchesListFilterCriteria(p, row.filterCriteria))
          )
        )
      : loadListItemsWithMeta(row.id),
    db.select().from(occasions).where(eq(occasions.scopeKey, listScopeKey)),
  ]);

  const occasionMap: Record<string, { name: string; icon: string }> = {};
  for (const occ of allOccasions) {
    occasionMap[occ.id] = { name: occ.name, icon: occ.icon };
  }

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    icon: row.icon,
    shareSlug: row.shareSlug,
    isAuto: isAutoActive,
    filterCriteria: isAutoActive ? sanitizeListFilterCriteria(row.filterCriteria) : null,
    authorName: row.authorName,
    authorUsername: row.authorUsername,
    updatedAt: row.updatedAt,
    items,
    occasionMap,
  };
}
