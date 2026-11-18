"use server";

import { revalidatePath } from "next/cache";
import { eq, and, sql, notInArray, inArray, desc } from "drizzle-orm";
import { db } from "@/db";
import { occasions, tags, placeOccasions, placeTags, type Occasion } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

const INITIAL_OCCASIONS: Array<{ id: string; name: string; icon: string }> = [
  { id: "tapear", name: "Tapear", icon: "🍢" },
  { id: "comer", name: "Comer", icon: "🍽️" },
  { id: "desayuno", name: "Desayuno / Brunch", icon: "🥞" },
  { id: "dulce", name: "Un dulce", icon: "🍰" },
  { id: "cafe", name: "Café", icon: "☕" },
  { id: "copas", name: "Copas", icon: "🍸" },
  { id: "postureo", name: "Postureo", icon: "✨" },
  { id: "casual", name: "Casual / Rápido", icon: "🍔" },
  { id: "cita", name: "Cita / Especial", icon: "🕯️" },
  { id: "terraza", name: "Terraza / Vistas", icon: "☀️" },
];

/**
 * Obtiene todas las ocasiones junto con el conteo de establecimientos asociados.
 */
export async function getOccasions(): Promise<Array<Occasion & { placesCount: number }>> {
  let list = await db.select().from(occasions).orderBy(occasions.createdAt);

  if (list.length === 0) {
    await db.insert(occasions).values(INITIAL_OCCASIONS);
    list = await db.select().from(occasions).orderBy(occasions.createdAt);
  }

  // Contar sitios asociados a cada ocasión
  const counts = await db
    .select({
      occasion: placeOccasions.occasion,
      count: sql<number>`cast(count(*) as integer)`,
    })
    .from(placeOccasions)
    .groupBy(placeOccasions.occasion);

  const countMap = new Map(counts.map((c) => [c.occasion, c.count]));

  return list.map((occ) => ({
    ...occ,
    placesCount: countMap.get(occ.id) || 0,
  }));
}

/**
 * Obtiene todas las etiquetas del catálogo junto con el conteo de sitios asociados.
 */
export async function getTagsWithCount(): Promise<Array<{ id: string; name: string; placesCount: number }>> {
  const allTags = await db.select().from(tags).orderBy(tags.name);

  const counts = await db
    .select({
      tag: placeTags.tag,
      count: sql<number>`cast(count(*) as integer)`,
    })
    .from(placeTags)
    .groupBy(placeTags.tag);

  const countMap = new Map(counts.map((c) => [c.tag, c.count]));

  // Combinar etiquetas de la tabla tags y las que estén en place_tags
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
 * Crea una nueva ocasión (solo administradores).
 */
export async function createOccasionAction(formData: FormData) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") {
    return { error: "Solo los administradores pueden añadir categorías." };
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
    .where(eq(occasions.id, id))
    .limit(1);

  if (existing) {
    return { error: `Ya existe una categoría similar ("${existing.name}").` };
  }

  await db.insert(occasions).values({ id, name, icon });

  revalidatePath("/");
  revalidatePath("/new");
  return { success: true };
}

/**
 * Renombra una ocasión existente.
 */
export async function renameOccasionAction(id: string, newName: string, newIcon?: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") {
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
    .where(eq(occasions.id, id));

  revalidatePath("/");
  revalidatePath("/new");
  return { success: true };
}

/**
 * Combina una ocasión de origen en una de destino (Fusión).
 * Todos los sitios con sourceId pasarán a tener targetId (evitando duplicados) y sourceId se elimina.
 */
export async function mergeOccasionsAction(sourceId: string, targetId: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") {
    return { error: "No autorizado." };
  }

  if (sourceId === targetId) {
    return { error: "La categoría de origen y destino no pueden ser la misma." };
  }

  // 1. Obtener los sitios que ya tienen targetId para no duplicar
  const existingTargetPlaces = await db
    .select({ placeId: placeOccasions.placeId })
    .from(placeOccasions)
    .where(eq(placeOccasions.occasion, targetId));

  const existingTargetPlaceIds = existingTargetPlaces.map((p) => p.placeId);

  // 2. Si un sitio tiene ambos, simplemente borramos la fila con sourceId
  if (existingTargetPlaceIds.length > 0) {
    await db
      .delete(placeOccasions)
      .where(
        and(
          eq(placeOccasions.occasion, sourceId),
          sql`${placeOccasions.placeId} in ${existingTargetPlaceIds}`
        )
      );
  }

  // 3. A los sitios que solo tenían sourceId, se lo cambiamos a targetId
  await db
    .update(placeOccasions)
    .set({ occasion: targetId })
    .where(eq(placeOccasions.occasion, sourceId));

  // 4. Borrar la ocasión de origen
  await db.delete(occasions).where(eq(occasions.id, sourceId));

  revalidatePath("/");
  revalidatePath("/new");
  return { success: true };
}

/**
 * Elimina una ocasión. Si replacementId se proporciona, reasigna los sitios a la nueva ocasión;
 * si no, simplemente los desvincula.
 */
export async function deleteOccasionAction(id: string, replacementId?: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") {
    return { error: "No autorizado." };
  }

  if (replacementId && replacementId !== id) {
    return await mergeOccasionsAction(id, replacementId);
  }

  // Desvincular de todos los sitios asociados
  await db.delete(placeOccasions).where(eq(placeOccasions.occasion, id));

  // Eliminar la categoría
  await db.delete(occasions).where(eq(occasions.id, id));

  revalidatePath("/");
  revalidatePath("/new");
  return { success: true };
}

/**
 * Renombra una etiqueta en el catálogo global y en todos los sitios asociados.
 */
export async function renameTagAction(oldTag: string, newTag: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") {
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

  // Crear en tabla tags si no existe
  await db
    .insert(tags)
    .values({ id: cleanNew, name: cleanNew })
    .onConflictDoNothing();

  // Actualizar en place_tags
  await db
    .update(placeTags)
    .set({ tag: cleanNew })
    .where(eq(placeTags.tag, oldTag));

  // Eliminar la vieja de la tabla tags
  await db.delete(tags).where(eq(tags.id, oldTag));

  revalidatePath("/");
  revalidatePath("/new");
  return { success: true };
}

/**
 * Combina una etiqueta de origen en una etiqueta de destino.
 */
export async function mergeTagsAction(sourceTag: string, targetTag: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") {
    return { error: "No autorizado." };
  }

  if (sourceTag === targetTag) {
    return { error: "La etiqueta de origen y destino no pueden ser la misma." };
  }

  // Asegurar que targetTag exista en la tabla tags
  await db
    .insert(tags)
    .values({ id: targetTag, name: targetTag })
    .onConflictDoNothing();

  // Buscar sitios que ya tienen targetTag
  const existingTargetPlaces = await db
    .select({ placeId: placeTags.placeId })
    .from(placeTags)
    .where(eq(placeTags.tag, targetTag));

  const existingPlaceIds = existingTargetPlaces.map((p) => p.placeId);

  // Si ya tienen targetTag, eliminar la fila duplicada con sourceTag
  if (existingPlaceIds.length > 0) {
    await db
      .delete(placeTags)
      .where(
        and(
          eq(placeTags.tag, sourceTag),
          sql`${placeTags.placeId} in ${existingPlaceIds}`
        )
      );
  }

  // Actualizar el resto a targetTag
  await db
    .update(placeTags)
    .set({ tag: targetTag })
    .where(eq(placeTags.tag, sourceTag));

  // Borrar sourceTag de la tabla tags
  await db.delete(tags).where(eq(tags.id, sourceTag));

  revalidatePath("/");
  revalidatePath("/new");
  return { success: true };
}

/**
 * Elimina una etiqueta. Si replacementTag se proporciona, reasigna los sitios; si no, desvincula.
 */
export async function deleteTagAction(tag: string, replacementTag?: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") {
    return { error: "No autorizado." };
  }

  if (replacementTag && replacementTag !== tag) {
    return await mergeTagsAction(tag, replacementTag);
  }

  // Desvincular de todos los sitios
  await db.delete(placeTags).where(eq(placeTags.tag, tag));

  // Borrar de tags
  await db.delete(tags).where(eq(tags.id, tag));

  revalidatePath("/");
  revalidatePath("/new");
  return { success: true };
}

/**
 * Obtiene las etiquetas más utilizadas para sugerencias.
 */
export async function getPopularTags(limit = 20): Promise<string[]> {
  try {
    const rows = await db
      .select({
        tag: placeTags.tag,
        count: sql<number>`cast(count(*) as integer)`,
      })
      .from(placeTags)
      .groupBy(placeTags.tag)
      .orderBy(desc(sql`count(*)`))
      .limit(limit);

    return rows.map((r) => r.tag);
  } catch {
    return [];
  }
}

/**
 * Elimina múltiples ocasiones simultáneamente.
 */
export async function deleteMultipleOccasionsAction(ids: string[]) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") {
    return { error: "No autorizado." };
  }

  if (ids.length === 0) return { success: true, count: 0 };

  // 1. Desvincular de todos los sitios asociados
  await db.delete(placeOccasions).where(inArray(placeOccasions.occasion, ids));

  // 2. Eliminar categorías
  await db.delete(occasions).where(inArray(occasions.id, ids));

  revalidatePath("/");
  revalidatePath("/new");
  return { success: true, count: ids.length };
}

/**
 * Elimina múltiples etiquetas simultáneamente.
 */
export async function deleteMultipleTagsAction(tagIds: string[]) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") {
    return { error: "No autorizado." };
  }

  if (tagIds.length === 0) return { success: true, count: 0 };

  // 1. Desvincular de todos los sitios
  await db.delete(placeTags).where(inArray(placeTags.tag, tagIds));

  // 2. Borrar de tabla tags
  await db.delete(tags).where(inArray(tags.id, tagIds));

  revalidatePath("/");
  revalidatePath("/new");
  return { success: true, count: tagIds.length };
}

/**
 * Elimina todas las categorías vacías (sin locales asociados).
 */
export async function deleteEmptyOccasionsAction(emptyIds?: string[]) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") {
    return { error: "No autorizado." };
  }

  let targetsToDelete: string[] = [];

  if (emptyIds && emptyIds.length > 0) {
    targetsToDelete = emptyIds;
  } else {
    const allOccs = await getOccasions();
    targetsToDelete = allOccs.filter((o) => o.placesCount === 0).map((o) => o.id);
  }

  if (targetsToDelete.length === 0) {
    return { success: true, count: 0, deleted: [] };
  }

  await db.delete(occasions).where(inArray(occasions.id, targetsToDelete));

  revalidatePath("/");
  revalidatePath("/new");
  return { success: true, count: targetsToDelete.length, deleted: targetsToDelete };
}

/**
 * Elimina todas las etiquetas vacías (sin locales asociados).
 */
export async function deleteEmptyTagsAction(emptyTags?: string[]) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") {
    return { error: "No autorizado." };
  }

  let targetsToDelete: string[] = [];

  if (emptyTags && emptyTags.length > 0) {
    targetsToDelete = emptyTags;
  } else {
    const allTags = await getTagsWithCount();
    targetsToDelete = allTags.filter((t) => t.placesCount === 0).map((t) => t.id);
  }

  if (targetsToDelete.length === 0) {
    return { success: true, count: 0, deleted: [] };
  }

  await db.delete(tags).where(inArray(tags.id, targetsToDelete));

  revalidatePath("/");
  revalidatePath("/new");
  return { success: true, count: targetsToDelete.length, deleted: targetsToDelete };
}
