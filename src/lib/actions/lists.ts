"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
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

export interface UserPlaceListSummary {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  isPublic: boolean;
  shareSlug: string | null;
  placesCount: number;
  placeIds: string[];
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

export async function getMyListsAction(): Promise<UserPlaceListSummary[]> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return [];

  const lists = await db
    .select()
    .from(placeLists)
    .where(eq(placeLists.ownerId, currentUser.id))
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

  return lists.map((l) => {
    const ids = map.get(l.id) || [];
    return {
      id: l.id,
      name: l.name,
      description: l.description,
      icon: l.icon,
      isPublic: l.isPublic,
      shareSlug: l.shareSlug,
      placesCount: ids.length,
      placeIds: ids,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
    };
  });
}

export async function getListItemsAction(listId: string): Promise<ListPlaceItemDetail[]> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return [];

  const [list] = await db
    .select()
    .from(placeLists)
    .where(and(eq(placeLists.id, listId), eq(placeLists.ownerId, currentUser.id)))
    .limit(1);

  if (!list) return [];

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

  const [created] = await db
    .insert(placeLists)
    .values({
      ownerId: currentUser.id,
      name: cleanName.slice(0, 120),
      description: cleanDesc,
      icon: cleanIcon,
      isPublic,
      shareSlug,
    })
    .returning();

  if (input.initialPlaceId) {
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
    metadata: { name: created.name, isPublic: created.isPublic },
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
  }
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "No autorizado." };

  const [existing] = await db
    .select()
    .from(placeLists)
    .where(and(eq(placeLists.id, listId), eq(placeLists.ownerId, currentUser.id)))
    .limit(1);

  if (!existing) return { error: "Lista no encontrada." };

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

  const [updated] = await db
    .update(placeLists)
    .set({
      name: nextName,
      description: nextDesc,
      icon: nextIcon,
      isPublic: nextPublic,
      shareSlug: nextSlug,
      updatedAt: new Date(),
    })
    .where(eq(placeLists.id, listId))
    .returning();

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
    .where(and(eq(placeLists.id, listId), eq(placeLists.ownerId, currentUser.id)))
    .limit(1);

  if (!existing) return { error: "Lista no encontrada." };

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
    .where(and(eq(placeLists.id, listId), eq(placeLists.ownerId, currentUser.id)))
    .limit(1);

  if (!existing) return { error: "Lista no encontrada." };

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
    .where(and(eq(placeLists.id, listId), eq(placeLists.ownerId, currentUser.id)))
    .limit(1);

  if (!list) return { error: "Lista no encontrada." };

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

export async function reorderListItemsAction(listId: string, orderedPlaceIds: string[]) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: "No autorizado." };

  const [list] = await db
    .select()
    .from(placeLists)
    .where(and(eq(placeLists.id, listId), eq(placeLists.ownerId, currentUser.id)))
    .limit(1);

  if (!list) return { error: "Lista no encontrada." };

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
      name: placeLists.name,
      description: placeLists.description,
      icon: placeLists.icon,
      isPublic: placeLists.isPublic,
      shareSlug: placeLists.shareSlug,
      updatedAt: placeLists.updatedAt,
      authorName: users.name,
      authorUsername: users.username,
    })
    .from(placeLists)
    .innerJoin(users, eq(placeLists.ownerId, users.id))
    .where(and(eq(placeLists.shareSlug, cleanSlug), eq(placeLists.isPublic, true)))
    .limit(1);

  if (!row || !row.shareSlug) return null;

  const [items, allOccasions] = await Promise.all([
    loadListItemsWithMeta(row.id),
    db.select().from(occasions),
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
    authorName: row.authorName,
    authorUsername: row.authorUsername,
    updatedAt: row.updatedAt,
    items,
    occasionMap,
  };
}
