"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { places, placeOccasions, placeTags, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { resolveGoogleMapsUrl, parseGoogleMapsUrl } from "@/lib/maps";

export interface CreatePlaceResult {
  success?: boolean;
  error?: string;
  placeId?: string;
}

export async function parseUrlAction(rawUrl: string) {
  const resolved = await resolveGoogleMapsUrl(rawUrl);
  const parsed = parseGoogleMapsUrl(resolved);
  return {
    ...parsed,
    resolvedUrl: resolved,
  };
}

export async function createPlaceAction(formData: FormData): Promise<CreatePlaceResult> {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { error: "Debes iniciar sesión para añadir un sitio." };
  }

  const name = (formData.get("name") as string)?.trim();
  const address = (formData.get("address") as string)?.trim() || null;
  const city = (formData.get("city") as string)?.trim() || null;
  const googleMapsUrl = (formData.get("googleMapsUrl") as string)?.trim() || null;
  const priceRange = (formData.get("priceRange") as string) || "???";
  const notes = (formData.get("notes") as string)?.trim() || null;

  const latStr = formData.get("latitude") as string;
  const lngStr = formData.get("longitude") as string;
  const latitude = latStr ? parseFloat(latStr) : null;
  const longitude = lngStr ? parseFloat(lngStr) : null;

  const occasions = formData.getAll("occasions") as string[];

  if (!name || name.length < 2) {
    return { error: "El nombre del establecimiento es obligatorio." };
  }

  // 1. Insertar el establecimiento
  const [newPlace] = await db
    .insert(places)
    .values({
      name,
      address,
      city,
      latitude,
      longitude,
      googleMapsUrl,
      priceRange,
      notes,
      createdById: currentUser.id,
    })
    .returning();

  // 2. Insertar ocasiones/planes seleccionados
  if (occasions.length > 0) {
    await db.insert(placeOccasions).values(
      occasions.map((occ) => ({
        placeId: newPlace.id,
        occasion: occ,
      }))
    );
  }

  // 3. Insertar tags seleccionados (chips visuales)
  const formTags = (formData.getAll("tags") as string[])
    .flatMap((t) => t.split(","))
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);

  const uniqueTags = Array.from(new Set(formTags));
  if (uniqueTags.length > 0) {
    await db.insert(placeTags).values(
      uniqueTags.map((t) => ({
        placeId: newPlace.id,
        tag: t,
      }))
    );
  }

  revalidatePath("/");
  redirect("/");
}

export async function deletePlaceAction(placeId: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { error: "No autorizado." };
  }

  // Comprobar propiedad o rol admin
  const [place] = await db
    .select()
    .from(places)
    .where(eq(places.id, placeId))
    .limit(1);

  if (!place) {
    return { error: "Establecimiento no encontrado." };
  }

  if (place.createdById !== currentUser.id && currentUser.role !== "admin") {
    return { error: "No tienes permiso para eliminar este establecimiento." };
  }

  await db.delete(places).where(eq(places.id, placeId));
  revalidatePath("/");
  return { success: true };
}

export async function getAllPlaces() {
  const rows = await db
    .select({
      place: places,
      createdByName: users.name,
    })
    .from(places)
    .innerJoin(users, eq(places.createdById, users.id))
    .orderBy(desc(places.createdAt));

  // Para cada lugar, recuperar ocasiones y etiquetas
  const placesWithDetails = await Promise.all(
    rows.map(async ({ place, createdByName }) => {
      const occs = await db
        .select({ occasion: placeOccasions.occasion })
        .from(placeOccasions)
        .where(eq(placeOccasions.placeId, place.id));

      const tags = await db
        .select({ tag: placeTags.tag })
        .from(placeTags)
        .where(eq(placeTags.placeId, place.id));

      return {
        ...place,
        createdByName,
        occasions: occs.map((o) => o.occasion),
        tags: tags.map((t) => t.tag),
      };
    })
  );

  return placesWithDetails;
}
